from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta

reports_bp = Blueprint("reports", __name__)

def parse_dates():
    """
    Pull start_date / end_date from query-string.
    Defaults: first day of current month → today.
    """
    today     = date.today()
    start_str = request.args.get("start_date")
    end_str   = request.args.get("end_date")
    try:
        start = date.fromisoformat(start_str) if start_str else today.replace(day=1)
    except ValueError:
        start = today.replace(day=1)
    try:
        end = date.fromisoformat(end_str) if end_str else today
    except ValueError:
        end = today
    if start > end:
        start, end = end, start
    return start, end


def _fetch_action_map(cur):
    """
    Safely load inventory_action without assuming the FK column name.
    Detects the linking column dynamically from information_schema.
    Returns: dict[ inventory_brand_id_or_inventory_id → {reorder_qty, min_order_qty, lead_time_days, low_stock_qty} ]
    """
    try:
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'inventory_action'
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cur.fetchall()]
        if not cols:
            return {}

        fk_col = None
        for preferred in ('inventory_brand_id', 'inventory_id'):
            if preferred in cols:
                fk_col = preferred
                break
        if not fk_col:
            for c in cols:
                if 'inventory' in c.lower():
                    fk_col = c
                    break
        if not fk_col:
            print("[reports] inventory_action: FK column not found. Available:", cols)
            return {}

        cur.execute(
            f'SELECT "{fk_col}", low_stock_qty, reorder_qty, min_order_qty, lead_time_days '
            f'FROM inventory_action'
        )
        return {
            r[0]: {
                "low_stock_qty":  int(r[1] or 0),
                "reorder_qty":    int(r[2] or 0),
                "min_order_qty":  int(r[3] or 0),
                "lead_time_days": int(r[4] or 0),
            }
            for r in cur.fetchall()
        }
    except Exception as exc:
        print("[reports] inventory_action lookup error:", exc)
        return {}


def err(msg, code=500):
    return jsonify({"error": str(msg)}), code

@reports_bp.route("/api/reports/sales", methods=["GET"])
def get_sales_report():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        today          = date.today()
        start_of_week  = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)
        start_of_year  = today.replace(month=1, day=1)

        def get_sales(start_date):
            cur.execute("""
                SELECT COALESCE(SUM(ot.total_amount), 0)
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN static_status ss     ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
            """, (start_date,))
            return float(cur.fetchone()[0] or 0)

        return jsonify({
            "weekly":  get_sales(start_of_week),
            "monthly": get_sales(start_of_month),
            "yearly":  get_sales(start_of_year),
        }), 200
    except Exception as e:
        print("[reports/sales] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/extra", methods=["GET"])
