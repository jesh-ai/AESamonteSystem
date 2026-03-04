from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import date, timedelta

reports_bp = Blueprint("reports", __name__)

@reports_bp.route("/api/reports/sales", methods=["GET"])
def get_sales_report():
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        today = date.today()
        # Safe date calculations
        start_of_week = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)
        start_of_year = today.replace(month=1, day=1)

        # Helper function to fetch sum of paid sales from a specific date
        def get_sales(start_date):
            cur.execute("""
                SELECT COALESCE(SUM(ot.total_amount), 0)
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN static_status ss ON st.sales_status_id = ss.status_id
                WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
            """, (start_date,))
            return float(cur.fetchone()[0])

        return jsonify({
            "weekly": get_sales(start_of_week),
            "monthly": get_sales(start_of_month),
            "yearly": get_sales(start_of_year)
        }), 200

    except Exception as e:
        print("Error fetching Sales Report:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()