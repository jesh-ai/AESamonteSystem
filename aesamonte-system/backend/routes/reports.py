from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import date, timedelta

reports_bp = Blueprint("reports", __name__)

# ================= 1. SALES REPORT =================
@reports_bp.route("/api/reports/sales", methods=["GET"])
def get_sales_report():
    conn = get_connection()
    cur = conn.cursor()
    try:
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)
        start_of_year = today.replace(month=1, day=1)

        def get_sales(start_date):
            cur.execute("""
                SELECT COALESCE(SUM(ot.total_amount), 0)
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN static_status ss ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
            """, (start_date,))
            return float(cur.fetchone()[0] or 0)

        return jsonify({
            "weekly": get_sales(start_of_week),
            "monthly": get_sales(start_of_month),
            "yearly": get_sales(start_of_year)
        }), 200
    except Exception as e:
        print("Sales Report Error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= 2. DASHBOARD EXTRA STATS =================
@reports_bp.route("/api/reports/extra", methods=["GET"])
def get_dashboard_extra():
    conn = get_connection()
    cur = conn.cursor()
    try:
        today = date.today()
        start_of_month = today.replace(day=1)
        end_of_prev_month = start_of_month - timedelta(days=1)
        start_of_prev_month = end_of_prev_month.replace(day=1)

        # ----- 1. TOTAL ORDERS -----
        cur.execute("SELECT COUNT(order_id) FROM order_transaction")
        total_orders = int(cur.fetchone()[0] or 0)
        
        cur.execute("SELECT COUNT(order_id) FROM order_transaction WHERE order_date >= %s", (start_of_month,))
        curr_orders = int(cur.fetchone()[0] or 0)
        cur.execute("SELECT COUNT(order_id) FROM order_transaction WHERE order_date >= %s AND order_date <= %s", (start_of_prev_month, end_of_prev_month))
        prev_orders = int(cur.fetchone()[0] or 0)
        
        if prev_orders > 0:
            orders_growth = round(((curr_orders - prev_orders) / prev_orders) * 100, 1)
        else:
            orders_growth = 100.0 if curr_orders > 0 else 0.0

        # ----- 2. TOTAL SALES -----
        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0) FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
        """)
        total_sales = float(cur.fetchone()[0] or 0)
        
        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0) FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
        """, (start_of_month,))
        curr_sales = float(cur.fetchone()[0] or 0)

        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0) FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID' AND st.sales_date >= %s AND st.sales_date <= %s
        """, (start_of_prev_month, end_of_prev_month))
        prev_sales = float(cur.fetchone()[0] or 0)
        
        if prev_sales > 0:
            sales_growth = round(((curr_sales - prev_sales) / prev_sales) * 100, 1)
        else:
            sales_growth = 100.0 if curr_sales > 0 else 0.0

        # ----- 3. TOP CLIENTS (By Number of Orders) -----
        cur.execute("""
            SELECT c.customer_name, COUNT(ot.order_id) as total_orders
            FROM order_transaction ot
            JOIN customer c ON ot.customer_id = c.customer_id
            GROUP BY c.customer_name
            ORDER BY total_orders DESC
            LIMIT 3
        """)
        top_clients_db = cur.fetchall()
        max_client_orders = max([int(row[1]) for row in top_clients_db]) if top_clients_db else 1
        if max_client_orders <= 0: max_client_orders = 1
        top_clients = [{"name": row[0] or "Unknown", "orders": int(row[1]), "percentage": (int(row[1])/max_client_orders)*100} for row in top_clients_db]

        # ----- 4. MOST STOCK ITEMS -----
        cur.execute("""
            SELECT i.item_name, i.item_quantity 
            FROM inventory i
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ss.status_scope = 'INVENTORY_STATUS' AND ss.status_code != 'INACTIVE'
            ORDER BY i.item_quantity DESC LIMIT 3
        """)
        most_stock_db = cur.fetchall()
        max_stock = max([int(row[1]) for row in most_stock_db]) if most_stock_db else 1
        if max_stock <= 0: max_stock = 1
        most_stock = [{"name": row[0] or "Unknown", "qty": int(row[1]), "percentage": (int(row[1])/max_stock)*100} for row in most_stock_db]

        # ----- 5. YEARLY SALES HISTORY -----
        cur.execute("""
            SELECT EXTRACT(YEAR FROM st.sales_date) as yr, COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
            GROUP BY yr ORDER BY yr DESC LIMIT 5
        """)
        yearly_history_db = cur.fetchall()
        
        # Zero-Division Protection
        max_year_sales = max([float(row[1]) for row in yearly_history_db]) if yearly_history_db else 1
        if max_year_sales <= 0: max_year_sales = 1
        
        yearly_history = [{"year": int(row[0] or date.today().year), "sales": float(row[1]), "percentage": (float(row[1])/max_year_sales)*100} for row in yearly_history_db]


        return jsonify({
            "totals": { 
                "orders": total_orders, 
                "ordersGrowth": orders_growth, 
                "sales": total_sales, 
                "salesGrowth": sales_growth 
            },
            "topClients": top_clients,
            "mostStock": most_stock,
            "yearlyHistory": yearly_history
        }), 200

    except Exception as e:
        print("Extra Data Error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()