def get_dashboard_extra():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        today            = date.today()
        this_month_start = today.replace(day=1)
        last_month_end   = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        current_day      = today.day
        try:
            last_month_same_day = last_month_start.replace(day=current_day)
        except ValueError:
            last_month_same_day = last_month_end

        # ── Total Orders ──
        cur.execute("SELECT COUNT(order_id) FROM order_transaction")
        total_orders = int(cur.fetchone()[0] or 0)

        cur.execute("SELECT COUNT(order_id) FROM order_transaction WHERE order_date >= %s", (this_month_start,))
        curr_orders = int(cur.fetchone()[0] or 0)

        cur.execute(
            "SELECT COUNT(order_id) FROM order_transaction WHERE order_date >= %s AND order_date <= %s",
            (last_month_start, last_month_same_day)
        )
        prev_orders = int(cur.fetchone()[0] or 0)
        orders_growth = (
            round(((curr_orders - prev_orders) / prev_orders) * 100, 1)
            if prev_orders > 0 else (100.0 if curr_orders > 0 else 0.0)
        )

        def paid_sales(start_d, end_d=None):
            if end_d:
                cur.execute("""
                    SELECT COALESCE(SUM(ot.total_amount), 0)
                    FROM sales_transaction st
                    JOIN order_transaction ot ON st.order_id = ot.order_id
                    JOIN static_status ss     ON st.payment_status_id = ss.status_id
                    WHERE ss.status_code = 'PAID' AND st.sales_date >= %s AND st.sales_date <= %s
                """, (start_d, end_d))
            else:
                cur.execute("""
                    SELECT COALESCE(SUM(ot.total_amount), 0)
                    FROM sales_transaction st
                    JOIN order_transaction ot ON st.order_id = ot.order_id
                    JOIN static_status ss     ON st.payment_status_id = ss.status_id
                    WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
                """, (start_d,))
            return float(cur.fetchone()[0] or 0)

        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss     ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
        """)
        total_sales = float(cur.fetchone()[0] or 0)

        curr_sales = paid_sales(this_month_start)
        prev_sales = paid_sales(last_month_start, last_month_same_day)
        sales_growth = (
            round(((curr_sales - prev_sales) / prev_sales) * 100, 1)
            if prev_sales > 0 else (100.0 if curr_sales > 0 else 0.0)
        )

        cur.execute("""
            SELECT c.customer_name, COUNT(ot.order_id) AS total_orders
            FROM order_transaction ot
            JOIN customer c ON ot.customer_id = c.customer_id
            GROUP BY c.customer_name
            ORDER BY total_orders DESC
            LIMIT 3
        """)
        top_clients_db = cur.fetchall()
        max_c = max((int(r[1]) for r in top_clients_db), default=1) or 1
        top_clients = [
            {"name": r[0] or "Unknown", "orders": int(r[1]),
             "percentage": round((int(r[1]) / max_c) * 100, 1)}
            for r in top_clients_db
        ]

        cur.execute("""
            SELECT i.item_name, ib.total_quantity
            FROM inventory_brand ib
            JOIN inventory i      ON i.inventory_id = ib.inventory_id
            JOIN static_status ss ON ss.status_id   = i.item_status_id
            WHERE ss.status_scope = 'INVENTORY_STATUS' AND ss.status_code != 'INACTIVE'
            ORDER BY ib.total_quantity DESC
            LIMIT 3
        """)
        most_stock_db = cur.fetchall()
        max_s = max((int(r[1]) for r in most_stock_db), default=1) or 1
        most_stock = [
            {"name": r[0] or "Unknown", "qty": int(r[1]),
             "percentage": round((int(r[1]) / max_s) * 100, 1)}
            for r in most_stock_db
        ]

        cur.execute("""
            SELECT EXTRACT(YEAR FROM st.sales_date) AS yr,
                   COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss     ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
            GROUP BY yr
            ORDER BY yr DESC
            LIMIT 8
        """)
        yh_db = cur.fetchall()
        max_y = max((float(r[1]) for r in yh_db), default=1) or 1
        yearly_history = [
            {"year": int(r[0] or today.year), "sales": float(r[1]),
             "percentage": round((float(r[1]) / max_y) * 100, 1)}
            for r in yh_db
        ]

        return jsonify({
            "totals":        {"orders": total_orders, "ordersGrowth": orders_growth,
                              "sales": total_sales, "salesGrowth": sales_growth},
            "topClients":    top_clients,
            "mostStock":     most_stock,
            "yearlyHistory": yearly_history,
        }), 200
    except Exception as e:
        print("[reports/extra] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/stock-on-hand", methods=["GET"])
def report_stock_on_hand():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        search = (request.args.get("search") or "").strip().lower()

        cur.execute("""
            SELECT
                COALESCE(ib.item_sku, '—')              AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')        AS brand_name,
                COALESCE(u.uom_name,  '—')               AS uom,
                ib.total_quantity                         AS qty_on_hand,
                COALESCE(ib.item_unit_price,   0)        AS unit_cost,
                COALESCE(ib.item_selling_price, 0)       AS selling_price,
                ss_i.status_code                          AS item_status,
                i.inventory_id,
                ib.inventory_brand_id,
                ib.shelf_life
            FROM inventory_brand ib
            JOIN inventory         i    ON i.inventory_id   = ib.inventory_id
            LEFT JOIN brand        b    ON b.brand_id       = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id         = ib.uom_id
            JOIN static_status     ss_i ON ss_i.status_id  = i.item_status_id
            JOIN static_status     ss_b ON ss_b.status_id  = ib.item_status_id
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            ORDER BY i.item_name, b.brand_name
        """)
        rows = cur.fetchall()

        action_map = _fetch_action_map(cur)

        result = []
        for r in rows:
            item_name  = r[1] or ""
            brand_name = r[2] or ""
            sku        = r[0] or ""

            if search and search not in item_name.lower() and search not in brand_name.lower() and search not in sku.lower():
                continue

            qty         = int(r[4] or 0)
            status_code = r[7]
            action = action_map.get(r[9]) or action_map.get(r[8]) or {}
            reorder_qty  = action.get("reorder_qty", 0)
            low_stock_qty = action.get("low_stock_qty", 0)
            threshold    = reorder_qty or low_stock_qty

            shelf_life = r[10]
            expiry_date = shelf_life.date() if shelf_life else None
            days_to_expiry = (expiry_date - date.today()).days if expiry_date else None

            if status_code == 'INACTIVE':
                stock_status = 'Archived'
            elif qty == 0:
                stock_status = 'Out of Stock'
            elif days_to_expiry is not None and days_to_expiry <= 30:
                stock_status = 'Expiring Soon'
            elif threshold > 0 and qty <= threshold:
                stock_status = 'Low Stock'
            else:
                stock_status = 'Available'

            result.append({
                "sku":            sku,
                "item_name":      item_name,
                "brand_name":     brand_name,
                "uom":            r[3],
                "qty_on_hand":    qty,
                "unit_cost":      float(r[5] or 0),
                "selling_price":  float(r[6] or 0),
                "stock_status":   stock_status,
                "shelf_life":     expiry_date.isoformat() if expiry_date else None,
                "days_to_expiry": days_to_expiry,
            })

        return jsonify(result), 200
    except Exception as e:
        print("[reports/stock-on-hand] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/product-performance", methods=["GET"])
def report_product_performance():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        start, end = parse_dates()
        cur.execute("""
            SELECT
                i.item_name,
                COALESCE(b.brand_name, 'Generic')                       AS brand_name,
                COALESCE(ib.item_sku, '—')                              AS sku,
                COALESCE(u.uom_name, '—')                               AS uom,
                COALESCE(SUM(od.order_quantity), 0)                      AS units_sold,
                COALESCE(SUM(od.order_total), 0)                         AS revenue,
                COALESCE(SUM(od.order_quantity * ib.item_unit_price), 0) AS cogs,
                COALESCE(
                    SUM(od.order_total) - SUM(od.order_quantity * ib.item_unit_price),
                    0
                )                                                         AS gross_profit
            FROM order_details od
            JOIN order_transaction ot  ON ot.order_id  = od.order_id
            JOIN sales_transaction st  ON st.order_id  = ot.order_id
            JOIN static_status ss_pay  ON ss_pay.status_id = st.payment_status_id
            JOIN inventory_brand ib    ON ib.inventory_brand_id = od.inventory_brand_id
            JOIN inventory       i     ON i.inventory_id = ib.inventory_id
            LEFT JOIN brand      b     ON b.brand_id     = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id      = ib.uom_id
            WHERE ss_pay.status_code = 'PAID'
              AND st.sales_date BETWEEN %s AND %s
              AND od.is_archived = FALSE
            GROUP BY i.item_name, b.brand_name, ib.item_sku, u.uom_name
            ORDER BY units_sold DESC, revenue DESC
        """, (start, end))
        rows = cur.fetchall()

        result = []
        for r in rows:
            revenue      = float(r[5] or 0)
            gross_profit = float(r[7] or 0)
            margin_pct   = round((gross_profit / revenue * 100), 2) if revenue > 0 else 0.0
            result.append({
                "item_name":    r[0],
                "brand_name":   r[1],
                "sku":          r[2],
                "uom":          r[3],
                "units_sold":   int(r[4] or 0),
                "revenue":      revenue,
                "cogs":         float(r[6] or 0),
                "gross_profit": gross_profit,
                "margin_pct":   margin_pct,
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/product-performance] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/inventory-turnover", methods=["GET"])
def report_inventory_turnover():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        start, end  = parse_dates()
        period_days = max((end - start).days, 1)

        cur.execute("""
            SELECT
                COALESCE(ib.item_sku, '—')              AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')        AS brand_name,
                COALESCE(u.uom_name, '—')                AS uom,
                COALESCE(SUM(od.order_quantity), 0)       AS units_sold,
                ib.total_quantity                         AS ending_qty,
                COALESCE(SUM(od.order_total), 0)          AS period_revenue,
                COALESCE(SUM(od.order_quantity * ib.item_unit_price), 0) AS period_cogs
            FROM inventory_brand ib
            JOIN inventory       i     ON i.inventory_id = ib.inventory_id
            LEFT JOIN brand      b     ON b.brand_id     = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id      = ib.uom_id
            JOIN static_status ss_i    ON ss_i.status_id = i.item_status_id
            JOIN static_status ss_b    ON ss_b.status_id = ib.item_status_id
            LEFT JOIN order_details od ON od.inventory_brand_id = ib.inventory_brand_id
                AND od.is_archived = FALSE
                AND od.order_id IN (
                    SELECT ot2.order_id
                    FROM order_transaction ot2
                    JOIN sales_transaction st2   ON st2.order_id = ot2.order_id
                    JOIN static_status ss_pay2   ON ss_pay2.status_id = st2.payment_status_id
                    WHERE ss_pay2.status_code = 'PAID'
                      AND st2.sales_date BETWEEN %s AND %s
                )
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, ib.total_quantity
            ORDER BY units_sold DESC, i.item_name
        """, (start, end))
        rows = cur.fetchall()

        result = []
        for r in rows:
            units_sold   = int(r[4] or 0)
            ending_qty   = int(r[5] or 0)
            avg_inv      = (ending_qty + units_sold) / 2.0
            turnover     = round(units_sold / avg_inv, 2) if avg_inv > 0 else 0.0
            days_to_sell = round(period_days / turnover, 1) if turnover > 0 else None
            result.append({
                "sku":           r[0],
                "item_name":     r[1],
                "brand_name":    r[2],
                "uom":           r[3],
                "units_sold":    units_sold,
                "ending_qty":    ending_qty,
                "avg_inventory": round(avg_inv, 1),
                "turnover_rate": turnover,
                "days_to_sell":  days_to_sell,
                "period_cogs":   float(r[7] or 0),
            })
        return jsonify({"period_days": period_days, "rows": result}), 200
    except Exception as e:
        print("[reports/inventory-turnover] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/inventory-valuation", methods=["GET"])
def report_inventory_valuation():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT
                COALESCE(ib.item_sku, '—')                                      AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')                                AS brand_name,
                COALESCE(u.uom_name, '—')                                        AS uom,
                ib.total_quantity                                                  AS qty_on_hand,
                COALESCE(ib.item_unit_price,   0)                                AS unit_cost,
                ib.total_quantity * COALESCE(ib.item_unit_price,   0)            AS total_cost_value,
                COALESCE(ib.item_selling_price, 0)                               AS selling_price,
                ib.total_quantity * COALESCE(ib.item_selling_price, 0)           AS total_retail_value,
                (ib.total_quantity * COALESCE(ib.item_selling_price, 0))
                    - (ib.total_quantity * COALESCE(ib.item_unit_price, 0))      AS potential_profit
            FROM inventory_brand ib
            JOIN inventory       i    ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand      b    ON b.brand_id       = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id       = ib.uom_id
            JOIN static_status   ss_i ON ss_i.status_id  = i.item_status_id
            JOIN static_status   ss_b ON ss_b.status_id  = ib.item_status_id
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            ORDER BY total_cost_value DESC
        """)
        rows = cur.fetchall()
        cols = [
            "sku", "item_name", "brand_name", "uom", "qty_on_hand",
            "unit_cost", "total_cost_value", "selling_price",
            "total_retail_value", "potential_profit",
        ]
        result = [
            dict(zip(cols, [
                r[0], r[1], r[2], r[3], int(r[4] or 0),
                float(r[5] or 0), float(r[6] or 0), float(r[7] or 0),
                float(r[8] or 0), float(r[9] or 0),
            ]))
            for r in rows
        ]
        return jsonify(result), 200
    except Exception as e:
        print("[reports/inventory-valuation] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/stock-ageing", methods=["GET"])
