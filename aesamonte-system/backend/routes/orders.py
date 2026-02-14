from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import date, timedelta

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

# ===================== SUMMARY =====================
@orders_bp.route("/summary", methods=["GET"])
def orders_summary():
    conn = get_connection()
    cur = conn.cursor()

    today = date.today()
    yesterday = today - timedelta(days=1)

    # SHIPPED
    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        WHERE sl.status_scope = 'ORDER_STATUS'
          AND sl.status_code = 'RECEIVED'
          AND ot.order_date = %s
    """, (today,))
    shipped_today = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        WHERE sl.status_scope = 'ORDER_STATUS'
          AND sl.status_code = 'RECEIVED'
    """)
    total_shipped = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        WHERE sl.status_scope = 'ORDER_STATUS'
          AND sl.status_code = 'RECEIVED'
          AND ot.order_date = %s
    """, (yesterday,))
    shipped_yesterday = cur.fetchone()[0]

    # CANCELLED
    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        WHERE sl.status_scope = 'ORDER_STATUS'
          AND sl.status_code = 'CANCELLED'
          AND ot.order_date = %s
    """, (today,))
    cancelled_today = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        WHERE sl.status_scope = 'ORDER_STATUS'
          AND sl.status_code = 'CANCELLED'
          AND ot.order_date = %s
    """, (yesterday,))
    cancelled_yesterday = cur.fetchone()[0]

    # TOTAL ORDERS
    cur.execute("SELECT COUNT(*) FROM order_transaction")
    total_orders = cur.fetchone()[0]

    cur.close()
    conn.close()

    return jsonify({
        "shippedToday": {
            "current": shipped_today,
            "total": total_shipped,
            "yesterday": shipped_yesterday
        },
        "cancelled": {
            "current": cancelled_today,
            "yesterday": cancelled_yesterday
        },
        "totalOrders": {
            "count": total_orders,
            "growth": 3.1
        }
    })


# ===================== LIST =====================
@orders_bp.route("/list", methods=["GET"])
def orders_list():
    conn = get_connection()
    # Use a dictionary cursor to make life easier
    cur = conn.cursor()

    cur.execute("""
        SELECT
            ot.order_id,
            c.customer_name,
            ot.order_date,
            sl.status_code AS order_status,
            COALESCE(json_agg(
                json_build_object(
                    'inventory_id', od.inventory_id,
                    'order_quantity', od.order_quantity,
                    'available_quantity', i.item_quantity,
                    'item_name', i.inventory_item_name
                )
            ) FILTER (WHERE od.order_id IS NOT NULL), '[]') AS items
        FROM order_transaction ot
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        LEFT JOIN order_details od ON od.order_id = ot.order_id
        LEFT JOIN inventory i ON i.inventory_id = od.inventory_id
        WHERE sl.status_scope = 'ORDER_STATUS'
        GROUP BY ot.order_id, c.customer_name, ot.order_date, sl.status_code
        ORDER BY ot.order_id DESC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    orders = []

    for row in rows:
        order_id, customer_name, order_date, order_status, items_json = row
        order_status_upper = order_status.upper()

        problematic_items = []

        # Convert JSON string to Python list if needed
        import json
        if isinstance(items_json, str):
            items_list = json.loads(items_json)
        else:
            items_list = items_json

        if order_status_upper == "PREPARING":
            for item in items_list:
                order_qty = item['order_quantity'] or 0
                available_qty = item['available_quantity'] or 0
                item_name = item['item_name'] or 'Unknown'

                if available_qty < order_qty:
                    problematic_items.append(f"{item_name} ({available_qty}/{order_qty})")

        availability_status = "Out of Stock" if problematic_items else None

        orders.append({
            "id": order_id,
            "customer": customer_name,
            "date": order_date.strftime("%m/%d/%y"),
            "status": order_status_upper.replace("_", " ").title(),
            "availabilityStatus": availability_status,
            "problematicItems": problematic_items
        })

    return jsonify(orders)