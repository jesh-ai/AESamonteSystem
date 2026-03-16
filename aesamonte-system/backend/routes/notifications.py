from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import datetime, timezone

notifications_bp = Blueprint("notifications", __name__)


def _strip_tz(dt):
    """Normalize datetime to naive UTC for sorting."""
    if dt is None:
        return datetime.min
    if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@notifications_bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    conn = get_connection()
    cur = conn.cursor()
    notifications = []

    try:
        # ── 1. PENDING / PREPARING / CANCELLED / RECEIVED orders ─────────────────
        try:
            cur.execute("""
                SELECT
                    ot.order_id,
                    ss.status_code,
                    ss.status_name,
                    c.customer_name,
                    COALESCE(
                        (SELECT MAX(oal.order_audit_log_date)
                         FROM order_audit_log oal
                         WHERE oal.order_id = ot.order_id),
                        ot.order_date::timestamp
                    ) AS event_time
                FROM order_transaction ot
                JOIN static_status ss ON ot.order_status_id = ss.status_id
                JOIN customer c ON ot.customer_id = c.customer_id
                WHERE ss.status_scope = 'ORDER_STATUS'
                  AND ss.status_code IN ('PENDING', 'PREPARING', 'CANCELLED', 'RECEIVED')
                ORDER BY event_time DESC
                LIMIT 10
            """)
            for row in cur.fetchall():
                order_id, status_code, status_name, customer_name, event_time = row
                notifications.append({
                    "category": "ORDER",
                    "reference": str(order_id),
                    "customer_name": customer_name,
                    "status_code": status_code,
                    "status_name": status_name,
                    "event_time": event_time,
                })
        except Exception as e:
            print("Notifications [orders active] error:", e)
            conn.rollback()

        # ── 2. PAID orders (from sales_transaction) ───────────────────────────────
        try:
            cur.execute("""
                SELECT
                    ot.order_id,
                    'PAID',
                    'Paid',
                    c.customer_name,
                    COALESCE(
                        (SELECT MAX(oal.order_audit_log_date)
                         FROM order_audit_log oal
                         WHERE oal.order_id = ot.order_id),
                        st.sales_date::timestamp
                    ) AS event_time
                FROM sales_transaction st
                JOIN order_transaction ot ON ot.order_id = st.order_id
                JOIN static_status ss ON st.sales_status_id = ss.status_id
                JOIN customer c ON ot.customer_id = c.customer_id
                WHERE ss.status_code = 'PAID'
                ORDER BY event_time DESC
                LIMIT 10
            """)
            for row in cur.fetchall():
                order_id, status_code, status_name, customer_name, event_time = row
                notifications.append({
                    "category": "ORDER",
                    "reference": str(order_id),
                    "customer_name": customer_name,
                    "status_code": status_code,
                    "status_name": status_name,
                    "event_time": event_time,
                })
        except Exception as e:
            print("Notifications [paid orders] error:", e)
            conn.rollback()

        # ── 3. Out of stock items ─────────────────────────────────────────────────
        try:
            cur.execute("""
                SELECT
                    i.inventory_id,
                    i.item_name,
                    i.item_sku,
                    'OUT_OF_STOCK',
                    'Out of Stock',
                    COALESCE(
                        (SELECT MAX(ial.inventory_audit_log_date)
                         FROM inventory_audit_log ial
                         WHERE ial.inventory_id = i.inventory_id),
                        NOW()
                    ) AS event_time
                FROM inventory i
                JOIN static_status ss ON i.item_status_id = ss.status_id
                WHERE ss.status_code != 'INACTIVE'
                  AND i.item_quantity = 0
                ORDER BY event_time DESC
                LIMIT 10
            """)
            for row in cur.fetchall():
                inventory_id, item_name, item_sku, status_code, status_name, event_time = row
                notifications.append({
                    "category": "INVENTORY",
                    "reference": str(inventory_id),
                    "item_name": item_name,
                    "item_sku": item_sku,
                    "status_code": status_code,
                    "status_name": status_name,
                    "event_time": event_time,
                })
        except Exception as e:
            print("Notifications [out of stock] error:", e)
            conn.rollback()

        # ── 4. Low stock items ────────────────────────────────────────────────────
        try:
            cur.execute("""
                SELECT
                    i.inventory_id,
                    i.item_name,
                    i.item_sku,
                    'LOW_STOCK',
                    'Low Stock',
                    COALESCE(
                        (SELECT MAX(ial.inventory_audit_log_date)
                         FROM inventory_audit_log ial
                         WHERE ial.inventory_id = i.inventory_id),
                        NOW()
                    ) AS event_time
                FROM inventory i
                LEFT JOIN inventory_action ia ON ia.inventory_id = i.inventory_id
                JOIN static_status ss ON i.item_status_id = ss.status_id
                WHERE ss.status_code != 'INACTIVE'
                  AND i.item_quantity > 0
                  AND i.item_quantity <= COALESCE(ia.reorder_qty, 10)
                ORDER BY event_time DESC
                LIMIT 10
            """)
            for row in cur.fetchall():
                inventory_id, item_name, item_sku, status_code, status_name, event_time = row
                notifications.append({
                    "category": "INVENTORY",
                    "reference": str(inventory_id),
                    "item_name": item_name,
                    "item_sku": item_sku,
                    "status_code": status_code,
                    "status_name": status_name,
                    "event_time": event_time,
                })
        except Exception as e:
            print("Notifications [low stock] error:", e)
            conn.rollback()

    finally:
        cur.close()
        conn.close()

    # Sort combined list and take top 20
    notifications.sort(key=lambda x: _strip_tz(x["event_time"]), reverse=True)
    notifications = notifications[:20]

    result = []
    for idx, n in enumerate(notifications):
        et = n["event_time"]
        if et:
            date_str = _strip_tz(et).strftime("%B %d, %Y")
            time_str = _strip_tz(et).strftime("%I:%M %p")
        else:
            date_str = ""
            time_str = ""

        result.append({
            "id": idx + 1,
            "key": f"{n['status_code'].lower()}:{n['reference']}",
            "type": n["status_code"].lower(),
            "label": n["status_name"],
            "reference": n["reference"],
            "name": n.get("item_name") or n.get("customer_name"),
            "sku": n.get("item_sku"),
            "date": date_str,
            "time": time_str,
        })

    return jsonify(result), 200
