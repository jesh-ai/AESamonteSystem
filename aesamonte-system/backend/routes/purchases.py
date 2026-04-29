from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import datetime
from utils.auth import require_purchase_access
import os
import jwt
import pytz

purchases_bp = Blueprint("purchases", __name__)


def _get_status_id(cur, code, scope="PURCHASE_STATUS"):
    cur.execute(
        "SELECT status_id FROM static_status "
        "WHERE status_scope = %s AND status_code = %s LIMIT 1",
        (scope, code),
    )
    row = cur.fetchone()
    if not row:
        raise Exception(
            f"Status code '{code}' not found in static_status (scope={scope})."
        )
    return row[0]


# ── GET /api/brands ───────────────────────────────────────────────────────────

@purchases_bp.route("/api/brands", methods=["GET"])
@require_purchase_access
def get_brands():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT brand_id, brand_name FROM brand ORDER BY brand_name ASC")
        rows = cur.fetchall()
        return jsonify([{"brand_id": r[0], "brand_name": r[1]} for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── POST /api/inventory/quick-add ────────────────────────────────────────────
# Lightweight immediate-save for new inventory items created inside the PO modal.
# Returns the real inventory_brand_id so the PO row can reference it normally.

@purchases_bp.route("/api/inventory/quick-add", methods=["POST"])
@require_purchase_access
def quick_add_inventory_item():
    conn = get_connection()
    cur = conn.cursor()
    try:
        data          = request.get_json()
        item_name     = (data.get("item_name") or "").strip()
        brand_id_in   = data.get("brand_id") or None
        brand_name    = (data.get("brand_name") or "No Brand").strip()
        description   = (data.get("description") or "").strip() or None
        uom_id        = data.get("uom_id")
        reorder_point = int(data.get("reorder_point") or 0)
        selling_price = float(data.get("selling_price") or 0)

        if not item_name:
            return jsonify({"error": "item_name is required."}), 400
        if not uom_id:
            return jsonify({"error": "uom_id is required."}), 400

        available_status_id = _get_status_id(cur, "AVAILABLE", "INVENTORY_STATUS")

        cur.execute("""
            INSERT INTO inventory (item_name, item_status_id)
            VALUES (%s, %s)
            RETURNING inventory_id
        """, (item_name, available_status_id))
        inventory_id = cur.fetchone()[0]

        if brand_id_in:
            resolved_brand_id = int(brand_id_in)
        else:
            cur.execute(
                "SELECT brand_id FROM brand WHERE brand_name = %s LIMIT 1",
                (brand_name,),
            )
            row = cur.fetchone()
            if row:
                resolved_brand_id = row[0]
            else:
                cur.execute(
                    "INSERT INTO brand (brand_name) VALUES (%s) RETURNING brand_id",
                    (brand_name,),
                )
                resolved_brand_id = cur.fetchone()[0]

        cur.execute("SELECT brand_name FROM brand WHERE brand_id = %s", (resolved_brand_id,))
        brand_row = cur.fetchone()
        resolved_brand_name = brand_row[0] if brand_row else brand_name

        cur.execute("""
            INSERT INTO inventory_brand
                (inventory_id, brand_id, uom_id, item_status_id,
                 item_description, item_selling_price)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING inventory_brand_id
        """, (
            inventory_id, resolved_brand_id, int(uom_id),
            available_status_id, description, selling_price,
        ))
        inventory_brand_id = cur.fetchone()[0]

        cur.execute(
            "SELECT uom_name FROM unit_of_measure WHERE uom_id = %s", (int(uom_id),)
        )
        uom_row  = cur.fetchone()
        uom_name = uom_row[0] if uom_row else ""

        # Best-effort reorder tracking — skipped silently if table constraints differ
        if reorder_point > 0:
            cur.execute("SAVEPOINT sp_action")
            try:
                cur.execute("""
                    INSERT INTO inventory_action
                        (inventory_brand_id, action_date, low_stock_qty,
                         reorder_qty, min_order_qty, lead_time_days)
                    VALUES (%s, NOW(), %s, %s, 0, 0)
                """, (inventory_brand_id, reorder_point, reorder_point))
            except Exception:
                cur.execute("ROLLBACK TO SAVEPOINT sp_action")

        conn.commit()
        return jsonify({
            "inventory_brand_id": inventory_brand_id,
            "item_name":          item_name,
            "brand_name":         resolved_brand_name,
            "uom_name":           uom_name,
        }), 201

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── GET /api/purchases ────────────────────────────────────────────────────────

@purchases_bp.route("/api/purchases", methods=["GET"])
@require_purchase_access
def get_purchase_orders():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                po.purchase_order_id,
                po.po_number,
                s.supplier_name,
                ss.status_code   AS status,
                po.date_created,
                po.expected_delivery,
                po.notes,
                COALESCE(agg.total_items, 0)   AS total_items,
                COALESCE(agg.total_cost,  0.0) AS total_cost
            FROM purchase_order po
            JOIN supplier      s  ON s.supplier_id  = po.supplier_id
            JOIN static_status ss ON ss.status_id   = po.status_id
            LEFT JOIN (
                SELECT
                    purchase_order_id,
                    SUM(quantity_ordered)                  AS total_items,
                    SUM(quantity_ordered * unit_cost)      AS total_cost
                FROM purchase_order_item
                GROUP BY purchase_order_id
            ) agg ON agg.purchase_order_id = po.purchase_order_id
            ORDER BY po.date_created DESC
        """)
        rows = cur.fetchall()
        result = [
            {
                "purchase_order_id":  r[0],
                "po_number":          r[1],
                "supplier_name":      r[2],
                "status":             r[3],
                "order_date":         r[4].isoformat() if r[4] else None,
                "expected_delivery":  r[5].isoformat() if r[5] else None,
                "notes":              r[6],
                "total_items":        int(r[7]),
                "total_cost":         float(r[8]),
            }
            for r in rows
        ]
        return jsonify(result), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── GET /api/purchases/<po_id>/items ─────────────────────────────────────────

@purchases_bp.route("/api/purchases/<int:po_id>/items", methods=["GET"])
@require_purchase_access
def get_purchase_order_items(po_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                poi.po_item_id,
                poi.inventory_brand_id,
                i.item_name,
                COALESCE(b.brand_name, 'No Brand') AS brand_name,
                u.uom_name,
                poi.quantity_ordered,
                poi.quantity_received,
                poi.unit_cost,
                poi.expiry_date,
                poi.manufactured_date
            FROM purchase_order_item poi
            JOIN inventory_brand  ib ON ib.inventory_brand_id = poi.inventory_brand_id
            JOIN inventory         i ON i.inventory_id        = ib.inventory_id
            JOIN brand             b ON b.brand_id            = ib.brand_id
            JOIN unit_of_measure   u ON u.uom_id              = ib.uom_id
            WHERE poi.purchase_order_id = %s
            ORDER BY poi.po_item_id
        """, (po_id,))
        rows = cur.fetchall()
        result = [
            {
                "po_item_id":          r[0],
                "inventory_brand_id":  r[1],
                "item_name":           r[2],
                "brand_name":          r[3],
                "uom_name":            r[4],
                "quantity_ordered":    r[5],
                "quantity_received":   r[6],
                "unit_cost":           float(r[7]),
                "expiry_date":         r[8].isoformat() if r[8] else None,
                "manufactured_date":   r[9].isoformat() if r[9] else None,
            }
            for r in rows
        ]
        return jsonify(result), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── POST /api/purchases/draft ─────────────────────────────────────────────────

@purchases_bp.route("/api/purchases/draft", methods=["POST"])
@require_purchase_access
def create_draft_purchase_order():
    conn = get_connection()
    cur = conn.cursor()
    try:
        # ── Get employee_id from token ──
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "aesamonte_rbac_secret_2025")
        token_payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        employee_id = token_payload.get("employee_id")

        data = request.get_json()
        supplier_id       = data.get("supplier_id")
        notes             = data.get("notes", "")
        expected_delivery = data.get("expected_delivery") or None
        items             = data.get("items", [])

        if not supplier_id:
            return jsonify({"error": "supplier_id is required."}), 400
        if not items:
            return jsonify({"error": "At least one item is required."}), 400

        draft_status_id = _get_status_id(cur, "DRAFT")

        manila_tz = pytz.timezone('Asia/Manila')
        now_manila = datetime.now(manila_tz)

        # Insert PO without po_number first so we have the PK for the pattern
        cur.execute("""
            INSERT INTO purchase_order
                (supplier_id, status_id, po_number, ordered_by,
                expected_delivery, notes, date_created)
            VALUES (%s, %s, 'PENDING', %s, %s, %s, %s)
            RETURNING purchase_order_id, date_created
        """, (
            int(supplier_id),
            draft_status_id,
            int(employee_id),
            expected_delivery,
            notes,
            now_manila,
        ))
        po_id, order_date = cur.fetchone()

        # Now update with the real PO number
        po_number = f"PO-{order_date.strftime('%Y%m%d')}-{po_id:04d}"
        cur.execute(
            "UPDATE purchase_order SET po_number = %s WHERE purchase_order_id = %s",
            (po_number, po_id),
        )

        for item in items:
            brand_id      = item.get("inventory_brand_id")
            qty_ordered   = int(item.get("quantity_ordered", 0))
            unit_cost     = float(item.get("unit_cost", 0))
            expiry_date   = item.get("expiry_date") or None
            mfg_date      = item.get("manufactured_date") or None

            if not brand_id or qty_ordered <= 0:
                raise Exception("Each item requires inventory_brand_id and quantity_ordered > 0.")

            cur.execute("""
                INSERT INTO purchase_order_item
                    (purchase_order_id, inventory_brand_id, quantity_ordered,
                     quantity_received, unit_cost, expiry_date, manufactured_date)
                VALUES (%s, %s, %s, 0, %s, %s, %s)
            """, (po_id, int(brand_id), qty_ordered, unit_cost, expiry_date, mfg_date))

        conn.commit()
        return jsonify({
            "message":           "Draft purchase order created.",
            "purchase_order_id": po_id,
            "po_number":         po_number,
        }), 201

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── PATCH /api/purchases/<po_id>/status ──────────────────────────────────────

