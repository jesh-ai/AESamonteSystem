from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import datetime, date, timedelta

inventory_bp = Blueprint("inventory", __name__)

# ─────────────────────────── HELPERS ───────────────────────────

def _get_status_id(cur, code):
    """Resolve status_id for INVENTORY_STATUS scope."""
    cur.execute(
        "SELECT status_id FROM static_status "
        "WHERE status_scope = 'INVENTORY_STATUS' AND status_code = %s LIMIT 1",
        (code,)
    )
    row = cur.fetchone()
    if not row:
        raise Exception(f"Status code '{code}' not found in static_status.")
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

    # Which of these IDs are still referenced by order_details?
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
            "DELETE FROM inventory_action        WHERE inventory_brand_id = ANY(%s)",
            (to_hard_delete,)
        )
        cur.execute(
            "DELETE FROM inventory_brand_supplier WHERE inventory_brand_id = ANY(%s)",
            (to_hard_delete,)
        )
        cur.execute(
            "DELETE FROM inventory_brand          WHERE inventory_brand_id = ANY(%s)",
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


# ─────────────────────────── LOOKUPS ───────────────────────────

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


# ─────────────────────────── GET INVENTORY LIST ───────────────────────────

@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Main inventory rows with aggregate quantity and low_stock threshold
        cur.execute("""
            SELECT
                i.inventory_id,
                i.item_name,
                COALESCE(SUM(ib.total_quantity), 0)       AS total_quantity,
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
                COALESCE(
                    (SELECT ia2.reorder_qty
                     FROM inventory_brand ib2
                     JOIN inventory_action ia2 ON ia2.inventory_brand_id = ib2.inventory_brand_id
                     WHERE ib2.inventory_id = i.inventory_id
                     LIMIT 1),
                    0
                ) AS low_stock_qty,
                s.status_code
            FROM inventory i
            JOIN static_status s ON i.item_status_id = s.status_id
            LEFT JOIN inventory_brand ib ON ib.inventory_id = i.inventory_id
            GROUP BY i.inventory_id, i.item_name, s.status_name, s.status_code, i.item_status_id
            ORDER BY i.inventory_id ASC;
        """)
        rows = cur.fetchall()

        # Brand variants with per-brand action data
        cur.execute("""
            SELECT
                ib.inventory_id,
                b.brand_id,
                COALESCE(b.brand_name, 'Generic')  AS brand_name,
                ib.item_sku,
                ib.item_unit_price,
                ib.item_selling_price,
                ib.total_quantity,
                COALESCE(ia.reorder_qty, 0)        AS reorder_qty,
                COALESCE(ia.low_stock_qty, 0)      AS low_stock_qty,
                u.uom_name
            FROM inventory_brand ib
            LEFT JOIN brand b ON ib.brand_id = b.brand_id
            LEFT JOIN inventory_action ia
                ON ia.inventory_brand_id = ib.inventory_brand_id
            LEFT JOIN unit_of_measure u ON ib.uom_id = u.uom_id
            ORDER BY ib.inventory_id, COALESCE(b.brand_name, 'Generic')
        """)
        brand_rows = cur.fetchall()

        # Suppliers linked through inventory_brand
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

    # Build lookup maps
    brands_map: dict = {}
    for br in brand_rows:
        inv_id = str(br[0])
        brands_map.setdefault(inv_id, []).append({
            "brand_id": br[1],
            "brand_name": br[2],
            "sku": br[3] or "—",
            "unit_price": float(br[4] or 0),
            "selling_price": float(br[5] or 0),
            "qty": int(br[6] or 0),
            "uom": br[9] or "—",
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


# ─────────────────────────── GET SINGLE ITEM ───────────────────────────

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
                ib.item_unit_price,
                ib.item_selling_price,
                ib.total_quantity,
                ib.item_description,
                u.uom_name,
                COALESCE(ia.reorder_qty, 0)        AS reorder_qty,
                ib.inventory_brand_id
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
                "inventory_brand_id": row[9],
                "brand_id":           row[0],
                "brand_name":         row[1],
                "sku":                row[2] or "",
                "unit_price":         float(row[3] or 0),
                "selling_price":      float(row[4] or 0),
                "qty":                int(row[5] or 0),
                "description":        row[6] or "",
                "uom":                row[7] or "Select",
                "reorder_point":      int(row[8] or 0),
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


# ─────────────────────────── ADD INVENTORY ───────────────────────────

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

            # Resolve suppliers
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
                raise Exception("At least one supplier is required.")

            # Insert master inventory row (status defaults to AVAILABLE)
            cur.execute("""
                INSERT INTO inventory (item_name, item_status_id)
                VALUES (%s, %s)
                RETURNING inventory_id
            """, (item_name, available_status_id))
            new_inventory_id = cur.fetchone()[0]

            # Insert brand variants + per-brand inventory_action
            for bv in brand_variants:
                brand_id = _resolve_brand(cur, bv.get('brand_id'), bv.get('brand_name'))
                uom_id   = _resolve_uom(cur, bv.get('uom'))
                description = (bv.get('itemDescription') or '').strip() or None

                cur.execute("""
                    INSERT INTO inventory_brand
                        (inventory_id, brand_id, item_sku, item_unit_price,
                         item_selling_price, total_quantity, uom_id,
                         item_status_id, item_description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING inventory_brand_id
                """, (
                    new_inventory_id,
                    brand_id,
                    bv.get('sku') or None,
                    float(bv.get('unit_price', 0)),
                    float(bv.get('selling_price', 0)),
                    int(bv.get('qty', 0)),
                    uom_id,
                    available_status_id,
                    description,
                ))
                new_brand_id = cur.fetchone()[0]

                # Link suppliers to this brand variant
                for sup in resolved_suppliers:
                    cur.execute("""
                        INSERT INTO inventory_brand_supplier (inventory_brand_id, supplier_id)
                        VALUES (%s, %s)
                    """, (new_brand_id, sup['supplier_id']))

                # inventory_action is per inventory_brand
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


# ─────────────────────────── UPDATE INVENTORY (upsert variants) ───────────────────────────

@inventory_bp.route("/api/inventory/update/<int:inventory_id>", methods=["PUT", "OPTIONS"], strict_slashes=False)
def update_inventory_item(inventory_id):
    if request.method == "OPTIONS":
        return "", 200

    id = inventory_id
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()

        # ── 1. Resolve suppliers ──────────────────────────────────────────
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

        primary_supplier = resolved_suppliers[0]

        # ── 2. Update master item name ────────────────────────────────────
        cur.execute(
            "UPDATE inventory SET item_name = %s WHERE inventory_id = %s",
            (data.get('itemName'), id)
        )

        available_status_id = _get_status_id(cur, 'AVAILABLE')

        # ── 3. Identify which existing variants to keep vs delete ─────────
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

        # ── 4. Upsert each variant ────────────────────────────────────────
        archived_status_id = _get_status_id(cur, "ARCHIVED")

        for bv in data.get('brands', []):
            brand_id    = _resolve_brand(cur, bv.get('brand_id'), bv.get('brand_name'))
            uom_id      = _resolve_uom(cur, bv.get('uom'))
            description = (bv.get('itemDescription') or bv.get('description') or '').strip() or None
            reorder_pt  = int(bv.get('reorderPoint', 0))
            new_qty     = int(bv.get('qty', 0))

            # Stock adjustment: frontend sends base qty + delta separately
            stock_action = bv.get('stockAction', 'set')   # 'add' | 'remove' | 'set'
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
                # ── UPDATE existing variant ──────────────────────────────
                # Strict duplicate check: no ARCHIVED filter — editing an active
                # variant to match any existing row (including ghosts) is blocked.
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
                        item_unit_price    = %s,
                        item_selling_price = %s,
                        total_quantity     = %s,
                        uom_id             = %s,
                        item_description   = %s
                    WHERE inventory_brand_id = %s
                      AND inventory_id = %s
                """, (
                    brand_id,
                    float(bv.get('unit_price', 0)),
                    float(bv.get('selling_price', 0)),
                    new_qty,
                    uom_id,
                    description,
                    ibid,
                    id,
                ))

                # Upsert action row for this variant
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

                # Re-link suppliers for this variant
                cur.execute("DELETE FROM inventory_brand_supplier WHERE inventory_brand_id = %s", (ibid,))
                for sup in resolved_suppliers:
                    cur.execute("INSERT INTO inventory_brand_supplier (inventory_brand_id, supplier_id) VALUES (%s, %s)",
                                (ibid, sup['supplier_id']))

            else:
                # ── INSERT / REVIVE variant ──────────────────────────────
                # Check for ANY row with this combination (including ARCHIVED ghosts).
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
                        # ── REVIVE archived ghost ────────────────────────
                        cur.execute("""
                            UPDATE inventory_brand SET
                                item_status_id     = %s,
                                item_unit_price    = %s,
                                item_selling_price = %s,
                                total_quantity     = %s
                            WHERE inventory_brand_id = %s
                        """, (available_status_id, float(bv.get('unit_price', 0)),
                              float(bv.get('selling_price', 0)), new_qty, existing_ibid))

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
                    # ── TRUE INSERT ──────────────────────────────────────
                    cur.execute("""
                        INSERT INTO inventory_brand
                            (inventory_id, brand_id, item_unit_price,
                             item_selling_price, total_quantity, uom_id,
                             item_status_id, item_description)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING inventory_brand_id
                    """, (id, brand_id, float(bv.get('unit_price', 0)),
                          float(bv.get('selling_price', 0)), new_qty, uom_id,
                          available_status_id, description))
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


# ─────────────────────────── PUT /api/inventory/<id>  (canonical upsert) ───────────────────────────
#
# Expected payload:
# {
#   "item_name": "Updated Name",          -- optional, skipped if blank
#   "variants": [
#     { "inventory_brand_id": 1,          -- UPDATE path (existing variant)
#       "uom_id": 2, "price": 100.00,
#       "unit_price": 80.00,              -- optional; falls back to price if omitted
#       "selling_price": 100.00,          -- optional; falls back to price if omitted
#       "new_total_stock": 50,
#       "reorder_point": 10 },
#     { "inventory_brand_id": null,       -- INSERT path (new variant)
#       "brand_id": 3, "uom_id": 4,
#       "price": 150.00, "new_total_stock": 20, "reorder_point": 5 }
#   ]
# }
#
# Variants absent from the payload (existing in DB but not sent) are DELETED.

@inventory_bp.route("/api/inventory/<int:inventory_id>", methods=["PUT"])
def upsert_inventory(inventory_id):
    conn = get_connection()
    cur  = conn.cursor()
    try:
        data     = request.get_json(force=True) or {}
        variants = data.get("variants")

        # ── 1. Validate payload ──────────────────────────────────────────────
        if not isinstance(variants, list) or len(variants) == 0:
            return jsonify({"error": "'variants' must be a non-empty array."}), 400

        # ── 2. Confirm master item exists ────────────────────────────────────
        cur.execute(
            "SELECT inventory_id FROM inventory WHERE inventory_id = %s",
            (inventory_id,)
        )
        if not cur.fetchone():
            return jsonify({"error": f"Inventory item {inventory_id} not found."}), 404

        # ── 3. Update master item name (only when provided) ──────────────────
        new_name = (data.get("item_name") or "").strip()
        if new_name:
            cur.execute(
                "UPDATE inventory SET item_name = %s WHERE inventory_id = %s",
                (new_name, inventory_id)
            )

        # ── 4. Compute the delete set ────────────────────────────────────────
        #   existing = all variant IDs currently in the DB for this item
        #   incoming = variant IDs the client sent back (i.e., "keep these")
        #   to_delete = existing - incoming  →  user removed these from the form
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

        # ── 5. Resolve the AVAILABLE status once (used by INSERT path) ───────
        available_status_id = _get_status_id(cur, "AVAILABLE")

        # ── 6. Upsert loop ───────────────────────────────────────────────────
        for v in variants:
            # --- shared field extraction ---
            uom_id      = v.get("uom_id")
            reorder_pt  = max(0, int(v.get("reorder_point") or 0))
            new_stock   = max(0, int(v.get("new_total_stock") or 0))
            # allow explicit unit_price / selling_price; fall back to generic price
            price        = float(v.get("price") or 0)
            unit_price   = float(v.get("unit_price")   if v.get("unit_price")   is not None else price)
            selling_price = float(v.get("selling_price") if v.get("selling_price") is not None else price)

            if not uom_id:
                raise ValueError("Every variant requires a 'uom_id'.")

            ibid = v.get("inventory_brand_id")

            if ibid is not None:
                # ════════════════════════════════════════════════
                # UPDATE PATH — variant already exists in the DB
                # ════════════════════════════════════════════════
                ibid = int(ibid)

                # Ownership guard + fetch brand/description needed for
                # the duplicate check (these columns are not in the payload
                # because the update path only changes uom/price/stock).
                # Ownership guard + fetch brand/description for the duplicate
                # check.  Fetch item_description raw (no COALESCE) so NULL
                # and '' stay distinct for IS NOT DISTINCT FROM below.
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

                # Duplicate check — exclude self so a pure price/stock change
                # never triggers a false positive. Also skip ARCHIVED variants.
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
                           item_unit_price    = %s,
                           item_selling_price = %s,
                           total_quantity     = %s
                    WHERE  inventory_brand_id = %s
                """, (int(uom_id), unit_price, selling_price, new_stock, ibid))

                # Upsert the action row (UPDATE → INSERT fallback)
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
                # ════════════════════════════════════════════════
                # INSERT PATH — new variant added during editing
                # ════════════════════════════════════════════════
                brand_id = v.get("brand_id")
                if not brand_id:
                    raise ValueError("New variants require a 'brand_id'.")

                item_description = v.get("description") or None

                # Check for ANY existing row with this combination (including ARCHIVED).
                # This lets us revive an archived variant instead of hitting the DB constraint.
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
                        # ── REVIVE archived variant ──────────────────────
                        cur.execute("""
                            UPDATE inventory_brand
                            SET    item_status_id     = %s,
                                   item_unit_price    = %s,
                                   item_selling_price = %s,
                                   total_quantity     = %s
                            WHERE  inventory_brand_id = %s
                        """, (available_status_id, unit_price, selling_price,
                              new_stock, existing_ibid))

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
                        # Active/non-archived duplicate — block it
                        raise ValueError(
                            "PYTHON CHECK (upsert INSERT path): A variant with this Brand + UOM + Description already exists."
                        )
                else:
                    # ── Brand-new variant ────────────────────────────────
                    cur.execute("""
                        INSERT INTO inventory_brand
                               (inventory_id, brand_id, uom_id,
                                item_unit_price, item_selling_price,
                                total_quantity, item_status_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING inventory_brand_id
                    """, (
                        inventory_id,
                        int(brand_id),
                        int(uom_id),
                        unit_price,
                        selling_price,
                        new_stock,
                        available_status_id,
                    ))
                    new_ibid = cur.fetchone()[0]

                    cur.execute("""
                        INSERT INTO inventory_action
                               (inventory_brand_id, low_stock_qty, action_date)
                        VALUES (%s, %s, NOW())
                    """, (new_ibid, reorder_pt))

        # ── 7. Commit ────────────────────────────────────────────────────────
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


# ─────────────────────────── TOGGLE ARCHIVE ───────────────────────────

@inventory_bp.route("/api/inventory/archive/<string:inventory_id>", methods=["PUT", "OPTIONS"])
def toggle_inventory_archive(inventory_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()
    try:
        # total_quantity lives on inventory_brand, not inventory
        cur.execute("""
            SELECT
                ss.status_code,
                COALESCE(SUM(ib.total_quantity), 0) AS total_qty
            FROM inventory i
            JOIN static_status ss
                ON i.item_status_id = ss.status_id
               AND ss.status_scope = 'INVENTORY_STATUS'
            LEFT JOIN inventory_brand ib ON ib.inventory_id = i.inventory_id
            WHERE i.inventory_id = %s
            GROUP BY ss.status_code
        """, (inventory_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Item not found."}), 404

        current_code = row[0]

        if current_code == 'ARCHIVED':
            # Restore: always back to AVAILABLE; the GET endpoint computes
            # the real dynamic status (Low Stock / Out of Stock) at read time.
            new_status_id = _get_status_id(cur, 'AVAILABLE')
            is_archived   = False
            action_msg    = "Restored from Archive"
        else:
            new_status_id = _get_status_id(cur, 'ARCHIVED')
            is_archived   = True
            action_msg    = "Moved to Archive"

            # Clear stock alerts for every variant so the item no longer
            # appears in Low Stock / Out of Stock alert lists while archived.
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


# ─────────────────────────── INVENTORY SUMMARY (KPIs) ───────────────────────────

@inventory_bp.route("/api/inventory/summary", methods=["GET"])
def get_inventory_summary():
    conn = get_connection()
    cur = conn.cursor()
    try:
        today             = date.today()
        this_month_start  = today.replace(day=1)
        last_month_end    = this_month_start - timedelta(days=1)
        last_month_start  = last_month_end.replace(day=1)

        # Match the same calendar day last month (handles short months)
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
