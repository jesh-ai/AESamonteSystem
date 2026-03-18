from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta

sales_bp = Blueprint("sales", __name__, url_prefix="/api/sales")

# THE FIX: We pull the auto-fix into a master function so it runs BEFORE any math happens!
def auto_fix_pending_payments(conn, cur):
    try:
        cur.execute("""
            UPDATE sales_transaction
            SET payment_status_id = (SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = 'PAID' LIMIT 1)
            WHERE payment_status_id = (SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = 'PENDING' LIMIT 1)
            AND payment_method_id IN (
                SELECT status_id FROM static_status WHERE status_scope = 'PAYMENT_METHOD' AND status_name NOT ILIKE '%Bank%'
            )
        """)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("Auto-fix skipped:", e)

# ===================== SUMMARY =====================
@sales_bp.route("/summary", methods=["GET"])
def sales_summary():
    conn = get_connection()
    cur = conn.cursor()

    # Run auto-fix FIRST
    auto_fix_pending_payments(conn, cur)

    # 1. Calculate precise date boundaries
    today = date.today()
    week_ago = today - timedelta(days=7)
    year_ago = today.replace(month=1, day=1)
    
    this_month_start = today.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    # MTD Apples-to-Apples setup
    current_day = today.day
    try:
        last_month_same_day = last_month_start.replace(day=current_day)
    except ValueError:
        # Fallback if today is the 31st but last month only had 30 days
        last_month_same_day = last_month_end

    # 2. Upgraded helper function to support date ranges
    def sum_sales(start_date=None, end_date=None):
        query = """
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
        """
        params = []
        if start_date:
            query += " AND st.sales_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND st.sales_date <= %s"
            params.append(end_date)
            
        cur.execute(query, params)
        res = cur.fetchone()
        return float(res[0] if res and res[0] else 0)

    # Calculate basic stats
    total_sales = sum_sales()
    weekly_sales = sum_sales(start_date=week_ago)
    monthly_sales = sum_sales(start_date=this_month_start) # Current month to date
    yearly_sales = sum_sales(start_date=year_ago)
    
    # Calculate Last Month MTD sales for the fair % change
    last_month_mtd_sales = sum_sales(start_date=last_month_start, end_date=last_month_same_day)

    # Safe percentage calculator
    def calc_growth(current, previous):
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)

    total_sales_change = calc_growth(monthly_sales, last_month_mtd_sales)

    # 3. Get Top Client overall, plus their ID for further filtering
    cur.execute("""
        SELECT c.customer_id, c.customer_name, COALESCE(SUM(ot.total_amount), 0) AS total_sales
        FROM sales_transaction st
        JOIN order_transaction ot ON st.order_id = ot.order_id
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN static_status ss ON st.payment_status_id = ss.status_id
        WHERE ss.status_code = 'PAID'
        GROUP BY c.customer_id, c.customer_name
        ORDER BY total_sales DESC
        LIMIT 1
    """)
    top_client_data = cur.fetchone()

    top_client_name = "None"
    top_client_sales = 0.0
    top_client_change = 0.0

    # 4. If a top client exists, calculate their specific MTD growth
    if top_client_data:
        client_id = top_client_data[0]
        top_client_name = top_client_data[1]
        top_client_sales = float(top_client_data[2])

        # Get Top Client's Current Month Sales
        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID' AND ot.customer_id = %s AND st.sales_date >= %s
        """, (client_id, this_month_start))
        client_current_month = float(cur.fetchone()[0])

        # Get Top Client's Last Month MTD Sales
        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID' AND ot.customer_id = %s AND st.sales_date >= %s AND st.sales_date <= %s
        """, (client_id, last_month_start, last_month_same_day))
        client_last_month_mtd = float(cur.fetchone()[0])

        top_client_change = calc_growth(client_current_month, client_last_month_mtd)

    cur.close()
    conn.close()

    return jsonify({
        "totalSales": total_sales,
        "totalSalesChange": total_sales_change,
        "weeklySales": weekly_sales,
        "monthlySales": monthly_sales,
        "yearlySales": yearly_sales,
        "topClientName": top_client_name,
        "topClientSales": top_client_sales,
        "topClientChange": top_client_change 
    })