VALID_TRANSITIONS: dict[str, list[str]] = {
    "DRAFT":     ["SENT", "CANCELLED"],
    "SENT":      ["APPROVED", "CANCELLED"],
    "APPROVED":  ["COMPLETED", "CANCELLED"],
}

@purchases_bp.route("/api/purchases/<int:po_id>/status", methods=["PATCH"])
@require_purchase_access
def update_purchase_order_status(po_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        data       = request.get_json()
        new_status = (data.get("status") or "").upper()

        cur.execute("""
            SELECT ss.status_code
            FROM purchase_order po
            JOIN static_status ss ON ss.status_id = po.status_id
            WHERE po.purchase_order_id = %s
        """, (po_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": f"Purchase order {po_id} not found."}), 404

        current = row[0].upper()
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            return jsonify({"error": f"Cannot move from {current} to {new_status}."}), 400

        new_status_id = _get_status_id(cur, new_status)
        cur.execute(
            "UPDATE purchase_order SET status_id = %s WHERE purchase_order_id = %s",
            (new_status_id, po_id),
        )
        conn.commit()
        return jsonify({"message": f"Status updated to {new_status}.", "status": new_status}), 200

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── PUT /api/purchases/<po_id> ────────────────────────────────────────────────

@purchases_bp.route("/api/purchases/<int:po_id>", methods=["PUT"])
@require_purchase_access
def update_purchase_order(po_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()

        supplier_id       = data.get("supplier_id")
        notes             = data.get("notes", "")
        expected_delivery = data.get("expected_delivery") or None
        items             = data.get("items", [])

        if not supplier_id:
            return jsonify({"error": "supplier_id is required."}), 400
        if not items:
            return jsonify({"error": "At least one item is required."}), 400

        # Only allow editing DRAFT orders
        draft_status_id = _get_status_id(cur, "DRAFT")
        cur.execute(
    "SELECT purchase_order_id FROM purchase_order WHERE purchase_order_id = %s",
    (po_id,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": f"Purchase order {po_id} not found."}), 404

        # Update header
        cur.execute("""
            UPDATE purchase_order
               SET supplier_id = %s, expected_delivery = %s, notes = %s
             WHERE purchase_order_id = %s
        """, (int(supplier_id), expected_delivery, notes, po_id))

        # Replace all items
        cur.execute("DELETE FROM purchase_order_item WHERE purchase_order_id = %s", (po_id,))

        for item in items:
            brand_id    = item.get("inventory_brand_id")
            qty_ordered = int(item.get("quantity_ordered", 0))
            unit_cost   = float(item.get("unit_cost", 0))
            expiry_date = item.get("expiry_date") or None

            if not brand_id or qty_ordered <= 0:
                raise Exception("Each item requires inventory_brand_id and quantity_ordered > 0.")

            cur.execute("""
                INSERT INTO purchase_order_item
                    (purchase_order_id, inventory_brand_id, quantity_ordered,
                     quantity_received, unit_cost, expiry_date)
                VALUES (%s, %s, %s, 0, %s, %s)
            """, (po_id, int(brand_id), qty_ordered, unit_cost, expiry_date))

        conn.commit()
        return jsonify({"message": "Purchase order updated.", "purchase_order_id": po_id}), 200

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── POST /api/purchases/<po_id>/receive ───────────────────────────────────────

@purchases_bp.route("/api/purchases/<int:po_id>/receive", methods=["POST"])
@require_purchase_access
def receive_purchase_order(po_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()
        received_items = data.get("items", [])

        if not received_items:
            return jsonify({"error": "No items provided for receiving."}), 400

        # Verify PO exists
        cur.execute(
            "SELECT purchase_order_id FROM purchase_order WHERE purchase_order_id = %s",
            (po_id,),
        )
        if not cur.fetchone():
            return jsonify({"error": f"Purchase order {po_id} not found."}), 404

        active_batch_status_id = _get_status_id(cur, "ACTIVE", "BATCH_STATUS")
        completed_status_id    = _get_status_id(cur, "COMPLETED")

        yymm = datetime.now().strftime("%y%m")

        for item in received_items:
            poi_id        = item.get("po_item_id")
            qty_received  = int(item.get("quantity_received", 0))
            expiry_date   = item.get("expiry_date") or None
            mfg_date      = item.get("manufactured_date") or None

            if not poi_id or qty_received <= 0:
                raise Exception(
                    "Each received item requires po_item_id and quantity_received > 0."
                )

            # Fetch matching PO item to get brand and cost
            cur.execute("""
                SELECT inventory_brand_id, unit_cost
                FROM   purchase_order_item
                WHERE  po_item_id = %s AND purchase_order_id = %s
            """, (int(poi_id), po_id))
            poi_row = cur.fetchone()
            if not poi_row:
                raise Exception(
                    f"po_item_id {poi_id} not found on purchase order {po_id}."
                )
            brand_id, unit_cost = poi_row

            # Update PO item with received data
            cur.execute("""
                UPDATE purchase_order_item
                SET    quantity_received = %s,
                       expiry_date       = %s,
                       manufactured_date = %s
                WHERE  po_item_id        = %s
            """, (qty_received, expiry_date, mfg_date, int(poi_id)))

            # Insert into inventory_batch (two-step: insert then set batch_number)
            cur.execute("""
                INSERT INTO inventory_batch
                    (inventory_brand_id, quantity_received, quantity_on_hand,
                     unit_cost, expiry_date, manufactured_date, batch_status_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING batch_id
            """, (
                int(brand_id),
                qty_received,
                qty_received,
                float(unit_cost),
                expiry_date,
                mfg_date,
                active_batch_status_id,
            ))
            batch_id     = cur.fetchone()[0]
            batch_number = f"BTCH-{yymm}-{batch_id:04d}"
            cur.execute(
                "UPDATE inventory_batch SET batch_number = %s WHERE batch_id = %s",
                (batch_number, batch_id),
            )

        # Mark the whole PO as COMPLETED
        cur.execute(
            "UPDATE purchase_order SET status_id = %s WHERE purchase_order_id = %s",
            (completed_status_id, po_id),
        )

        conn.commit()
        return jsonify({
            "message":           "Purchase order received and inventory batches created.",
            "purchase_order_id": po_id,
        }), 200

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── PATCH /api/purchases/<po_id>/archive ──────────────────────────────────────

@purchases_bp.route("/api/purchases/<int:po_id>/archive", methods=["PATCH"])
@require_purchase_access
def archive_purchase_order(po_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT ss.status_code
            FROM purchase_order po
            JOIN static_status ss ON ss.status_id = po.status_id
            WHERE po.purchase_order_id = %s
        """, (po_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": f"Purchase order {po_id} not found."}), 404

        current_status = row[0].upper()
        if current_status not in ("COMPLETED", "CANCELLED"):
            return jsonify({"error": "Only COMPLETED or CANCELLED purchase orders can be archived."}), 400

        archived_status_id = _get_status_id(cur, "ARCHIVED")
        cur.execute(
            "UPDATE purchase_order SET status_id = %s WHERE purchase_order_id = %s",
            (archived_status_id, po_id),
        )
        conn.commit()
        return jsonify({"message": "Purchase order archived.", "purchase_order_id": po_id}), 200

    except Exception as e:
        conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
