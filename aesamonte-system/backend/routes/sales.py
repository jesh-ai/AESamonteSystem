from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta

sales_bp = Blueprint("sales", __name__, url_prefix="/api/sales")

# ===================== SUMMARY =====================
@sales_bp.route("/summary", methods=["GET"])
def sales_summary():
    conn = get_connection()
    cur = conn.cursor()

    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today.replace(day=1)
    year_ago = today.replace(month=1, day=1)

    def sum_sales(since=None):
        query = """
            SELECT COALESCE(SUM(od.order_total), 0)
            FROM sales_transaction st
            JOIN order_details od ON st.order_id = od.order_id
            JOIN static_status ss ON st.sales_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
        """
        params = []
        if since:
            query += " AND st.sales_date >= %s"
            params.append(since)
        cur.execute(query, params)
        return float(cur.fetchone()[0] or 0)

    total_sales = sum_sales()
    weekly_sales = sum_sales(week_ago)
    monthly_sales = sum_sales(month_ago)
    yearly_sales = sum_sales(year_ago)

    cur.execute("""
        SELECT c.customer_name, COALESCE(SUM(od.order_total), 0) AS total_sales
        FROM sales_transaction st
        JOIN order_transaction ot ON st.order_id = ot.order_id
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN order_details od ON ot.order_id = od.order_id
        JOIN static_status ss ON st.sales_status_id = ss.status_id
        WHERE ss.status_code = 'PAID'
        GROUP BY c.customer_name
        ORDER BY total_sales DESC
        LIMIT 1
    """)
    top_client = cur.fetchone()

    cur.close()
    conn.close()

    return jsonify({
        "totalSales": total_sales,
        "totalSalesChange": 5.2,
        "weeklySales": weekly_sales,
        "monthlySales": monthly_sales,
        "yearlySales": yearly_sales,
        "topClientName": top_client[0] if top_client else "None",
        "topClientSales": float(top_client[1]) if top_client else 0,
        "topClientChange": 3.8 
    })


# ===================== TRANSACTIONS =====================
@sales_bp.route("/transactions", methods=["GET"])
def sales_transactions():
    conn = get_connection()
    cur = conn.cursor()

    # AUTO-FIX: Automatically force Cash & E-Wallet to PAID!
    try:
        cur.execute("""
            UPDATE sales_transaction 
            SET sales_status_id = (SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = 'PAID' LIMIT 1)
            WHERE sales_status_id = (SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = 'PENDING' LIMIT 1)
            AND payment_method_id IN (
                SELECT status_id FROM static_status WHERE status_scope = 'PAYMENT_METHOD' AND status_name NOT ILIKE '%Bank%'
            )
        """)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("Auto-fix skipped:", e)

    # THE FIX: Added a join to grab the actual payment method name
    query = """
        SELECT
            st.sales_id,
            c.customer_name,
            c.customer_address,
            st.sales_date,
            COALESCE(SUM(od.order_quantity), 0) AS qty,
            COALESCE(SUM(od.order_total), 0) AS amount,
            ss.status_code AS status,
            pm.status_name AS payment_method
        FROM sales_transaction st
        JOIN static_status ss ON st.sales_status_id = ss.status_id
        LEFT JOIN static_status pm ON st.payment_method_id = pm.status_id
        JOIN order_transaction ot ON st.order_id = ot.order_id
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN order_details od ON ot.order_id = od.order_id
        GROUP BY st.sales_id, c.customer_name, c.customer_address, st.sales_date, ss.status_code, pm.status_name
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
            "no": str(r[0]).strip(), # <--- Ensured this is a string
            "name": r[1] or "Unknown",
            "address": r[2] or "Unknown",
            "date": r[3].strftime("%m/%d/%y") if r[3] else None,
            "qty": int(r[4] or 0),
            "amount": float(r[5] or 0),
            "status": status_code,
            "paymentMethod": r[7] or "Unknown", # <--- Sent to React
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
        
        # 1. Look up current status
        cur.execute("""
            SELECT ss.status_code 
            FROM sales_transaction st
            JOIN static_status ss ON st.sales_status_id = ss.status_id
            WHERE TRIM(st.sales_id) = %s
        """, (sales_id,))
        row = cur.fetchone()
        
        if not row:
            return jsonify({"error": f"Item {sales_id} not found."}), 404
            
        current_status_code = row[0]
        
        # 2. Toggle Logic
        if current_status_code == 'PENDING':
            target_code = 'PAID'
        elif current_status_code == 'PAID':
            target_code = 'PENDING'
        else:
            return jsonify({"error": "Archived items cannot change payment status."}), 400

        # 3. Update Database
        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'SALES_STATUS' AND status_code = %s", (target_code,))
        new_id = cur.fetchone()[0]
        cur.execute("UPDATE sales_transaction SET sales_status_id = %s WHERE TRIM(sales_id) = %s", (new_id, sales_id))
        
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
            JOIN static_status ss ON st.sales_status_id = ss.status_id
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

        cur.execute("UPDATE sales_transaction SET sales_status_id = %s WHERE TRIM(sales_id) = %s", (new_status_id, sales_id))
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