# ===================== TRANSACTIONS =====================
@sales_bp.route("/transactions", methods=["GET"])
def sales_transactions():
    conn = get_connection()
    cur = conn.cursor()

    # Run auto-fix FIRST
    auto_fix_pending_payments(conn, cur)

    # THE FIX: Uses ot.total_amount directly so React displays the perfect price
    query = """
        SELECT
            st.sales_id,
            c.customer_name,
            c.customer_address,
            st.sales_date,
            COALESCE(SUM(od.order_quantity), 0) AS qty,
            ot.total_amount AS amount,
            ss.status_code AS status,
            pm.status_name AS payment_method
        FROM sales_transaction st
        JOIN static_status ss ON st.payment_status_id = ss.status_id
        LEFT JOIN static_status pm ON st.payment_method_id = pm.status_id
        JOIN order_transaction ot ON st.order_id = ot.order_id
        JOIN customer c ON ot.customer_id = c.customer_id
        LEFT JOIN order_details od ON ot.order_id = od.order_id
        GROUP BY st.sales_id, c.customer_name, c.customer_address, st.sales_date, ss.status_code, pm.status_name, ot.total_amount
        ORDER BY st.sales_date DESC
    """

    cur.execute(query)
    rows = cur.fetchall()
    
    cur.close()
    conn.close()

    transactions = []
    for r in rows:
        status_code = r[6]
        is_arch = (status_code == "INACTIVE") 
        
        transactions.append({
            "no": str(r[0]).strip(), 
            "name": r[1] or "Unknown",
            "address": r[2] or "Unknown",
            "date": r[3].strftime("%m/%d/%y") if r[3] else None,
            "qty": int(r[4] or 0),
            "amount": float(r[5] or 0),
            "status": status_code,
            "paymentMethod": r[7] or "Unknown", 
            "is_archived": is_arch 
        })

    return jsonify(transactions)


# ===================== TOGGLE STATUS (PENDING <-> PAID) =====================
@sales_bp.route("/toggle-status/<string:sales_id>", methods=["PUT", "OPTIONS"])
def toggle_payment_status(sales_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()
    
    try:
        sales_id = str(sales_id).strip()
        
        cur.execute("""
            SELECT ss.status_code 
            FROM sales_transaction st
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE TRIM(st.sales_id) = %s
        """, (sales_id,))
        row = cur.fetchone()
        
        if not row:
            return jsonify({"error": f"Item {sales_id} not found."}), 404
            
        current_status_code = row[0]
        
        if current_status_code == 'PENDING':
            target_code = 'PAID'
        elif current_status_code == 'PAID':
            target_code = 'PENDING'
        else:
            return jsonify({"error": "Archived items cannot change payment status."}), 400

        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = %s", (target_code,))
        new_id = cur.fetchone()[0]
        cur.execute("UPDATE sales_transaction SET payment_status_id = %s WHERE TRIM(sales_id) = %s", (new_id, sales_id))
        
        conn.commit()
        
        return jsonify({
            "message": f"Successfully marked as {target_code}!", 
            "new_status": target_code 
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ===================== TOGGLE ARCHIVE =====================
@sales_bp.route("/archive/<string:sales_id>", methods=["PUT", "OPTIONS"])
def toggle_archive(sales_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()
    
    try:
        sales_id = str(sales_id).strip()
        cur.execute("""
            SELECT ss.status_code 
            FROM sales_transaction st
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE TRIM(st.sales_id) = %s
        """, (sales_id,))
        current_status = cur.fetchone()[0]
        
        if current_status == 'INACTIVE':
            cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = 'PENDING'")
            new_status_id = cur.fetchone()[0]
            is_archived = False
            new_status_code = 'PENDING' 
        else:
            cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = 'INACTIVE'")
            new_status_id = cur.fetchone()[0]
            is_archived = True
            new_status_code = 'INACTIVE' 

        cur.execute("UPDATE sales_transaction SET payment_status_id = %s WHERE TRIM(sales_id) = %s", (new_status_id, sales_id))
        conn.commit()
        
        return jsonify({
            "message": "Archive status updated", 
            "is_archived": is_archived,
            "new_status": new_status_code 
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()