def report_stock_ageing():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        today = date.today()
        cur.execute("""
            SELECT
                COALESCE(ib.item_sku, '—')          AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')    AS brand_name,
                COALESCE(u.uom_name, '—')             AS uom,
                ib.total_quantity                     AS qty_on_hand,
                MAX(st.sales_date)                    AS last_sold_date
            FROM inventory_brand ib
            JOIN inventory       i    ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand      b    ON b.brand_id       = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id       = ib.uom_id
            JOIN static_status   ss_i ON ss_i.status_id  = i.item_status_id
            JOIN static_status   ss_b ON ss_b.status_id  = ib.item_status_id
            LEFT JOIN order_details od ON od.inventory_brand_id = ib.inventory_brand_id
                                       AND od.is_archived = FALSE
            LEFT JOIN order_transaction ot ON ot.order_id = od.order_id
            LEFT JOIN sales_transaction st ON st.order_id = ot.order_id
            LEFT JOIN static_status ss_pay ON ss_pay.status_id = st.payment_status_id
                                          AND ss_pay.status_code = 'PAID'
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, ib.total_quantity
            ORDER BY last_sold_date ASC NULLS FIRST, i.item_name
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            last_sold  = r[5]
            days_since = (today - last_sold).days if last_sold else None

            if days_since is None:
                ageing_status = "Never Sold"
            elif days_since <= 30:
                ageing_status = "Active"
            elif days_since <= 90:
                ageing_status = "Slow-Moving"
            elif days_since <= 180:
                ageing_status = "At Risk"
            else:
                ageing_status = "Dead Stock"

            result.append({
                "sku":                  r[0],
                "item_name":            r[1],
                "brand_name":           r[2],
                "uom":                  r[3],
                "qty_on_hand":          int(r[4] or 0),
                "last_sold_date":       last_sold.isoformat() if last_sold else None,
                "days_since_last_sale": days_since,
                "ageing_status":        ageing_status,
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/stock-ageing] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/reorder", methods=["GET"])
def report_reorder():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        action_map = _fetch_action_map(cur)

        cur.execute("""
            SELECT
                COALESCE(ib.item_sku, '—')           AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')     AS brand_name,
                COALESCE(u.uom_name, '—')              AS uom,
                ib.total_quantity                      AS qty_on_hand,
                i.inventory_id,
                ib.inventory_brand_id,
                COALESCE(s.supplier_name,    '—')     AS primary_supplier,
                COALESCE(s.supplier_contact, '—')     AS supplier_contact
            FROM inventory_brand ib
            JOIN inventory         i    ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand        b    ON b.brand_id      = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id        = ib.uom_id
            JOIN static_status     ss_i ON ss_i.status_id = i.item_status_id
            LEFT JOIN LATERAL (
                SELECT s2.supplier_name, s2.supplier_contact
                FROM inventory_brand_supplier ibs2
                JOIN supplier s2 ON s2.supplier_id = ibs2.supplier_id
                WHERE ibs2.inventory_brand_id = ib.inventory_brand_id
                ORDER BY ibs2.inventory_brand_supplier_id
                LIMIT 1
            ) s ON TRUE
            WHERE ss_i.status_code != 'INACTIVE'
              AND EXISTS (
                SELECT 1 FROM static_status ss_b2
                WHERE ss_b2.status_id = ib.item_status_id
                  AND ss_b2.status_code != 'ARCHIVED'
              )
            ORDER BY i.item_name, b.brand_name
        """)
        rows = cur.fetchall()

        result = []
        for r in rows:
            inv_id  = r[5]
            ibrand_id = r[6]
            qty     = int(r[4] or 0)
            action  = action_map.get(ibrand_id) or action_map.get(inv_id) or {}
            reorder_qty   = action.get("reorder_qty",   0)
            low_stock_qty = action.get("low_stock_qty", 0)
            min_order_qty = action.get("min_order_qty", 0)
            lead_time     = action.get("lead_time_days", 0)

            threshold = reorder_qty or low_stock_qty
            if threshold <= 0 or qty > threshold:
                continue

            suggested = max(min_order_qty, threshold - qty)

            result.append({
                "sku":                 r[0],
                "item_name":           r[1],
                "brand_name":          r[2],
                "uom":                 r[3],
                "qty_on_hand":         qty,
                "reorder_point":       threshold,
                "min_order_qty":       min_order_qty,
                "lead_time_days":      lead_time,
                "suggested_order_qty": suggested,
                "primary_supplier":    r[7],
                "supplier_contact":    r[8],
            })

        result.sort(key=lambda x: x["qty_on_hand"] - x["reorder_point"])
        return jsonify(result), 200
    except Exception as e:
        print("[reports/reorder] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()

@reports_bp.route("/api/reports/customer-sales", methods=["GET"])
def report_customer_sales():
    conn = get_connection()
    cur  = conn.cursor()
    try:
        start, end = parse_dates()
        cur.execute("""
            SELECT
                c.customer_name,
                COUNT(DISTINCT ot.order_id)                                       AS total_orders,
                COALESCE(SUM(od.order_quantity), 0)                               AS total_qty,
                COALESCE(SUM(ot.total_amount),   0)                               AS total_revenue,
                COALESCE(SUM(od.order_quantity * ib.item_unit_price), 0)          AS total_cogs,
                COALESCE(SUM(ot.total_amount), 0)
                    - COALESCE(SUM(od.order_quantity * ib.item_unit_price), 0)    AS total_profit,
                STRING_AGG(DISTINCT pm.status_name, ', ')                         AS payment_methods
            FROM sales_transaction st
            JOIN static_status     ss_pay ON ss_pay.status_id = st.payment_status_id
            JOIN order_transaction  ot    ON ot.order_id  = st.order_id
            JOIN customer           c     ON c.customer_id = ot.customer_id
            LEFT JOIN static_status pm    ON pm.status_id  = ot.payment_method_id
            LEFT JOIN order_details od    ON od.order_id   = ot.order_id
                                         AND od.is_archived = FALSE
            LEFT JOIN inventory_brand ib  ON ib.inventory_brand_id = od.inventory_brand_id
            WHERE ss_pay.status_code = 'PAID'
              AND st.sales_date BETWEEN %s AND %s
            GROUP BY c.customer_name
            ORDER BY total_revenue DESC
        """, (start, end))
        rows = cur.fetchall()

        result = []
        for r in rows:
            total_revenue = float(r[3] or 0)
            total_orders  = int(r[1] or 0)
            total_profit  = float(r[5] or 0)
            avg_order_val = round(total_revenue / total_orders, 2) if total_orders > 0 else 0.0
            margin_pct    = round((total_profit / total_revenue * 100), 2) if total_revenue > 0 else 0.0
            result.append({
                "customer_name":   r[0] or "Unknown",
                "total_orders":    total_orders,
                "total_qty":       int(r[2] or 0),
                "total_revenue":   total_revenue,
                "total_cogs":      float(r[4] or 0),
                "total_profit":    total_profit,
                "margin_pct":      margin_pct,
                "avg_order_value": avg_order_val,
                "payment_methods": r[6] or "—",
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/customer-sales] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()