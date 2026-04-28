from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import datetime, date, timedelta
from utils.auth import require_purchase_access

inventory_bp = Blueprint("inventory", __name__)

def _get_status_id(cur, code, scope='INVENTORY_STATUS'):
    """Resolve status_id for the given scope (default: INVENTORY_STATUS)."""
    cur.execute(
        "SELECT status_id FROM static_status "
        "WHERE status_scope = %s AND status_code = %s LIMIT 1",
        (scope, code)
    )
    row = cur.fetchone()
    if not row:
        raise Exception(f"Status code '{code}' not found in static_status (scope={scope}).")
    return row[0]


def _resolve_brand(cur, brand_id, brand_name):
    """Return brand_id; create brand if it doesn't exist."""
    if brand_id:
        return int(brand_id)
    name = (brand_name or 'No Brand').strip()
    cur.execute("SELECT brand_id FROM brand WHERE brand_name = %s", (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO brand (brand_name) VALUES (%s) RETURNING brand_id",
        (name,)
    )
    return cur.fetchone()[0]


def _parse_shelf_life(value):
    """Parse shelf_life string/date to a datetime, or return None."""
    if not value:
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return value


def _resolve_uom(cur, uom_name):
    """Return uom_id for the given uom_name."""
    if not uom_name or uom_name == 'Select':
        raise Exception("UOM is required for each brand variant.")
    cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_name = %s", (uom_name,))
    row = cur.fetchone()
    if not row:
        raise Exception(f"UOM '{uom_name}' not found.")
    return row[0]


def _resolve_supplier(cur, supplier_name):
    """Return supplier_id by name, or raise if not found."""
    sname = (supplier_name or '').strip()
    if not sname:
        return None
    cur.execute("SELECT supplier_id FROM supplier WHERE supplier_name = %s", (sname,))
    row = cur.fetchone()
    if not row:
        raise Exception(f"Supplier '{sname}' not found.")
    return row[0]


def _remove_variants(cur, id_list: list) -> tuple[int, int]:
    """
    Safely remove variants that are no longer in the edit payload.

    - Variants with NO order history  → hard-deleted (inventory_brand + children)
    - Variants WITH order history     → soft-deleted (item_status_id = ARCHIVED)
      so historical order data stays intact.

    Returns (hard_deleted_count, soft_deleted_count).
    """
    if not id_list:
        return 0, 0

    cur.execute(
        "SELECT DISTINCT inventory_brand_id FROM order_details "
        "WHERE inventory_brand_id = ANY(%s)",
        (id_list,)
    )
    referenced = {row[0] for row in cur.fetchall()}

    to_hard_delete = [i for i in id_list if i not in referenced]
    to_soft_delete = [i for i in id_list if i in referenced]

    if to_hard_delete:
        cur.execute(
            "DELETE FROM inventory_action WHERE inventory_brand_id = ANY(%s)",
            (to_hard_delete,)
        )
        cur.execute(
            "DELETE FROM inventory_brand_supplier WHERE inventory_brand_id = ANY(%s)",
            (to_hard_delete,)
        )
        cur.execute(
            "DELETE FROM inventory_brand WHERE inventory_brand_id = ANY(%s)",
            (to_hard_delete,)
        )

    if to_soft_delete:
        inactive_id = _get_status_id(cur, "ARCHIVED")
        cur.execute(
            "UPDATE inventory_brand SET item_status_id = %s "
            "WHERE inventory_brand_id = ANY(%s)",
            (inactive_id, to_soft_delete)
        )

    return len(to_hard_delete), len(to_soft_delete)


# Batch status IDs from static_status table (avoids repeated lookups)
BATCH_STATUS_ACTIVE   = 15
BATCH_STATUS_DEPLETED = 17


class InsufficientStockError(Exception):
    pass


def process_fefo_depletion(cur, inventory_brand_id, required_qty):
    """
    Deplete stock for inventory_brand_id by required_qty using FEFO ordering
    (oldest expiry date consumed first).

    Returns a list of {"batch_id": int, "qty_deducted": int} for each batch
    touched — callers can persist this into order_details.

    Raises InsufficientStockError if total active stock < required_qty.
    Caller is responsible for committing the transaction.
    """
    cur.execute("""
        SELECT COALESCE(SUM(quantity_on_hand), 0)
        FROM   inventory_batch
        WHERE  inventory_brand_id = %s
          AND  batch_status_id    = %s
    """, (inventory_brand_id, BATCH_STATUS_ACTIVE))
    total_available = cur.fetchone()[0]

    if total_available < required_qty:
        raise InsufficientStockError(
            f"Insufficient stock: requested {required_qty}, available {total_available}."
        )

    cur.execute("""
        SELECT batch_id, quantity_on_hand
        FROM   inventory_batch
        WHERE  inventory_brand_id = %s
          AND  batch_status_id    = %s
          AND  quantity_on_hand   > 0
        ORDER BY expiry_date ASC NULLS LAST, batch_id ASC
    """, (inventory_brand_id, BATCH_STATUS_ACTIVE))
    batches = cur.fetchall()

    deductions = []
    remaining  = required_qty
    for batch_id, qty_on_hand in batches:
        if remaining <= 0:
            break
        deduct  = min(qty_on_hand, remaining)
        new_qty = qty_on_hand - deduct
        remaining -= deduct

        if new_qty == 0:
            cur.execute("""
                UPDATE inventory_batch
                SET    quantity_on_hand = 0,
                       batch_status_id  = %s
                WHERE  batch_id = %s
            """, (BATCH_STATUS_DEPLETED, batch_id))
        else:
            cur.execute("""
                UPDATE inventory_batch
                SET    quantity_on_hand = %s
                WHERE  batch_id = %s
            """, (new_qty, batch_id))

        deductions.append({"batch_id": batch_id, "qty_deducted": deduct})

    return deductions


@inventory_bp.route("/api/brands", methods=["GET"])
def get_brands():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT brand_id, brand_name
            FROM brand
            WHERE is_active = true
            ORDER BY brand_name ASC
        """)
        rows = cur.fetchall()
        return jsonify([{"id": r[0], "name": r[1]} for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/uom", methods=["GET"])
def get_uoms():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT uom_id, uom_name
            FROM unit_of_measure
            WHERE is_active = true
            ORDER BY uom_name ASC
        """)
        rows = cur.fetchall()
        return jsonify([{"id": r[0], "name": r[1]} for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/uom", methods=["POST"])
def add_uom():
    data = request.get_json()
    uom_name = (data.get("uom_name") or "").strip()
    if not uom_name:
        return jsonify({"error": "UOM name is required"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_name = %s", (uom_name,))
        if cur.fetchone():
            return jsonify({"error": f"UOM '{uom_name}' already exists"}), 409
        cur.execute(
            "INSERT INTO unit_of_measure (uom_name, is_active) VALUES (%s, true) RETURNING uom_id",
            (uom_name,)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": new_id, "name": uom_name}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/uom/<int:uom_id>", methods=["PUT"])
def update_uom(uom_id):
    data = request.get_json()
    uom_name = (data.get("uom_name") or "").strip()
    if not uom_name:
        return jsonify({"error": "UOM name cannot be empty"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE unit_of_measure SET uom_name = %s WHERE uom_id = %s RETURNING uom_id, uom_name",
            (uom_name, uom_id)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "UOM not found"}), 404
        conn.commit()
        return jsonify({"id": row[0], "name": row[1]})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory/search", methods=["GET"])
def search_inventory_variants():
    q = request.args.get('q', '').strip()
    conn = get_connection()
    cur = conn.cursor()

    # Shared SELECT + JOINs + base WHERE (no text filter)
    BASE_QUERY = """
        SELECT DISTINCT
            ib.inventory_brand_id,
            i.item_name,
            COALESCE(b.brand_name, 'No Brand')  AS brand_name,
            u.uom_name,
            COALESCE(ib.item_description, '')   AS item_description,
            COALESCE(ib.item_selling_price, 0)  AS item_selling_price,
            COALESCE((
                SELECT SUM(bat.quantity_on_hand)
                FROM   inventory_batch bat
                WHERE  bat.inventory_brand_id = ib.inventory_brand_id
                  AND  bat.batch_status_id    = 15
            ), 0) AS total_quantity
        FROM inventory_brand ib
        JOIN inventory        i    ON i.inventory_id    = ib.inventory_id
        JOIN brand            b    ON b.brand_id        = ib.brand_id
        JOIN unit_of_measure  u    ON u.uom_id          = ib.uom_id
        JOIN static_status    s_i  ON s_i.status_id     = i.item_status_id
                                  AND s_i.status_scope  = 'INVENTORY_STATUS'
        LEFT JOIN static_status s_b ON s_b.status_id   = ib.item_status_id
                                   AND s_b.status_scope = 'INVENTORY_STATUS'
        WHERE COALESCE((
                SELECT SUM(bat2.quantity_on_hand)
                FROM   inventory_batch bat2
                WHERE  bat2.inventory_brand_id = ib.inventory_brand_id
                  AND  bat2.batch_status_id    = 15
              ), 0) > 0
          AND COALESCE(s_b.status_code, '') != 'ARCHIVED'
          AND s_i.status_code != 'ARCHIVED'
    """

    try:
        if q:
            like = f"%{q}%"
            cur.execute(BASE_QUERY + """
              AND (
                    i.item_name          ILIKE %s
                 OR b.brand_name         ILIKE %s
                 OR u.uom_name           ILIKE %s
                 OR ib.item_description  ILIKE %s
                 OR ib.item_sku          ILIKE %s
              )
            ORDER BY item_name, brand_name
            LIMIT 40
            """, (like, like, like, like, like))
        else:
            cur.execute(BASE_QUERY + """
            ORDER BY item_name, brand_name
            LIMIT 40
            """)

        rows = cur.fetchall()
        results = [{
            "inventory_brand_id":  row[0],
            "item_name":           row[1],
            "brand_name":          row[2],
            "uom_name":            row[3],
            "item_description":    row[4],
            "item_selling_price":  float(row[5]),
            "total_quantity":      int(row[6]),
        } for row in rows]

        print(f"[inventory/search] q='{q}' | found: {len(results)} variant(s)")
        return jsonify(results), 200

    except Exception as e:
        print(f"[inventory/search] ERROR q='{q}': {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                i.inventory_id,
                i.item_name,
                COALESCE(SUM(bat_agg.qty_on_hand), 0)     AS total_quantity,
                COALESCE(
                    (SELECT u2.uom_name
                     FROM inventory_brand ib2
                     JOIN unit_of_measure u2 ON ib2.uom_id = u2.uom_id
                     WHERE ib2.inventory_id = i.inventory_id
                     LIMIT 1),
                    '—'
                )                                          AS uom,
                s.status_name                              AS item_status,
                i.item_status_id,
                COALESCE(MAX(ia.low_stock_qty), 0)         AS low_stock_qty,
                s.status_code
            FROM inventory i
            JOIN static_status s
                ON i.item_status_id = s.status_id
               AND s.status_scope = 'INVENTORY_STATUS'
            LEFT JOIN inventory_brand ib
                ON ib.inventory_id = i.inventory_id
            LEFT JOIN inventory_action ia
                ON ia.inventory_brand_id = ib.inventory_brand_id
            LEFT JOIN (
                SELECT inventory_brand_id, SUM(quantity_on_hand) AS qty_on_hand
                FROM   inventory_batch
                WHERE  batch_status_id = 15
                GROUP BY inventory_brand_id
            ) bat_agg ON bat_agg.inventory_brand_id = ib.inventory_brand_id
            GROUP BY
                i.inventory_id, i.item_name,
                s.status_name, s.status_code, i.item_status_id
            ORDER BY i.inventory_id ASC
        """)
        rows = cur.fetchall()

        cur.execute("""
            SELECT
                ib.inventory_id,
                b.brand_id,
                COALESCE(b.brand_name, 'Generic')  AS brand_name,
                ib.item_sku,
                ib.item_selling_price,
                COALESCE((
                    SELECT SUM(bat.quantity_on_hand)
                    FROM   inventory_batch bat
                    WHERE  bat.inventory_brand_id = ib.inventory_brand_id
                      AND  bat.batch_status_id    = 15
                ), 0)                              AS qty_on_hand,
                COALESCE(ia.reorder_qty, 0)        AS reorder_qty,
                COALESCE(ia.low_stock_qty, 0)      AS low_stock_qty,
                u.uom_name,
                ib.inventory_brand_id,
                (
                    SELECT MIN(bat.expiry_date)
                    FROM   inventory_batch bat
                    WHERE  bat.inventory_brand_id = ib.inventory_brand_id
                      AND  bat.quantity_on_hand   > 0
                      AND  bat.batch_status_id    = 15
                )                                  AS nearest_expiry,
                (
                    SELECT bat.unit_cost
                    FROM   inventory_batch bat
                    WHERE  bat.inventory_brand_id = ib.inventory_brand_id
                      AND  bat.quantity_on_hand   > 0
                      AND  bat.batch_status_id    = 15
                    ORDER BY bat.expiry_date ASC NULLS LAST, bat.batch_id ASC
                    LIMIT 1
                )                                  AS fefo_cost
            FROM inventory_brand ib
            LEFT JOIN brand b ON ib.brand_id = b.brand_id
            LEFT JOIN inventory_action ia
                ON ia.inventory_brand_id = ib.inventory_brand_id
            LEFT JOIN unit_of_measure u ON ib.uom_id = u.uom_id
            ORDER BY ib.inventory_id, COALESCE(b.brand_name, 'Generic')
        """)
        brand_rows = cur.fetchall()

        cur.execute("""
            SELECT DISTINCT
                i.inventory_id,
                s.supplier_id,
                s.supplier_name,
                s.contact_person,
                s.supplier_contact
            FROM inventory i
            JOIN inventory_brand ib ON ib.inventory_id = i.inventory_id
            JOIN inventory_brand_supplier ibs
                ON ibs.inventory_brand_id = ib.inventory_brand_id
            JOIN supplier s ON s.supplier_id = ibs.supplier_id
            ORDER BY i.inventory_id
        """)
        supplier_rows = cur.fetchall()

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

    brands_map: dict = {}
    for br in brand_rows:
        inv_id = str(br[0])
        brands_map.setdefault(inv_id, []).append({
            "brand_id":          br[1],
            "brand_name":        br[2],
            "sku":               br[3] or "—",
            "unit_cost":         float(br[11]) if br[11] is not None else 0.0,
            "selling_price":     float(br[4] or 0),
            "qty":               int(br[5] or 0),
            "uom":               br[8] or "—",
            "inventory_brand_id": br[9],
            "nearest_expiry":    br[10].isoformat() if br[10] else None,
        })

    suppliers_map: dict = {}
    for sr in supplier_rows:
        inv_id = str(sr[0])
        suppliers_map.setdefault(inv_id, []).append({
            "supplier_id": sr[1],
            "supplier_name": sr[2],
            "contact_person": sr[3] or "",
            "contact_number": sr[4] or "",
        })

    result = []
    for r in rows:
        inv_id      = str(r[0])
        total_qty   = int(r[2] or 0)
        low_stock   = int(r[6] or 0)
        status_code = r[7] or ""

        if status_code == "ARCHIVED":
            dynamic_status = r[4] or "Archived"
        elif total_qty == 0:
            dynamic_status = "Out of Stock"
        elif low_stock > 0 and total_qty <= low_stock:
            dynamic_status = "Low Stock"
        else:
            dynamic_status = "Available"

        result.append({
            "id":          inv_id,
            "item_name":   r[1],
            "qty":         total_qty,
            "uom":         r[3] or "—",
            "status":      dynamic_status,
            "is_archived": status_code == "ARCHIVED",
            "brands":      brands_map.get(inv_id, []),
            "suppliers":   suppliers_map.get(inv_id, []),
        })

    return jsonify(result)

@inventory_bp.route("/api/inventory/<string:id>", methods=["GET"])
def get_inventory_item(id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Aggregate lead_time / min_order / reorder from the first brand's action row
        cur.execute("""
            SELECT
                i.inventory_id,
                i.item_name,
                COALESCE(
                    (SELECT u2.uom_name
                     FROM inventory_brand ib2
                     JOIN unit_of_measure u2 ON ib2.uom_id = u2.uom_id
                     WHERE ib2.inventory_id = i.inventory_id
                     LIMIT 1),
                    'Select'
                )                           AS uom,
                COALESCE(ia.lead_time_days, 0)  AS lead_time_days,
                COALESCE(ia.min_order_qty, 0)   AS min_order_qty,
                COALESCE(ia.reorder_qty, 0)     AS reorder_qty
            FROM inventory i
            LEFT JOIN inventory_brand ib ON ib.inventory_id = i.inventory_id
            LEFT JOIN inventory_action ia
                ON ia.inventory_brand_id = ib.inventory_brand_id
            WHERE i.inventory_id = %s
            ORDER BY ib.inventory_brand_id ASC
            LIMIT 1
        """, (id,))
        r = cur.fetchone()
        if not r:
            return jsonify({"error": "Item not found"}), 404

        cur.execute("""
            SELECT
                b.brand_id,
                COALESCE(b.brand_name, 'Generic')  AS brand_name,
                ib.item_sku,
                ib.item_selling_price,
                COALESCE((
                    SELECT SUM(bat.quantity_on_hand)
                    FROM   inventory_batch bat
                    WHERE  bat.inventory_brand_id = ib.inventory_brand_id
                      AND  bat.batch_status_id    = 15
                ), 0)                              AS qty_on_hand,
                ib.item_description,
                u.uom_name,
                COALESCE(ia.reorder_qty, 0)        AS reorder_qty,
                ib.inventory_brand_id,
                (
                    SELECT MIN(bat.expiry_date)
                    FROM   inventory_batch bat
                    WHERE  bat.inventory_brand_id = ib.inventory_brand_id
                      AND  bat.quantity_on_hand   > 0
                      AND  bat.batch_status_id    = 15
                )                                  AS nearest_expiry,
                (
                    SELECT bat.unit_cost
                    FROM   inventory_batch bat
                    WHERE  bat.inventory_brand_id = ib.inventory_brand_id
                      AND  bat.quantity_on_hand   > 0
                      AND  bat.batch_status_id    = 15
                    ORDER BY bat.expiry_date ASC NULLS LAST, bat.batch_id ASC
                    LIMIT 1
                )                                  AS fefo_cost
            FROM inventory_brand ib
            LEFT JOIN brand b ON ib.brand_id = b.brand_id
            LEFT JOIN unit_of_measure u ON ib.uom_id = u.uom_id
            LEFT JOIN inventory_action ia
                ON ia.inventory_brand_id = ib.inventory_brand_id
            WHERE ib.inventory_id = %s
            ORDER BY ib.inventory_brand_id ASC
        """, (id,))
        brands_list = [
            {
                "inventory_brand_id": row[8],
                "brand_id":           row[0],
                "brand_name":         row[1],
                "sku":                row[2] or "",
                "unit_cost":          float(row[10]) if row[10] is not None else 0.0,
                "selling_price":      float(row[3] or 0),
                "qty":                int(row[4] or 0),
                "description":        row[5] or "",
                "uom":                row[6] or "Select",
                "reorder_point":      int(row[7] or 0),
                "nearest_expiry":     row[9].isoformat() if row[9] else None,
            }
            for row in cur.fetchall()
        ]

        cur.execute("""
            SELECT DISTINCT
                s.supplier_id,
                s.supplier_name,
                s.contact_person,
                s.supplier_contact
            FROM inventory_brand ib
            JOIN inventory_brand_supplier ibs
                ON ibs.inventory_brand_id = ib.inventory_brand_id
            JOIN supplier s ON s.supplier_id = ibs.supplier_id
            WHERE ib.inventory_id = %s
        """, (id,))
        suppliers_list = [
            {
                "supplier_id":    row[0],
                "supplier_name":  row[1] or "",
                "contact_person": row[2] or "",
                "contact_number": row[3] or "",
                "isPrimary":      idx == 0,
            }
            for idx, row in enumerate(cur.fetchall())
        ]

        return jsonify({
            "id":           r[0],
            "itemName":     r[1],
            "uom":          r[2] or "Select",
            "leadTime":     r[3],
            "minOrder":     r[4],
            "reorderPoint": r[5],
            "brands":       brands_list,
            "suppliers":    suppliers_list,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory/add", methods=["POST"])
def add_inventory_batch():
    conn = get_connection()
    cur = conn.cursor()
    try:
        items = request.get_json()
        if not items or not isinstance(items, list):
            return jsonify({"error": "Invalid data format."}), 400

        available_status_id = _get_status_id(cur, 'AVAILABLE')

        for item in items:
            item_name = (item.get('itemName') or '').strip()
            if not item_name:
                raise Exception("Item name is required.")

            brand_variants = item.get('brands', [])
            if not brand_variants:
                raise Exception(f"At least one brand variant is required for '{item_name}'.")

            resolved_suppliers = []
            for sup in item.get('suppliers', []):
                sup_id = _resolve_supplier(cur, sup.get('supplierName'))
                if sup_id:
                    resolved_suppliers.append({
                        "supplier_id": sup_id,
                        "leadTime": int(sup.get('leadTime') or 0),
                        "minOrder":  int(sup.get('minOrder')  or 0),
                    })
            if not resolved_suppliers:
                raise Exception(f"At least one supplier is required for '{item_name}'.")

            for bv in brand_variants:
                if int(bv.get('qty', 0)) <= 0:
                    raise Exception(f"Quantity must be greater than 0 for each brand variant under '{item_name}'.")

            cur.execute("""
                INSERT INTO inventory (item_name, item_status_id)
                VALUES (%s, %s)
                RETURNING inventory_id
            """, (item_name, available_status_id))
            new_inventory_id = cur.fetchone()[0]

            for bv in brand_variants:
                brand_id = _resolve_brand(cur, bv.get('brand_id'), bv.get('brand_name'))
                uom_id   = _resolve_uom(cur, bv.get('uom'))
                description = (bv.get('itemDescription') or '').strip() or None

                cur.execute("""
                    INSERT INTO inventory_brand
                        (inventory_id, brand_id, item_sku,
                         item_selling_price, uom_id,
                         item_status_id, item_description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING inventory_brand_id
                """, (
                    new_inventory_id,
                    brand_id,
                    bv.get('sku') or None,
                    float(bv.get('selling_price', 0)),
                    uom_id,
                    available_status_id,
                    description,
                ))
                new_brand_id = cur.fetchone()[0]

                # Create the initial batch record (unit_price → unit_cost, shelf_life → expiry_date)
                active_batch_status_id = _get_status_id(cur, 'ACTIVE', 'BATCH_STATUS')
                qty_received = int(bv.get('qty', 0))
                cur.execute("""
                    INSERT INTO inventory_batch
                        (inventory_brand_id, batch_number, quantity_received,
                         quantity_on_hand, unit_cost, expiry_date, batch_status_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    new_brand_id,
                    bv.get('sku') or None,
                    qty_received,
                    qty_received,
                    float(bv.get('unit_price', 0)),
                    _parse_shelf_life(bv.get('shelf_life')),
                    active_batch_status_id,
                ))

                for sup in resolved_suppliers:
                    cur.execute("""
                        INSERT INTO inventory_brand_supplier (inventory_brand_id, supplier_id)
                        VALUES (%s, %s)
                    """, (new_brand_id, sup['supplier_id']))

                primary = resolved_suppliers[0]
                cur.execute("""
                    INSERT INTO inventory_action
                        (inventory_brand_id, action_date, low_stock_qty,
                         reorder_qty, min_order_qty, lead_time_days)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    new_brand_id,
                    datetime.now(),
                    int(bv.get('reorderPoint', 0)),
                    int(bv.get('reorderPoint', 0)),
                    primary['minOrder'],
                    primary['leadTime'],
                ))

        conn.commit()
        return jsonify({"message": f"Successfully saved {len(items)} item(s)"}), 201

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory/update/<int:inventory_id>", methods=["PUT", "OPTIONS"], strict_slashes=False)
def update_inventory_item(inventory_id):
    if request.method == "OPTIONS":
        return "", 200

    id = inventory_id
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()

        resolved_suppliers = []
        for sup in data.get('suppliers', []):
            sup_id = _resolve_supplier(cur, sup.get('supplierName'))
            if sup_id:
                resolved_suppliers.append({
                    "supplier_id": sup_id,
                    "leadTime": int(sup.get('leadTime') or 0),
                    "minOrder":  int(sup.get('minOrder')  or 0),
                })
        if not resolved_suppliers:
            return jsonify({"error": "At least one supplier is required."}), 400

        for bv in data.get('brands', []):
            new_qty = int(bv.get('qty', 0))
            stock_action = bv.get('stockAction', 'set')
            stock_delta  = int(bv.get('stockDelta') or 0)
            if stock_action == 'add':
                effective_qty = new_qty + stock_delta
            elif stock_action == 'remove':
                effective_qty = max(0, new_qty - stock_delta)
            else:
                effective_qty = new_qty
            if effective_qty <= 0 and not bv.get('inventory_brand_id'):
                return jsonify({"error": "Quantity must be greater than 0 for each new brand variant."}), 400

        primary_supplier = resolved_suppliers[0]

        cur.execute(
            "UPDATE inventory SET item_name = %s WHERE inventory_id = %s",
            (data.get('itemName'), id)
        )

        available_status_id = _get_status_id(cur, 'AVAILABLE')

        cur.execute(
            "SELECT inventory_brand_id FROM inventory_brand WHERE inventory_id = %s",
            (id,)
        )
        existing_ids = {row[0] for row in cur.fetchall()}

        incoming_ids = {
            int(bv['inventory_brand_id'])
            for bv in data.get('brands', [])
            if bv.get('inventory_brand_id')
        }

        to_delete = existing_ids - incoming_ids
        if to_delete:
            _remove_variants(cur, list(to_delete))

        archived_status_id = _get_status_id(cur, "ARCHIVED")

        for bv in data.get('brands', []):
            brand_id    = _resolve_brand(cur, bv.get('brand_id'), bv.get('brand_name'))
            uom_id      = _resolve_uom(cur, bv.get('uom'))
            description = (bv.get('itemDescription') or bv.get('description') or '').strip() or None
            reorder_pt  = int(bv.get('reorderPoint', 0))
            new_qty     = int(bv.get('qty', 0))

            stock_action = bv.get('stockAction', 'set')
            stock_delta  = int(bv.get('stockDelta') or 0)
            if stock_action == 'add' and stock_delta:
                new_qty = new_qty + stock_delta
            elif stock_action == 'remove' and stock_delta:
                new_qty = max(0, new_qty - stock_delta)
            new_qty = max(0, new_qty)

            ibid = bv.get('inventory_brand_id')
            if ibid is not None:
                try:
                    ibid = int(ibid)
                except (ValueError, TypeError):
                    ibid = None

            if ibid is not None:
                cur.execute("""
                    SELECT 1 FROM inventory_brand
                    WHERE  inventory_id          = %s
                      AND  brand_id              = %s
                      AND  uom_id                = %s
                      AND  item_description IS NOT DISTINCT FROM %s
                      AND  inventory_brand_id   != %s
                    LIMIT 1
                """, (id, brand_id, uom_id, description, ibid))
                if cur.fetchone():
                    raise ValueError("PYTHON CHECK (UPDATE): You cannot edit this variant to match an existing one (it may be Archived).")

                raw_sku = bv.get('sku') or None
                if isinstance(raw_sku, str) and raw_sku.strip().lower() == 'auto-generated':
                    raw_sku = None

                cur.execute("""
                    UPDATE inventory_brand SET
                        brand_id           = %s,
                        item_selling_price = %s,
                        uom_id             = %s,
                        item_description   = %s
                    WHERE inventory_brand_id = %s
                      AND inventory_id = %s
                """, (
                    brand_id,
                    float(bv.get('selling_price', 0)),
                    uom_id,
                    description,
                    ibid,
                    id,
                ))

                cur.execute("""
                    UPDATE inventory_action SET
                        low_stock_qty  = %s,
                        reorder_qty    = %s,
                        min_order_qty  = %s,
                        lead_time_days = %s,
                        action_date    = %s
                    WHERE inventory_brand_id = %s
                """, (reorder_pt, reorder_pt, primary_supplier['minOrder'],
                      primary_supplier['leadTime'], datetime.now(), ibid))
                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO inventory_action
                            (inventory_brand_id, action_date, low_stock_qty,
                             reorder_qty, min_order_qty, lead_time_days)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (ibid, datetime.now(), reorder_pt, reorder_pt,
                          primary_supplier['minOrder'], primary_supplier['leadTime']))

                cur.execute("DELETE FROM inventory_brand_supplier WHERE inventory_brand_id = %s", (ibid,))
                for sup in resolved_suppliers:
                    cur.execute("INSERT INTO inventory_brand_supplier (inventory_brand_id, supplier_id) VALUES (%s, %s)",
                                (ibid, sup['supplier_id']))

            else:
                cur.execute("""
                    SELECT inventory_brand_id, item_status_id FROM inventory_brand
                    WHERE  inventory_id          = %s
                      AND  brand_id              = %s
                      AND  uom_id                = %s
                      AND  item_description IS NOT DISTINCT FROM %s
                    LIMIT 1
                """, (id, brand_id, uom_id, description))
                existing_row = cur.fetchone()

                if existing_row:
                    existing_ibid, existing_status_id = existing_row
                    if existing_status_id == archived_status_id:
                        cur.execute("""
                            UPDATE inventory_brand SET
                                item_status_id     = %s,
                                item_selling_price = %s
                            WHERE inventory_brand_id = %s
                        """, (available_status_id, float(bv.get('selling_price', 0)), existing_ibid))

                        cur.execute("""
                            UPDATE inventory_action SET
                                low_stock_qty  = %s,
                                reorder_qty    = %s,
                                min_order_qty  = %s,
                                lead_time_days = %s,
                                action_date    = %s
                            WHERE inventory_brand_id = %s
                        """, (reorder_pt, reorder_pt, primary_supplier['minOrder'],
                              primary_supplier['leadTime'], datetime.now(), existing_ibid))
                        if cur.rowcount == 0:
                            cur.execute("""
                                INSERT INTO inventory_action
                                    (inventory_brand_id, action_date, low_stock_qty,
                                     reorder_qty, min_order_qty, lead_time_days)
                                VALUES (%s, %s, %s, %s, %s, %s)
                            """, (existing_ibid, datetime.now(), reorder_pt, reorder_pt,
                                  primary_supplier['minOrder'], primary_supplier['leadTime']))

                        cur.execute("DELETE FROM inventory_brand_supplier WHERE inventory_brand_id = %s", (existing_ibid,))
                        for sup in resolved_suppliers:
                            cur.execute("INSERT INTO inventory_brand_supplier (inventory_brand_id, supplier_id) VALUES (%s, %s)",
                                        (existing_ibid, sup['supplier_id']))
                    else:
                        raise ValueError("PYTHON CHECK (INSERT): A variant with this Brand + UOM + Description already exists.")
                else:
                    cur.execute("""
                        INSERT INTO inventory_brand
                            (inventory_id, brand_id, item_selling_price,
                             uom_id, item_status_id, item_description)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING inventory_brand_id
                    """, (id, brand_id, float(bv.get('selling_price', 0)),
                          uom_id, available_status_id, description))
                    new_ibid = cur.fetchone()[0]

                    for sup in resolved_suppliers:
                        cur.execute("INSERT INTO inventory_brand_supplier (inventory_brand_id, supplier_id) VALUES (%s, %s)",
                                    (new_ibid, sup['supplier_id']))

                    cur.execute("""
                        INSERT INTO inventory_action
                            (inventory_brand_id, action_date, low_stock_qty,
                             reorder_qty, min_order_qty, lead_time_days)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (new_ibid, datetime.now(), reorder_pt, reorder_pt,
                          primary_supplier['minOrder'], primary_supplier['leadTime']))

        conn.commit()
        return jsonify({"message": "Item updated successfully"}), 200

    except ValueError as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        conn.rollback()
        if getattr(e, 'pgcode', None) == '23505':
            detail = getattr(getattr(e, 'diag', None), 'message_detail', '') or ''
            if 'item_sku' in detail:
                error_msg = "DB CONSTRAINT: That SKU is already in use by another item."
            else:
                error_msg = f"DB CONSTRAINT 23505: {detail}"
            return jsonify({"error": error_msg}), 409
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory/<int:inventory_id>", methods=["PUT"])
def upsert_inventory(inventory_id):
    conn = get_connection()
    cur  = conn.cursor()
    try:
        data     = request.get_json(force=True) or {}
        variants = data.get("variants")

        if not isinstance(variants, list) or len(variants) == 0:
            return jsonify({"error": "'variants' must be a non-empty array."}), 400

        cur.execute(
            "SELECT inventory_id FROM inventory WHERE inventory_id = %s",
            (inventory_id,)
        )
        if not cur.fetchone():
            return jsonify({"error": f"Inventory item {inventory_id} not found."}), 404

        new_name = (data.get("item_name") or "").strip()
        if new_name:
            cur.execute(
                "UPDATE inventory SET item_name = %s WHERE inventory_id = %s",
                (new_name, inventory_id)
            )

        cur.execute(
            "SELECT inventory_brand_id FROM inventory_brand WHERE inventory_id = %s",
            (inventory_id,)
        )
        existing_ids = {row[0] for row in cur.fetchall()}

        incoming_ids = {
            int(v["inventory_brand_id"])
            for v in variants
            if v.get("inventory_brand_id") is not None
        }

        to_delete = existing_ids - incoming_ids
        if to_delete:
            _remove_variants(cur, list(to_delete))

        available_status_id = _get_status_id(cur, "AVAILABLE")

        for v in variants:
            uom_id        = v.get("uom_id")
            reorder_pt    = max(0, int(v.get("reorder_point") or 0))
            price         = float(v.get("price") or 0)
            selling_price = float(v.get("selling_price") if v.get("selling_price") is not None else price)

            if not uom_id:
                raise ValueError("Every variant requires a 'uom_id'.")

            ibid = v.get("inventory_brand_id")

            if ibid is not None:
                ibid = int(ibid)
                cur.execute(
                    "SELECT brand_id, item_description "
                    "FROM   inventory_brand "
                    "WHERE  inventory_brand_id = %s AND inventory_id = %s",
                    (ibid, inventory_id)
                )
                existing = cur.fetchone()
                if not existing:
                    raise ValueError(
                        f"Variant {ibid} does not belong to inventory item {inventory_id}."
                    )
                cur_brand_id, cur_desc = existing

                cur.execute("""
                    SELECT 1 FROM inventory_brand
                    WHERE  inventory_id          = %s
                      AND  brand_id              = %s
                      AND  uom_id                = %s
                      AND  item_description IS NOT DISTINCT FROM %s
                      AND  inventory_brand_id   != %s
                      AND  item_status_id != (
                               SELECT status_id FROM static_status
                               WHERE  status_code  = 'ARCHIVED'
                                 AND  status_scope = 'INVENTORY_STATUS'
                           )
                    LIMIT 1
                """, (inventory_id, cur_brand_id, int(uom_id), cur_desc, ibid))
                if cur.fetchone():
                    raise ValueError(
                        "PYTHON CHECK (upsert UPDATE path): A variant with this Brand + UOM + Description already exists."
                    )

                cur.execute("""
                    UPDATE inventory_brand
                    SET    uom_id             = %s,
                           item_selling_price = %s
                    WHERE  inventory_brand_id = %s
                """, (int(uom_id), selling_price, ibid))

                cur.execute("""
                    UPDATE inventory_action
                    SET    low_stock_qty = %s,
                           action_date   = NOW()
                    WHERE  inventory_brand_id = %s
                """, (reorder_pt, ibid))

                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO inventory_action
                               (inventory_brand_id, low_stock_qty, action_date)
                        VALUES (%s, %s, NOW())
                    """, (ibid, reorder_pt))

            else:
                brand_id = v.get("brand_id")
                if not brand_id:
                    raise ValueError("New variants require a 'brand_id'.")

                item_description = v.get("description") or None
                cur.execute("""
                    SELECT inventory_brand_id, item_status_id
                    FROM   inventory_brand
                    WHERE  inventory_id          = %s
                      AND  brand_id              = %s
                      AND  uom_id                = %s
                      AND  item_description IS NOT DISTINCT FROM %s
                    LIMIT 1
                """, (inventory_id, int(brand_id), int(uom_id), item_description))
                existing_row = cur.fetchone()

                archived_status_id = _get_status_id(cur, "ARCHIVED")

                if existing_row:
                    existing_ibid, existing_status_id = existing_row
                    if existing_status_id == archived_status_id:
                        cur.execute("""
                            UPDATE inventory_brand
                            SET    item_status_id     = %s,
                                   item_selling_price = %s
                            WHERE  inventory_brand_id = %s
                        """, (available_status_id, selling_price, existing_ibid))

                        cur.execute("""
                            UPDATE inventory_action
                            SET    low_stock_qty = %s,
                                   action_date   = NOW()
                            WHERE  inventory_brand_id = %s
                        """, (reorder_pt, existing_ibid))
                        if cur.rowcount == 0:
                            cur.execute("""
                                INSERT INTO inventory_action
                                       (inventory_brand_id, low_stock_qty, action_date)
                                VALUES (%s, %s, NOW())
                            """, (existing_ibid, reorder_pt))
                    else:
                        raise ValueError(
                            "PYTHON CHECK (upsert INSERT path): A variant with this Brand + UOM + Description already exists."
                        )
                else:
                    cur.execute("""
                        INSERT INTO inventory_brand
                               (inventory_id, brand_id, uom_id,
                                item_selling_price, item_status_id)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING inventory_brand_id
                    """, (
                        inventory_id,
                        int(brand_id),
                        int(uom_id),
                        selling_price,
                        available_status_id,
                    ))
                    new_ibid = cur.fetchone()[0]

                    cur.execute("""
                        INSERT INTO inventory_action
                               (inventory_brand_id, low_stock_qty, action_date)
                        VALUES (%s, %s, NOW())
                    """, (new_ibid, reorder_pt))

        conn.commit()
        return jsonify({
            "message":      "Inventory item updated successfully.",
            "inventory_id": inventory_id,
        }), 200

    except ValueError as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        conn.rollback()
        if getattr(e, 'pgcode', None) == '23505':
            err_detail = getattr(e.diag, 'message_detail', '') if hasattr(e, 'diag') else str(e)
            if 'item_sku' in err_detail:
                return jsonify({"error": "DB CONSTRAINT: That SKU is already in use by another item."}), 409
            return jsonify({"error": f"DB CONSTRAINT 23505: {err_detail}"}), 409
        import traceback; traceback.print_exc()
        return jsonify({"error": "Internal server error.", "detail": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory/archive/<string:inventory_id>", methods=["PUT", "OPTIONS"])
def toggle_inventory_archive(inventory_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT ss.status_code
            FROM inventory i
            JOIN static_status ss
                ON i.item_status_id = ss.status_id
               AND ss.status_scope = 'INVENTORY_STATUS'
            WHERE i.inventory_id = %s
            LIMIT 1
        """, (inventory_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Item not found."}), 404

        current_code = row[0]

        if current_code == 'ARCHIVED':
            new_status_id = _get_status_id(cur, 'AVAILABLE')
            is_archived   = False
            action_msg    = "Restored from Archive"
        else:
            new_status_id = _get_status_id(cur, 'ARCHIVED')
            is_archived   = True
            action_msg    = "Moved to Archive"

            cur.execute("""
                UPDATE inventory_action ia
                SET    low_stock_qty = 0,
                       reorder_qty   = 0
                FROM   inventory_brand ib
                WHERE  ia.inventory_brand_id = ib.inventory_brand_id
                  AND  ib.inventory_id = %s
            """, (inventory_id,))

        cur.execute(
            "UPDATE inventory SET item_status_id = %s WHERE inventory_id = %s",
            (new_status_id, inventory_id)
        )
        if cur.rowcount == 0:
            raise Exception("Update blocked — check RLS policies.")

        conn.commit()
        return jsonify({
            "message":     action_msg,
            "is_archived": is_archived,
        }), 200

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory/summary", methods=["GET"])
def get_inventory_summary():
    conn = get_connection()
    cur = conn.cursor()
    try:
        today             = date.today()
        this_month_start  = today.replace(day=1)
        last_month_end    = this_month_start - timedelta(days=1)
        last_month_start  = last_month_end.replace(day=1)

        try:
            last_month_same_day = last_month_start.replace(day=today.day)
        except ValueError:
            last_month_same_day = last_month_end

        def get_movement(start_date, end_date=None):
            query  = """
                SELECT COALESCE(SUM(od.order_quantity), 0)
                FROM order_details od
                JOIN order_transaction ot ON od.order_id = ot.order_id
                WHERE ot.order_date >= %s
            """
            params = [start_date]
            if end_date:
                query += " AND ot.order_date <= %s"
                params.append(end_date)
            cur.execute(query, params)
            return float(cur.fetchone()[0])

        monthly_mtd      = get_movement(this_month_start)
        last_monthly_mtd = get_movement(last_month_start, last_month_same_day)

        if last_monthly_mtd == 0:
            total_products_change = 100.0 if monthly_mtd > 0 else 0.0
        else:
            total_products_change = round(
                ((monthly_mtd - last_monthly_mtd) / last_monthly_mtd) * 100, 1
            )

        cur.execute("""
            SELECT
                COALESCE(SUM(od.order_quantity)
                    FILTER (WHERE ot.order_date >= NOW() - INTERVAL '7 days'),  0) AS weekly,
                COALESCE(SUM(od.order_quantity)
                    FILTER (WHERE ot.order_date >= NOW() - INTERVAL '30 days'), 0) AS monthly,
                COALESCE(SUM(od.order_quantity)
                    FILTER (WHERE ot.order_date >= NOW() - INTERVAL '1 year'),  0) AS yearly
            FROM order_details od
            JOIN order_transaction ot ON od.order_id = ot.order_id
        """)
        row = cur.fetchone()

        return jsonify({
            "weekly":               int(row[0]),
            "monthly":              int(row[1]),
            "yearly":               int(row[2]),
            "totalProductsChange":  total_products_change,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"weekly": 0, "monthly": 0, "yearly": 0, "totalProductsChange": 0.0}), 200
    finally:
        cur.close()
        conn.close()


@inventory_bp.route("/api/inventory/batches/receive", methods=["POST"])
def receive_inventory_batch():
    """
    Record a new stock receipt into inventory_batch.
    Batch number is auto-generated as BTCH-[YYMM]-[batch_id].
    batch_status_id defaults to 15 (Active).
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        data               = request.get_json()
        inventory_brand_id = data.get("inventory_brand_id")
        quantity_received  = int(data.get("quantity_received") or 0)
        unit_cost          = float(data.get("unit_cost") or 0)
        expiry_date        = data.get("expiry_date") or None

        if not inventory_brand_id:
            return jsonify({"error": "inventory_brand_id is required."}), 400
        if quantity_received <= 0:
            return jsonify({"error": "quantity_received must be greater than 0."}), 400

        # Insert without batch_number first so we have the PK for the pattern
        cur.execute("""
            INSERT INTO inventory_batch
                (inventory_brand_id, quantity_received,
                 quantity_on_hand, unit_cost, expiry_date, batch_status_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING batch_id
        """, (
            int(inventory_brand_id),
            quantity_received,
            quantity_received,
            unit_cost,
            expiry_date,
            BATCH_STATUS_ACTIVE,
        ))
        batch_id     = cur.fetchone()[0]
        yymm         = datetime.now().strftime('%y%m')
        batch_number = f"BTCH-{yymm}-{batch_id:04d}"

        cur.execute(
            "UPDATE inventory_batch SET batch_number = %s WHERE batch_id = %s",
            (batch_number, batch_id)
        )
        conn.commit()
        return jsonify({
            "message":      "Batch received successfully.",
            "batch_id":     batch_id,
            "batch_number": batch_number,
        }), 201

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@inventory_bp.route("/api/inventory/batches/<int:brand_id>", methods=["GET"])
def get_inventory_batches(brand_id):
    """Return all active batches for a brand variant, ordered FEFO."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                batch_id,
                batch_number,
                quantity_received,
                quantity_on_hand,
                unit_cost,
                expiry_date
            FROM  inventory_batch
            WHERE inventory_brand_id = %s
              AND batch_status_id    = %s
            ORDER BY expiry_date ASC NULLS LAST, batch_id ASC
        """, (brand_id, BATCH_STATUS_ACTIVE))
        rows = cur.fetchall()
        return jsonify([
            {
                "batch_id":          row[0],
                "batch_number":      row[1] or "",
                "quantity_received": int(row[2] or 0),
                "quantity_on_hand":  int(row[3] or 0),
                "unit_cost":         float(row[4] or 0),
                "expiry_date":       row[5].isoformat() if row[5] else None,
            }
            for row in rows
        ]), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@inventory_bp.route("/api/inventory/grouped", methods=["GET"])
def get_inventory_grouped():
    """
    Returns every non-archived inventory_brand variant with its active batches
    nested as an array. Batches are ordered FEFO (soonest expiry first) and
    only rows where quantity_on_hand > 0 are included.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                ib.inventory_brand_id,
                i.inventory_id,
                i.item_name,
                COALESCE(b.brand_name, 'No Brand')  AS brand_name,
                COALESCE(ib.item_sku, '')            AS item_sku,
                COALESCE(ib.item_description, '')    AS item_description,
                COALESCE(u.uom_name, '')             AS uom_name,
                bat.batch_id,
                COALESCE(bat.batch_number, '')       AS batch_number,
                bat.quantity_on_hand,
                bat.manufactured_date,
                bat.expiry_date,
                bat.unit_cost
            FROM inventory i
            JOIN inventory_brand ib ON ib.inventory_id = i.inventory_id
            LEFT JOIN brand           b ON b.brand_id  = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id    = ib.uom_id
            LEFT JOIN inventory_batch bat
                ON  bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.quantity_on_hand   > 0
                AND bat.batch_status_id    = %s
            WHERE ib.item_status_id NOT IN (
                SELECT status_id FROM static_status
                WHERE  status_scope = 'INVENTORY_STATUS'
                  AND  status_code  = 'ARCHIVED'
            )
            ORDER BY
                i.item_name                         ASC,
                COALESCE(b.brand_name, 'No Brand')  ASC,
                bat.expiry_date                     ASC NULLS LAST
        """, (BATCH_STATUS_ACTIVE,))
        rows = cur.fetchall()

        groups: dict = {}
        order:  list = []
        for r in rows:
            ibid = r[0]
            if ibid not in groups:
                groups[ibid] = {
                    "inventory_brand_id": ibid,
                    "inventory_id":       r[1],
                    "item_name":          r[2],
                    "brand_name":         r[3],
                    "item_sku":           r[4],
                    "item_description":   r[5],
                    "uom_name":           r[6],
                    "total_quantity":     0,
                    "batches":            [],
                }
                order.append(ibid)

            if r[7] is not None:        # batch_id (NULL when no active batches)
                qty = int(r[9] or 0)
                groups[ibid]["total_quantity"] += qty
                groups[ibid]["batches"].append({
                    "batch_id":          r[7],
                    "batch_number":      r[8],
                    "quantity_on_hand":  qty,
                    "manufactured_date": r[10].isoformat() if r[10] else None,
                    "expiry_date":       r[11].isoformat() if r[11] else None,
                    "unit_cost":         float(r[12] or 0),
                })

        return jsonify([groups[k] for k in order]), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@inventory_bp.route("/api/inventory/expired-warning", methods=["GET"])
def get_expired_warning():
    """
    Return active batch lines expiring within the next 30 days that still
    have stock on hand. Results ordered by soonest expiry first.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                i.inventory_id,
                i.item_name,
                COALESCE(b.brand_name, 'No Brand') AS brand_name,
                COALESCE(u.uom_name, '')           AS uom,
                bat.batch_id,
                bat.batch_number,
                bat.quantity_on_hand,
                bat.unit_cost,
                bat.expiry_date,
                (bat.expiry_date - CURRENT_DATE)   AS days_until_expiry
            FROM  inventory_batch  bat
            JOIN  inventory_brand  ib  ON ib.inventory_brand_id = bat.inventory_brand_id
            JOIN  inventory        i   ON i.inventory_id        = ib.inventory_id
            LEFT JOIN brand        b   ON b.brand_id            = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id             = ib.uom_id
            WHERE bat.batch_status_id  = %s
              AND bat.quantity_on_hand > 0
              AND bat.expiry_date IS NOT NULL
              AND bat.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY bat.expiry_date ASC, bat.batch_id ASC
        """, (BATCH_STATUS_ACTIVE,))
        rows = cur.fetchall()
        return jsonify([
            {
                "inventory_id":      row[0],
                "item_name":         row[1],
                "brand_name":        row[2],
                "uom":               row[3],
                "batch_id":          row[4],
                "batch_number":      row[5] or "",
                "quantity_on_hand":  int(row[6] or 0),
                "unit_cost":         float(row[7] or 0),
                "expiry_date":       row[8].isoformat() if row[8] else None,
                "days_until_expiry": int(row[9]) if row[9] is not None else None,
            }
            for row in rows
        ]), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@inventory_bp.route("/api/inventory/stagnant", methods=["GET"])
def get_stagnant_inventory():
    """
    Get stagnant (dead stock) items:
    - Items with 0 quantity on hand
    - Haven't been sold in the last 6 months (or never sold)
    - Haven't been ordered (PO) in the last 6 months (or never ordered)
    - Current status is NOT archived
    
    Returns JSON array with: inventory_brand_id, item_name, item_description,
                             last_sold_date, last_ordered_date
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Get the ARCHIVED status ID to filter it out
        archived_status = _get_status_id(cur, "ARCHIVED", "INVENTORY_STATUS")
        
        six_months_ago = (date.today() - timedelta(days=180)).isoformat()
        
        cur.execute("""
            SELECT 
                ib.inventory_brand_id,
                i.item_name,
                COALESCE(ib.item_description, '') AS item_description,
                MAX(st.sales_date) AS last_sold_date,
                MAX(poi.date_created) AS last_ordered_date
            FROM inventory_brand ib
            JOIN inventory i ON i.inventory_id = ib.inventory_id
            
            -- LEFT JOIN to get total quantity on hand
            LEFT JOIN (
                SELECT inventory_brand_id, SUM(quantity_on_hand) as total_qty
                FROM inventory_batch
                GROUP BY inventory_brand_id
            ) bat ON bat.inventory_brand_id = ib.inventory_brand_id
            
            -- LEFT JOIN to get last sales date via order_details
            LEFT JOIN order_details od ON od.inventory_brand_id = ib.inventory_brand_id
            LEFT JOIN sales_transaction st ON st.order_id = od.order_id
            
            -- LEFT JOIN to get last purchase order date
            LEFT JOIN purchase_order_item poi ON poi.inventory_brand_id = ib.inventory_brand_id
            
            WHERE 
                -- Not archived
                ib.item_status_id != %s
                -- Has zero stock
                AND (bat.total_qty IS NULL OR bat.total_qty = 0)
                -- No sales in last 6 months (or never sold)
                AND (st.sales_date IS NULL OR st.sales_date < %s)
                -- No purchase orders in last 6 months (or never ordered)
                AND (poi.date_created IS NULL OR poi.date_created < %s)
            
            GROUP BY 
                ib.inventory_brand_id,
                i.item_name,
                ib.item_description
            ORDER BY i.item_name ASC
        """, (archived_status, six_months_ago, six_months_ago))
        
        rows = cur.fetchall()
        return jsonify([
            {
                "inventory_brand_id": row[0],
                "item_name": row[1],
                "item_description": row[2],
                "last_sold_date": row[3].isoformat() if row[3] else None,
                "last_ordered_date": row[4].isoformat() if row[4] else None,
            }
            for row in rows
        ]), 200
    
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@inventory_bp.route("/api/inventory/<int:brand_id>/archive", methods=["PATCH"])
@require_purchase_access
def archive_stagnant_item(brand_id):
    """
    Archive a stagnant inventory item by setting its item_status_id to ARCHIVED.
    Requires purchase access (Super Admin, Manager, or Inventory Head).
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Get the ARCHIVED status ID
        archived_status = _get_status_id(cur, "ARCHIVED", "INVENTORY_STATUS")
        
        # Update the item status to ARCHIVED
        cur.execute(
            """
            UPDATE inventory_brand
            SET item_status_id = %s
            WHERE inventory_brand_id = %s
            RETURNING inventory_brand_id, item_status_id
            """,
            (archived_status, brand_id)
        )
        
        result = cur.fetchone()
        if not result:
            return jsonify({"error": "Item not found"}), 404
        
        conn.commit()
        return jsonify({
            "message": "Item archived successfully",
            "inventory_brand_id": result[0],
            "new_status_id": result[1]
        }), 200
    
    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
