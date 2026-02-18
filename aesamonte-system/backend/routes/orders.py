from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import date, timedelta
import json

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

# ===================== SUMMARY =====================
@orders_bp.route("/summary", methods=["GET"])
def orders_summary():
    conn = get_connection()
    cur = conn.cursor()

    today = date.today()
    yesterday = today - timedelta(days=1)

    def count_orders(status_code, for_date=None):
        query = """
            SELECT COUNT(*)
            FROM order_transaction ot
            JOIN static_status sl ON ot.order_status_id = sl.status_id
            WHERE sl.status_scope = 'ORDER_STATUS'
              AND sl.status_code = %s
        """
        params = [status_code]
        if for_date:
            query += " AND ot.order_date = %s"
            params.append(for_date)
        cur.execute(query, params)
        return cur.fetchone()[0]

    shipped_today = count_orders("RECEIVED", today)
    shipped_yesterday = count_orders("RECEIVED", yesterday)
    total_shipped = count_orders("RECEIVED")
    cancelled_today = count_orders("CANCELLED", today)
    cancelled_yesterday = count_orders("CANCELLED", yesterday)

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
            "growth": 3.1  # Placeholder; calculate dynamically if needed
        }
    })


# ===================== LIST =====================
@orders_bp.route("/list", methods=["GET"])
def orders_list():
    conn = get_connection()
    cur = conn.cursor()

    # UPDATED QUERY: 
    # 1. Joins payment_method for the method name.
    # 2. Selects customer_address.
    # 3. Sums order_quantity and order_total from order_details.
    cur.execute("""
        SELECT
            ot.order_id,
            c.customer_name,
            c.customer_address,
            ot.order_date,
            sl.status_code AS order_status,
            'Cash' AS payment_method_name,  -- <--- Temporary Placeholder
            COALESCE(SUM(od.order_quantity), 0) as total_qty,
            COALESCE(SUM(od.order_total), 0) as total_amount,
            COALESCE(json_agg(
                json_build_object(
                    'inventory_id', od.inventory_id,
                    'order_quantity', od.order_quantity,
                    'available_quantity', i.item_quantity,
                    'item_name', i.item_name
                )
            ) FILTER (WHERE od.order_id IS NOT NULL), '[]') AS items_json
        FROM order_transaction ot
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN static_status sl ON ot.order_status_id = sl.status_id
        -- LEFT JOIN payment_method pm ON ot.payment_id = pm.payment_method_id -- <--- COMMENT THIS OUT
        LEFT JOIN order_details od ON od.order_id = ot.order_id
        LEFT JOIN inventory i ON i.inventory_id = od.inventory_id
        WHERE sl.status_scope = 'ORDER_STATUS'
        GROUP BY 
            ot.order_id, 
            c.customer_name, 
            c.customer_address, 
            ot.order_date, 
            sl.status_code
            -- pm.payment_method_name -- <--- COMMENT THIS OUT
        ORDER BY ot.order_id DESC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    orders = []

    for row in rows:
        # Unpack the new columns
        order_id, customer_name, customer_address, order_date, order_status, payment_method, total_qty, total_amount, items_json = row
        
        order_status_upper = (order_status or "").upper()

        if isinstance(items_json, str):
            try:
                items_list = json.loads(items_json)
            except json.JSONDecodeError:
                items_list = []
        else:
            items_list = items_json or []

        problematic_items = []
        if order_status_upper == "PREPARING":
            for item in items_list:
                order_qty = item.get('order_quantity') or 0
                available_qty = item.get('available_quantity') or 0
                item_name = item.get('item_name') or 'Unknown'
                if available_qty < order_qty:
                    problematic_items.append(f"{item_name} ({available_qty}/{order_qty})")

        availability_status = "Out of Stock" if problematic_items else None

        orders.append({
            "id": order_id,
            "customer": customer_name,
            "address": customer_address,     # Added
            "date": order_date.strftime("%m/%d/%y") if order_date else None,
            "status": order_status_upper.replace("_", " ").title(),
            "paymentMethod": payment_method, # Added
            "totalQty": total_qty,           # Added
            "totalAmount": total_amount,     # Added
            "availabilityStatus": availability_status,
            "problematicItems": problematic_items,
            "items": items_list 
        })

    return jsonify(orders)

def check_columns():
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        print("\n=== Columns in 'order_transaction' table ===")
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'order_transaction'")
        for row in cur.fetchall():
            print(f"- {row[0]}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    check_columns()