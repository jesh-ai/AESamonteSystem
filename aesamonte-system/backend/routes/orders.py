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

    # Shipped today (RECEIVED)
    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN order_status os ON ot.order_status_id = os.order_status_id
        WHERE os.order_status_name = 'RECEIVED'
        AND ot.order_date = %s
    """, (today,))
    shipped_today = cur.fetchone()[0]

    # Total shipped
    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN order_status os ON ot.order_status_id = os.order_status_id
        WHERE os.order_status_name = 'RECEIVED'
    """)
    total_shipped = cur.fetchone()[0]

    # Shipped yesterday
    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN order_status os ON ot.order_status_id = os.order_status_id
        WHERE os.order_status_name = 'RECEIVED'
        AND ot.order_date = %s
    """, (yesterday,))
    shipped_yesterday = cur.fetchone()[0]

    # Cancelled
    cur.execute("""
        SELECT COUNT(*)
        FROM order_transaction ot
        JOIN order_status os ON ot.order_status_id = os.order_status_id
        WHERE os.order_status_name = 'CANCELLED'
    """)
    cancelled = cur.fetchone()[0]

    # Total orders
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
            "current": cancelled,
            "yesterday": 0
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
    cur = conn.cursor()

    # 👇 CUSTOMER BEFORE DATE
    cur.execute("""
        SELECT
            ot.order_id,
            c.customer_name,
            ot.order_date,
            os.order_status_name
        FROM order_transaction ot
        JOIN customer c
            ON ot.customer_id = c.customer_id
        JOIN order_status os
            ON ot.order_status_id = os.order_status_id
        ORDER BY ot.order_id DESC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    orders = []
    for r in rows:
        orders.append({
            "id": r[0],
            "customer": r[1],                # 👈 customer first
            "date": r[2].strftime("%m/%d/%y"),
            "status": r[3]
        })

    return jsonify(orders)
