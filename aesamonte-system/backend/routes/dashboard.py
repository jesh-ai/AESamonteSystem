from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta
import calendar
import time

dashboard_bp = Blueprint("dashboard", __name__)

# ── Simple in-memory cache ────────────────────────────────────────────────────
_cache: dict = {}

def _get(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["data"]
    return None

def _set(key: str, data, ttl: int):
    _cache[key] = {"data": data, "expires": time.time() + ttl}

def _invalidate(*keys: str):
    for k in keys:
        _cache.pop(k, None)


# ── 1. TOP METRICS ──────────────────────────────────────────────────────────
@dashboard_bp.route("/api/dashboard/metrics", methods=["GET"])
def get_dashboard_metrics():
    cached = _get("metrics")
    if cached:
        return jsonify(cached), 200

    conn = get_connection()
    cur = conn.cursor()
    try:
        today = date.today()
        yesterday = today - timedelta(days=1)

        # Sales Today
        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID' AND st.sales_date = %s
        """, (today,))
        sales_today = float(cur.fetchone()[0] or 0)

        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID' AND st.sales_date = %s
        """, (yesterday,))
        sales_yesterday = float(cur.fetchone()[0] or 0)

        if sales_yesterday > 0:
            sales_change = round(((sales_today - sales_yesterday) / sales_yesterday) * 100, 1)
        else:
            sales_change = 100.0 if sales_today > 0 else 0.0

        # Pending / Preparing Orders — today's new orders only
        cur.execute("""
            SELECT COUNT(ot.order_id)
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ss.status_scope = 'ORDER_STATUS'
              AND ss.status_code IN ('PENDING', 'PREPARING')
              AND ot.order_date = %s
        """, (today,))
        pending_orders = int(cur.fetchone()[0] or 0)

        # Yesterday's new pending/preparing orders for % change
        cur.execute("""
            SELECT COUNT(ot.order_id)
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ss.status_scope = 'ORDER_STATUS'
              AND ss.status_code IN ('PENDING', 'PREPARING')
              AND ot.order_date = %s
        """, (yesterday,))
        prev_pending = int(cur.fetchone()[0] or 0)

        if prev_pending > 0:
            orders_change = round(((pending_orders - prev_pending) / prev_pending) * 100, 1)
        else:
            orders_change = 100.0 if pending_orders > 0 else 0.0

        # Low Stock count — reorder_qty lives in inventory_action
        cur.execute("""
            SELECT COUNT(*)
            FROM inventory i
            LEFT JOIN inventory_action ia ON ia.inventory_id = i.inventory_id
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ss.status_code != 'INACTIVE'
              AND i.total_quantity <= COALESCE(ia.reorder_qty, 10)
        """)
        low_stock = int(cur.fetchone()[0] or 0)

        result = {
            "salesToday": sales_today,
            "salesChange": sales_change,
            "pendingOrders": pending_orders,
            "ordersChange": orders_change,
            "lowStock": low_stock,
        }
        _set("metrics", result, ttl=120)  # 2-minute cache
        return jsonify(result), 200
    except Exception as e:
        print("Dashboard metrics error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── 2. RECENT ORDERS (Quick POS) ─────────────────────────────────────────────
@dashboard_bp.route("/api/dashboard/recent-orders", methods=["GET"])
def get_recent_orders():
    cached = _get("recent_orders")
    if cached:
        return jsonify(cached), 200

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                ot.order_id,
                c.customer_name,
                ot.total_amount,
                ss.status_code AS status
            FROM order_transaction ot
            JOIN customer c ON ot.customer_id = c.customer_id
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ss.status_scope = 'ORDER_STATUS'
            ORDER BY ot.order_id DESC
            LIMIT 6
        """)
        rows = cur.fetchall()
        orders = [
            {
                "orderId": row[0],
                "customerName": row[1] or "Unknown",
                "amount": float(row[2] or 0),
                "status": (row[3] or "").upper(),
            }
            for row in rows
        ]
        _set("recent_orders", orders, ttl=120)  # 2-minute cache
        return jsonify(orders), 200
    except Exception as e:
        print("Recent orders error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── 3. CHARTS DATA ───────────────────────────────────────────────────────────
@dashboard_bp.route("/api/dashboard/charts", methods=["GET"])
def get_dashboard_charts():
    cached = _get("charts")
    if cached:
        return jsonify(cached), 200

    conn = get_connection()
    cur = conn.cursor()
    try:
        today = date.today()
        current_year = today.year

        # --- Monthly sales for Forecast Revenue line chart ---
        cur.execute("""
            SELECT
                EXTRACT(MONTH FROM st.sales_date)::int AS month,
                COALESCE(SUM(ot.total_amount), 0) AS total
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
              AND EXTRACT(YEAR FROM st.sales_date) = %s
            GROUP BY month
            ORDER BY month
        """, (current_year,))
        month_rows = cur.fetchall()
        month_map = {int(r[0]): float(r[1]) for r in month_rows}
        month_labels = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
        monthly_sales = [{"month": month_labels[i], "sales": month_map.get(i + 1, 0)} for i in range(12)]

        month_names = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"]

        # Helper: query previous year's sales for a given month range
        def prev_year_sales_for_months(m_start, m_end):
            cur.execute("""
                SELECT COALESCE(SUM(ot.total_amount), 0)
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN static_status ss ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID'
                  AND EXTRACT(YEAR FROM st.sales_date) = %s
                  AND EXTRACT(MONTH FROM st.sales_date) BETWEEN %s AND %s
            """, (current_year - 1, m_start, m_end))
            return float(cur.fetchone()[0] or 0)

        # --- Quarterly FORECAST — 4 quarters starting from current quarter,
        #     values = previous year's actuals for the same quarter ---
        all_quarters = [
            (1, 1,  3,  "Jan - Mar"),
            (2, 4,  6,  "Apr - Jun"),
            (3, 7,  9,  "Jul - Sep"),
            (4, 10, 12, "Oct - Dec"),
        ]
        current_quarter = (today.month - 1) // 3  # 0-indexed (0=Q1 … 3=Q4)
        quarterly_sales = []
        for i in range(4):
            q_num, m_start, m_end, date_range = all_quarters[(current_quarter + i) % 4]
            total = prev_year_sales_for_months(m_start, m_end)
            quarterly_sales.append({
                "label": f"Q{q_num}",
                "dateRange": date_range,
                "total": total,
            })

        # --- Weekly FORECAST — 4 weeks starting from current week,
        #     values = same week last year ---
        start_of_this_week = today - timedelta(days=today.weekday())
        weekly_sales = []
        for w in range(4):
            week_start = start_of_this_week + timedelta(weeks=w)
            week_end   = week_start + timedelta(days=6)
            prev_start = week_start - timedelta(weeks=52)
            prev_end   = week_end   - timedelta(weeks=52)
            cur.execute("""
                SELECT COALESCE(SUM(ot.total_amount), 0)
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN static_status ss ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID'
                  AND st.sales_date BETWEEN %s AND %s
            """, (prev_start, prev_end))
            total = float(cur.fetchone()[0] or 0)
            weekly_sales.append({
                "label": f"Week {w + 1}",
                "dateRange": f"{week_start.strftime('%b %d')} - {week_end.strftime('%b %d')}",
                "total": total,
            })

        # --- Yearly FORECAST — 12 months starting from current month,
        #     values = previous year's actuals for the same month ---
        last_twelve_months = []
        for i in range(12):
            m = today.month + i
            y = today.year
            while m > 12:
                m -= 12
                y += 1
            # Fetch previous year's sales for this calendar month
            _, days_prev = calendar.monthrange(y - 1, m)
            prev_start = date(y - 1, m, 1)
            prev_end   = date(y - 1, m, days_prev)
            cur.execute("""
                SELECT COALESCE(SUM(ot.total_amount), 0)
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN static_status ss ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID'
                  AND st.sales_date BETWEEN %s AND %s
            """, (prev_start, prev_end))
            total = float(cur.fetchone()[0] or 0)
            last_twelve_months.append({
                "label": month_names[m - 1],
                "year":  str(y),
                "dateRange": f"{month_names[m - 1]} {y}",
                "total": total,
            })

        # --- Yearly sales history (last 3 years) for Top Yearly Sales ---
        cur.execute("""
            SELECT
                EXTRACT(YEAR FROM st.sales_date)::int AS yr,
                COALESCE(SUM(ot.total_amount), 0) AS total
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
            GROUP BY yr
            ORDER BY yr DESC
            LIMIT 3
        """)
        year_rows = cur.fetchall()

        yearly_sales = []
        prev_total = None
        for row in year_rows:
            yr, total = int(row[0]), float(row[1])
            change = None
            if prev_total is not None and prev_total > 0:
                change = round(((total - prev_total) / prev_total) * 100, 1)
            yearly_sales.append({"year": yr, "total": total, "change": change})
            prev_total = total

        # Compute change vs previous year for each entry (compare yr[i] to yr[i+1])
        for i in range(len(yearly_sales) - 1):
            curr = yearly_sales[i]["total"]
            prev = yearly_sales[i + 1]["total"]
            if prev > 0:
                yearly_sales[i]["change"] = round(((curr - prev) / prev) * 100, 1)
            else:
                yearly_sales[i]["change"] = 100.0 if curr > 0 else 0.0
        if yearly_sales:
            yearly_sales[-1]["change"] = None

        # --- Goal: current year sales vs previous year (growth rate) ---
        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
              AND EXTRACT(YEAR FROM st.sales_date) = %s
        """, (current_year,))
        current_year_sales = float(cur.fetchone()[0] or 0)

        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
              AND EXTRACT(YEAR FROM st.sales_date) = %s
        """, (current_year - 1,))
        prev_year_sales = float(cur.fetchone()[0] or 0)

        if prev_year_sales > 0:
            goal_pct = min(round((current_year_sales / prev_year_sales) * 100, 1), 200)
        else:
            goal_pct = 100.0 if current_year_sales > 0 else 0.0

        # Forecast revenue for current year (sum of all months including projected)
        forecast_total = sum(m["sales"] for m in monthly_sales)

        result = {
            "monthlySales": monthly_sales,
            "weeklySales": weekly_sales,
            "quarterlySales": quarterly_sales,
            "lastTwelveMonths": last_twelve_months,
            "yearlySales": yearly_sales,
            "goalPercent": goal_pct,
            "forecastTotal": forecast_total,
        }
        _set("charts", result, ttl=600)  # 10-minute cache
        return jsonify(result), 200
    except Exception as e:
        print("Dashboard charts error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@dashboard_bp.route("/api/dashboard/insights", methods=["GET"])
def get_dashboard_insights():
    cached = _get("insights")
    if cached:
        return jsonify(cached), 200

    conn = get_connection()
    cur = conn.cursor()
    try:
        today = date.today()
        thirty_days_ago = today - timedelta(days=30)

        # Shared CTE: units sold per inventory item in last 30 days
        sales_cte = """
            WITH sales_30d AS (
                SELECT od.inventory_id, COALESCE(SUM(od.order_quantity), 0) AS units_sold
                FROM order_details od
                JOIN sales_transaction st ON st.order_id = od.order_id
                JOIN static_status ss ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
                GROUP BY od.inventory_id
            )
        """

        # --- Smart Reorder: low-stock items ---
        cur.execute(sales_cte + """
            SELECT i.inventory_id, i.item_name,
                   COALESCE((SELECT ib2.item_sku FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS sku,
                   COALESCE((SELECT b2.brand_name FROM inventory_brands ib2 JOIN brand b2 ON ib2.brand_id = b2.brand_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS brand,
                   i.total_quantity AS item_quantity,
                   COALESCE(ia.reorder_qty, 10) AS reorder_qty,
                   COALESCE(s.units_sold, 0) AS units_sold_30d,
                   COALESCE((SELECT u2.uom_code FROM inventory_brands ib2 JOIN unit_of_measure u2 ON ib2.unit_of_measure = u2.uom_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS uom,
                   COALESCE((SELECT ib2.item_description FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS item_description
            FROM inventory i
            LEFT JOIN inventory_action ia ON ia.inventory_id = i.inventory_id
            LEFT JOIN sales_30d s ON s.inventory_id = i.inventory_id
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ss.status_code != 'INACTIVE'
              AND i.total_quantity <= COALESCE(ia.reorder_qty, 10)
            ORDER BY item_quantity ASC
            LIMIT 5
        """, (thirty_days_ago,))

        reorder_rows = cur.fetchall()
        reorder_suggestions = []
        for row in reorder_rows:
            inv_id, name, sku, brand, qty, reorder_qty, units_sold_30d, uom, description = row
            daily_rate = float(units_sold_30d) / 30 if units_sold_30d else 0
            forecast_demand = round(daily_rate * 30) if daily_rate > 0 else int(reorder_qty)
            safety_stock = round(daily_rate * 7) if daily_rate > 0 else round(int(reorder_qty) * 0.2)
            recommended = max(forecast_demand + safety_stock - int(qty), int(reorder_qty))
            reorder_suggestions.append({
                "inventory_id": inv_id,
                "item_name": name,
                "sku": sku or f"SKU{inv_id:06d}",
                "brand": brand or "",
                "description": description or "",
                "uom": uom,
                "current_qty": int(qty),
                "forecast_demand": forecast_demand,
                "safety_stock": safety_stock,
                "recommended_qty": recommended,
                "note": "Restock to meet forecasted demand",
            })

        # --- Stockout Predictions: items with stock that will run out ---
        cur.execute(sales_cte + """
            SELECT i.inventory_id, i.item_name,
                   COALESCE((SELECT ib2.item_sku FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS sku,
                   COALESCE((SELECT b2.brand_name FROM inventory_brands ib2 JOIN brand b2 ON ib2.brand_id = b2.brand_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS brand,
                   i.total_quantity AS item_quantity,
                   COALESCE(s.units_sold, 0) AS units_sold_30d,
                   COALESCE(ia.reorder_qty, 10) AS reorder_qty,
                   COALESCE((SELECT u2.uom_code FROM inventory_brands ib2 JOIN unit_of_measure u2 ON ib2.unit_of_measure = u2.uom_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS uom,
                   COALESCE((SELECT ib2.item_description FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS item_description
            FROM inventory i
            LEFT JOIN inventory_action ia ON ia.inventory_id = i.inventory_id
            LEFT JOIN sales_30d s ON s.inventory_id = i.inventory_id
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ss.status_code != 'INACTIVE'
              AND i.total_quantity > 0
              AND COALESCE(s.units_sold, 0) > 0
            ORDER BY (i.total_quantity::float / (COALESCE(s.units_sold, 1)::float / 30)) ASC
            LIMIT 5
        """, (thirty_days_ago,))

        stockout_rows = cur.fetchall()
        stockout_predictions = []
        for row in stockout_rows:
            inv_id, name, sku, brand, qty, units_sold_30d, reorder_qty, uom, description = row
            daily_rate = float(units_sold_30d) / 30
            days_remaining = int(float(qty) / daily_rate) if daily_rate > 0 else 9999
            stockout_dt = today + timedelta(days=days_remaining)
            is_low = int(qty) <= int(reorder_qty)
            stockout_predictions.append({
                "inventory_id": inv_id,
                "item_name": name,
                "sku": sku or f"SKU{inv_id:06d}",
                "brand": brand or "",
                "description": description or "",
                "uom": uom,
                "current_qty": int(qty),
                "daily_rate": round(daily_rate, 1),
                "days_remaining": days_remaining,
                "stockout_date": stockout_dt.strftime("%B %d, %Y"),
                "is_low_stock": is_low,
            })

        result = {
            "reorderSuggestions": reorder_suggestions,
            "stockoutPredictions": stockout_predictions,
        }
        _set("insights", result, ttl=600)  # 10-minute cache
        return jsonify(result), 200
    except Exception as e:
        print("Dashboard insights error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ──  FOR LOW STOCK ITEMS TABLE IN DASHBOARD ───────────────────────────────
def get_low_stock_items_data():
    cached = _get("low_stock_items")
    if cached:
        return cached

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT DISTINCT ON (i.inventory_id)
                i.inventory_id,
                i.item_name,
                COALESCE((SELECT ib2.item_sku FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS sku,
                i.total_quantity AS current_qty,
                COALESCE((SELECT u2.uom_code FROM inventory_brands ib2 JOIN unit_of_measure u2 ON ib2.unit_of_measure = u2.uom_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS uom,
                COALESCE(ia.reorder_qty, 10) AS reorder_qty,
                COALESCE((SELECT b2.brand_name FROM inventory_brands ib2 JOIN brand b2 ON ib2.brand_id = b2.brand_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS brand,
                COALESCE((SELECT ib2.item_description FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS description,
                COALESCE((SELECT ib2.item_unit_price FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), 0) AS unit_price,
                COALESCE((SELECT ib2.item_selling_price FROM inventory_brands ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), 0) AS selling_price,
                ss.status_code AS status,
                COALESCE(s.supplier_name, '') AS supplier_name
            FROM inventory i
            LEFT JOIN inventory_action ia ON ia.inventory_id = i.inventory_id
            LEFT JOIN static_status ss ON i.item_status_id = ss.status_id
            LEFT JOIN inventory_supplier ins ON ins.inventory_id = i.inventory_id
            LEFT JOIN supplier s ON s.supplier_id = ins.supplier_id
            WHERE ss.status_code != 'INACTIVE'
            AND i.total_quantity <= COALESCE(ia.reorder_qty, 10)
            ORDER BY i.inventory_id, current_qty ASC
        """)
        rows = cur.fetchall()
        result = [
            {
                "inventory_id": r[0],
                "item_name": r[1],
                "sku": r[2] or f"SKU{r[0]:06d}",
                "current_qty": int(r[3]),
                "uom": r[4],
                "reorder_qty": int(r[5]),
                "brand": r[6],
                "description": r[7],
                "unit_price": float(r[8]),
                "selling_price": float(r[9]),
                "status": r[10],
                "supplier_name": r[11],
            }
            for r in rows
        ]
        _set("low_stock_items", result, ttl=120)
        return result
    except Exception as e:
        print("Low stock items error:", str(e))
        return []
    finally:
        cur.close()
        conn.close()

# ── 5. ALL-IN-ONE DASHBOARD ──────────────────────────────────────────────────
@dashboard_bp.route("/api/dashboard/all", methods=["GET"])
def get_dashboard_all():
    metrics_data    = _get("metrics")
    orders_data     = _get("recent_orders")
    charts_data     = _get("charts")
    insights_data   = _get("insights")
    low_stock_data  = _get("low_stock_items")  # ← add this

    if metrics_data is None:
        metrics_data = get_dashboard_metrics()[0].get_json()
    if orders_data is None:
        orders_data = get_recent_orders()[0].get_json()
    if charts_data is None:
        charts_data = get_dashboard_charts()[0].get_json()
    if insights_data is None:
        insights_data = get_dashboard_insights()[0].get_json()
    if low_stock_data is None:
        low_stock_data = get_low_stock_items_data()  # ← add this

    return jsonify({
        "metrics":       metrics_data,
        "recentOrders":  orders_data,
        "charts":        charts_data,
        "insights":      insights_data,
        "lowStockItems": low_stock_data,  # ← add this
    }), 200


# ── 6. QUICK STATUS TOGGLE ───────────────────────────────────────────────────
@dashboard_bp.route("/api/dashboard/order-status/<string:order_id>", methods=["PATCH", "OPTIONS"])
def update_order_status(order_id: str):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json(silent=True) or {}
        target_status = data.get("status", "RECEIVED").upper()
        if target_status not in ("PREPARING", "TO SHIP", "RECEIVED"):
            return jsonify({"error": "Invalid target status"}), 400
        cur.execute("""
            SELECT ss.status_code
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ot.order_id = %s
        """, (order_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Order not found"}), 404
        current_status = row[0]
        allowed = {
            "PREPARING": ("PREPARING",),
            "TO SHIP":   ("PREPARING",),
            "RECEIVED":  ("PREPARING", "TO SHIP"),
        }
        if current_status not in allowed[target_status]:
            return jsonify({"error": f"Cannot move from {current_status} to {target_status}"}), 400
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_code = %s
        """, (target_status,))
        res = cur.fetchone()
        if not res:
            return jsonify({"error": f"{target_status} status not found"}), 404
        cur.execute("UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s",
                    (res[0], order_id))
        conn.commit()
        _invalidate("metrics", "recent_orders")  # stale after status change
        return jsonify({"status": target_status}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── 6. ORDER RECEIPT ─────────────────────────────────────────────────────────
@dashboard_bp.route("/api/dashboard/order-receipt/<string:order_id>", methods=["GET"])
def get_order_receipt(order_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT ot.order_id, c.customer_name, COALESCE(c.customer_address, '') AS customer_address,
                   ot.order_date, ot.total_amount,
                   ss.status_code, COALESCE(pm.status_name, 'Cash') AS payment_method
            FROM order_transaction ot
            JOIN customer c ON ot.customer_id = c.customer_id
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            LEFT JOIN static_status pm ON ot.payment_method_id = pm.status_id
            WHERE ot.order_id = %s
        """, (order_id,))
        order_row = cur.fetchone()
        if not order_row:
            return jsonify({"error": "Order not found"}), 404
        oid, customer_name, customer_address, order_date, total_amount, status, payment_method = order_row
        cur.execute("""
            SELECT i.item_name, od.order_quantity, od.order_total,
                   COALESCE(u.uom_code, '') AS uom,
                   CASE WHEN od.order_quantity > 0 THEN od.order_total / od.order_quantity ELSE 0 END AS unit_price
            FROM order_details od
            JOIN inventory i ON i.inventory_id = od.inventory_id
            LEFT JOIN LATERAL (
                SELECT u2.uom_code FROM inventory_brands ib
                JOIN unit_of_measure u2 ON ib.unit_of_measure = u2.uom_id
                WHERE ib.inventory_id = i.inventory_id LIMIT 1
            ) u ON true
            WHERE od.order_id = %s
        """, (order_id,))
        items = [
            {
                "item_name": r[0],
                "quantity": int(r[1]),
                "unit_price": float(r[4] or 0),
                "total": float(r[2] or 0),
                "uom": r[3],
            }
            for r in cur.fetchall()
        ]
        return jsonify({
            "orderId": oid,
            "customerName": customer_name,
            "customerAddress": customer_address,
            "orderDate": order_date.strftime("%m/%d/%y") if order_date else "",
            "totalAmount": float(total_amount or 0),
            "status": status,
            "paymentMethod": payment_method,
            "items": items,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()