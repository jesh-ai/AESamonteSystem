from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import datetime, timezone
import psycopg2

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
    db_ok = True

    try:
        # ── 1. PENDING / PREPARING / CANCELLED / RECEIVED orders ─────────────────
        try:
            cur.execute("""
                SELECT
                    ot.order_id,
                    ss.status_code,
                    ss.status_name,
                    c.customer_name,
                    ot.order_date::timestamp AS event_time
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
            if isinstance(e, (psycopg2.OperationalError, psycopg2.InterfaceError)):
                db_ok = False

        # ── 2. PAID orders (from sales_transaction) ───────────────────────────────
        if db_ok:
            try:
                cur.execute("""
                    SELECT
                        ot.order_id,
                        'PAID',
                        'Paid',
                        st.sales_id,
                        c.customer_name,
                        st.sales_date::timestamp AS event_time
                    FROM sales_transaction st
                    JOIN order_transaction ot ON ot.order_id = st.order_id
                    JOIN static_status ss ON st.payment_status_id = ss.status_id
                    JOIN customer c ON ot.customer_id = c.customer_id
                    WHERE ss.status_code = 'PAID'
                    ORDER BY event_time DESC
                    LIMIT 10
                """)
                for row in cur.fetchall():
                    order_id, status_code, status_name, sales_id, customer_name, event_time = row
                    notifications.append({
                        "category": "ORDER",
                        "reference": str(order_id),
                        "sales_id": str(sales_id),
                        "customer_name": customer_name,
                        "status_code": status_code,
                        "status_name": status_name,
                        "event_time": event_time,
                    })
            except Exception as e:
                print("Notifications [paid orders] error:", e)
                conn.rollback()
                if isinstance(e, (psycopg2.OperationalError, psycopg2.InterfaceError)):
                    db_ok = False

        # ── 3. Newly added inventory items (last 30 days) ────────────────────────
        if db_ok:
            try:
                cur.execute("""
                    SELECT
                        i.inventory_id,
                        i.item_name,
                        'ITEM_ADDED',
                        'New Item Added',
                        i.item_created_at AS event_time
                    FROM inventory i
                    JOIN static_status ss ON i.item_status_id = ss.status_id
                    WHERE ss.status_code != 'INACTIVE'
                      AND i.item_created_at >= NOW() - INTERVAL '30 days'
                    ORDER BY event_time DESC
                    LIMIT 10
                """)
                for row in cur.fetchall():
                    inventory_id, item_name, status_code, status_name, event_time = row
                    notifications.append({
                        "category": "INVENTORY",
                        "reference": str(inventory_id),
                        "item_name": item_name,
                        "item_sku": None,
                        "status_code": status_code,
                        "status_name": status_name,
                        "event_time": event_time,
                    })
            except Exception as e:
                print("Notifications [new items] error:", e)
                conn.rollback()
                if isinstance(e, (psycopg2.OperationalError, psycopg2.InterfaceError)):
                    db_ok = False

        # ── 5. Out of stock items — per variant (inventory_brand_id) ─────────────
        if db_ok:
            try:
                cur.execute("""
                    SELECT
                        ib.inventory_brand_id,
                        i.item_name || CASE
                            WHEN ib.variant_name IS NOT NULL AND TRIM(ib.variant_name) != ''
                            THEN ' (' || TRIM(ib.variant_name) || ')'
                            ELSE ''
                        END AS display_name,
                        'OUT_OF_STOCK',
                        'Out of Stock',
                        i.item_created_at AS event_time
                    FROM inventory_brand ib
                    JOIN inventory i
                        ON i.inventory_id      = ib.inventory_id
                    JOIN static_status ss
                        ON i.item_status_id    = ss.status_id
                    LEFT JOIN inventory_batch bat
                        ON bat.inventory_brand_id = ib.inventory_brand_id
                       AND bat.expiry_date > CURRENT_DATE
                    WHERE ss.status_code != 'INACTIVE'
                    GROUP BY
                        ib.inventory_brand_id,
                        i.item_name,
                        ib.variant_name,
                        i.item_created_at
                    HAVING COALESCE(SUM(bat.quantity_on_hand), 0) = 0
                    ORDER BY event_time DESC
                    LIMIT 10
                """)
                for row in cur.fetchall():
                    inventory_brand_id, item_name, status_code, status_name, event_time = row
                    notifications.append({
                        "category": "INVENTORY",
                        "reference": str(inventory_brand_id),
                        "item_name": item_name,
                        "item_sku": None,
                        "status_code": status_code,
                        "status_name": status_name,
                        "event_time": event_time,
                    })
            except Exception as e:
                print("Notifications [out of stock] error:", e)
                conn.rollback()
                if isinstance(e, (psycopg2.OperationalError, psycopg2.InterfaceError)):
                    db_ok = False

        # ── 6. Low stock items — per variant (inventory_brand_id) ─────────────────
        if db_ok:
            try:
                cur.execute("""
                    SELECT
                        ib.inventory_brand_id,
                        i.item_name || CASE
                            WHEN ib.variant_name IS NOT NULL AND TRIM(ib.variant_name) != ''
                            THEN ' (' || TRIM(ib.variant_name) || ')'
                            ELSE ''
                        END AS display_name,
                        'LOW_STOCK',
                        'Low Stock',
                        i.item_created_at AS event_time
                    FROM inventory_brand ib
                    JOIN inventory i
                        ON i.inventory_id         = ib.inventory_id
                    JOIN static_status ss
                        ON i.item_status_id        = ss.status_id
                    LEFT JOIN inventory_batch bat
                        ON bat.inventory_brand_id  = ib.inventory_brand_id
                       AND bat.expiry_date > CURRENT_DATE
                    LEFT JOIN inventory_action ia
                        ON ia.inventory_brand_id   = ib.inventory_brand_id
                    WHERE ss.status_code != 'INACTIVE'
                    GROUP BY
                        ib.inventory_brand_id,
                        i.item_name,
                        ib.variant_name,
                        i.item_created_at,
                        ia.low_stock_qty
                    HAVING
                        COALESCE(SUM(bat.quantity_on_hand), 0) > 0
                        AND COALESCE(SUM(bat.quantity_on_hand), 0) <= COALESCE(ia.low_stock_qty, 10)
                    ORDER BY event_time DESC
                    LIMIT 10
                """)
                for row in cur.fetchall():
                    inventory_brand_id, item_name, status_code, status_name, event_time = row
                    notifications.append({
                        "category": "INVENTORY",
                        "reference": str(inventory_brand_id),
                        "item_name": item_name,
                        "item_sku": None,
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

        # Grab the relevant name (either the item name or the customer name)
        entity_name = n.get("item_name") or n.get("customer_name") or "Unknown"

        # Construct a human-readable label that prioritizes the Name instead of the ID
        display_label = f"{n['status_name']}: {entity_name}"

        result.append({
            "id": idx + 1,
            "key": f"{n['status_code'].lower()}:{n['reference']}",
            "type": n["status_code"].lower(),
            "label": display_label,       # e.g., "Pending: John Doe" or "Low Stock: Whole Milk"
            "reference": n["reference"],  # Kept in payload for backend operations/linking
            "name": entity_name,
            "sales_id": n.get("sales_id"),
            "sku": n.get("item_sku"),
            "date": date_str,
            "time": time_str,
        })

    return jsonify(result), 200