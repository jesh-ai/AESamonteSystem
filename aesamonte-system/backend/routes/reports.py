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
            SELECT i.item_name, COALESCE(SUM(bat.quantity_on_hand), 0) AS total_qty
            FROM inventory_brand ib
            JOIN inventory i      ON i.inventory_id = ib.inventory_id
            JOIN static_status ss ON ss.status_id   = i.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
            WHERE ss.status_scope = 'INVENTORY_STATUS' AND ss.status_code != 'INACTIVE'
            GROUP BY i.item_name
            ORDER BY total_qty DESC
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
                COALESCE(ib.item_sku, '—')                                          AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')                                    AS brand_name,
                COALESCE(u.uom_name,  '—')                                           AS uom,
                COALESCE(SUM(bat.quantity_on_hand), 0)                               AS qty_on_hand,
                COALESCE(fefo.unit_cost, 0)                                          AS unit_cost,
                COALESCE(ib.item_selling_price, 0)                                   AS selling_price,
                ss_i.status_code                                                      AS item_status,
                i.inventory_id,
                ib.inventory_brand_id,
                MIN(bat.expiry_date)                                                  AS shelf_life,
                ss_b.status_code                                                      AS brand_status
            FROM inventory_brand ib
            JOIN inventory         i    ON i.inventory_id   = ib.inventory_id
            LEFT JOIN brand        b    ON b.brand_id       = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id         = ib.uom_id
            JOIN static_status     ss_i ON ss_i.status_id  = i.item_status_id
            JOIN static_status     ss_b ON ss_b.status_id  = ib.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
            LEFT JOIN LATERAL (
                SELECT unit_cost FROM inventory_batch
                WHERE inventory_brand_id = ib.inventory_brand_id
                  AND expiry_date > CURRENT_DATE
                  AND batch_status_id != (
                      SELECT status_id FROM static_status
                      WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                  )
                ORDER BY expiry_date ASC
                LIMIT 1
            ) fefo ON TRUE
            WHERE ss_i.status_code != 'INACTIVE'
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, ib.item_selling_price,
                     ss_i.status_code, i.inventory_id, ss_b.status_code, fefo.unit_cost
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

            qty          = int(r[4] or 0)
            status_code  = r[7]    # parent inventory status (ss_i)
            brand_status = r[11]   # brand-level status (ss_b = ib.item_status_id)

            shelf_life = r[10]
            if shelf_life is None:
                expiry_date = None
            elif hasattr(shelf_life, 'date'):
                expiry_date = shelf_life.date()
            else:
                expiry_date = shelf_life
            days_to_expiry = (expiry_date - date.today()).days if expiry_date else None

            # Archived always wins — driven by parent inventory status (ss_i)
            if status_code == 'ARCHIVED':
                stock_status = 'Archived'
            elif qty == 0 or brand_status == 'OUT_OF_STOCK':
                stock_status = 'Out of Stock'
            elif days_to_expiry is not None and days_to_expiry <= 30:
                stock_status = 'Expiring Soon'
            elif brand_status == 'LOW_STOCK':
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

        # Sort: Out of Stock first, then Low Stock, then Expiring Soon, then Available
        STATUS_PRIORITY = {'Out of Stock': 0, 'Low Stock': 1, 'Expiring Soon': 2, 'Available': 3, 'Archived': 4}
        result.sort(key=lambda x: (STATUS_PRIORITY.get(x['stock_status'], 9), x['item_name']))

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
        start_str = request.args.get("start_date")
        end_str   = request.args.get("end_date")
        use_dates = bool(start_str or end_str)
        if use_dates:
            start, end = parse_dates()
            date_filter = "AND st.sales_date BETWEEN %s AND %s"
            params: tuple = (start, end)
        else:
            date_filter = ""
            params = ()

        # Diagnostic: check what's in order_details
        cur.execute("""
            SELECT COUNT(*), COUNT(batch_id), COALESCE(SUM(order_quantity),0), COALESCE(SUM(order_total),0)
            FROM order_details WHERE is_archived IS NOT TRUE
        """)
        diag = cur.fetchone()
        print(f"[product-performance] order_details: rows={diag[0]}, with_batch={diag[1]}, qty={diag[2]}, revenue={diag[3]}")

        cur.execute(f"""
            SELECT
                i.item_name,
                COALESCE(b.brand_name, 'Generic')                                     AS brand_name,
                COALESCE(ib.item_sku, '—')                                            AS sku,
                COALESCE(u.uom_name, '—')                                             AS uom,
                COALESCE(sales.qty_sold, 0)                                           AS qty_sold,
                COALESCE(sales.qty_sold, 0) * COALESCE(ib.item_selling_price, 0)      AS gross_sales,
                COALESCE(sales.cogs, 0)                                               AS cogs,
                (COALESCE(sales.qty_sold, 0) * COALESCE(ib.item_selling_price, 0))
                    - COALESCE(sales.cogs, 0)                                         AS net_profit
            FROM inventory_brand ib
            JOIN  inventory        i   ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand        b   ON b.brand_id      = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id       = ib.uom_id
            JOIN  static_status  ss_i  ON ss_i.status_id  = i.item_status_id
            JOIN  static_status  ss_b  ON ss_b.status_id  = ib.item_status_id
            LEFT JOIN (
                SELECT
                    bat.inventory_brand_id,
                    SUM(od.order_quantity)                               AS qty_sold,
                    SUM(od.order_quantity * COALESCE(bat.unit_cost, 0))  AS cogs
                FROM order_details od
                JOIN inventory_batch bat ON bat.batch_id = od.batch_id
                JOIN order_transaction ot ON ot.order_id = od.order_id
                JOIN sales_transaction st ON st.order_id = ot.order_id
                WHERE od.is_archived IS NOT TRUE
                  {date_filter}
                GROUP BY bat.inventory_brand_id
            ) sales ON sales.inventory_brand_id = ib.inventory_brand_id
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            GROUP BY i.item_name, b.brand_name, ib.item_sku, u.uom_name,
                     sales.qty_sold, sales.cogs, ib.item_selling_price
            ORDER BY net_profit DESC
        """, params)
        rows = cur.fetchall()
        print(f"[product-performance] result rows={len(rows)}, sample={rows[:2]}")

        total_revenue = sum(float(r[5] or 0) for r in rows)

        result = []
        for r in rows:
            gross_sales  = float(r[5] or 0)
            net_profit   = float(r[7] or 0)
            contribution = round((gross_sales / total_revenue * 100), 2) if total_revenue > 0 else 0.0
            result.append({
                "item_name":    r[0],
                "brand_name":   r[1],
                "sku":          r[2],
                "uom":          r[3],
                "units_sold":   int(r[4] or 0),
                "revenue":      gross_sales,
                "cogs":         float(r[6] or 0),
                "gross_profit": net_profit,
                "margin_pct":   contribution,
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/product-performance] error:", e)
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
                COALESCE(ib.item_sku, '—')                                                   AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')                                             AS brand_name,
                COALESCE(u.uom_name, '—')                                                     AS uom,
                COALESCE(SUM(bat.quantity_on_hand), 0)                                        AS qty_on_hand,
                COALESCE(fefo.unit_cost, 0)                                                   AS unit_cost,
                COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(fefo.unit_cost, 0)          AS total_cost_value,
                COALESCE(ib.item_selling_price, 0)                                            AS selling_price,
                COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(ib.item_selling_price, 0)   AS total_retail_value,
                (COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(ib.item_selling_price, 0))
                    - (COALESCE(SUM(bat.quantity_on_hand), 0) * COALESCE(fefo.unit_cost, 0))  AS potential_profit
            FROM inventory_brand ib
            JOIN inventory       i    ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand      b    ON b.brand_id       = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id       = ib.uom_id
            JOIN static_status   ss_i ON ss_i.status_id  = i.item_status_id
            JOIN static_status   ss_b ON ss_b.status_id  = ib.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
            LEFT JOIN LATERAL (
                SELECT unit_cost FROM inventory_batch
                WHERE inventory_brand_id = ib.inventory_brand_id
                  AND expiry_date > CURRENT_DATE
                  AND batch_status_id != (
                      SELECT status_id FROM static_status
                      WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                  )
                ORDER BY expiry_date ASC
                LIMIT 1
            ) fefo ON TRUE
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, ib.item_selling_price, fefo.unit_cost
            ORDER BY potential_profit DESC
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            potential_profit = float(r[9] or 0)
            if potential_profit > 0:
                profit_status = 'Profitable'
            elif potential_profit < 0:
                profit_status = 'Loss'
            else:
                profit_status = 'Break-even'
            result.append({
                "sku":              r[0], "item_name": r[1], "brand_name": r[2], "uom": r[3],
                "qty_on_hand":      int(r[4] or 0),
                "unit_cost":        float(r[5] or 0),
                "total_cost_value": float(r[6] or 0),
                "selling_price":    float(r[7] or 0),
                "total_retail_value": float(r[8] or 0),
                "potential_profit": potential_profit,
                "profit_status":    profit_status,
            })
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
                i.item_name,
                COALESCE(b.brand_name, 'Generic')              AS brand_name,
                COALESCE(u.uom_name, '—')                      AS uom,
                COALESCE(SUM(bat.quantity_on_hand), 0)         AS qty_on_hand,
                MAX(bat.date_created)                          AS last_received_date,
                COALESCE(fefo.unit_cost, 0)                    AS unit_cost
            FROM inventory_brand ib
            JOIN inventory       i    ON i.inventory_id   = ib.inventory_id
            LEFT JOIN brand      b    ON b.brand_id        = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id        = ib.uom_id
            JOIN static_status   ss_i ON ss_i.status_id   = i.item_status_id
            JOIN static_status   ss_b ON ss_b.status_id   = ib.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.quantity_on_hand > 0
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
            LEFT JOIN LATERAL (
                SELECT unit_cost FROM inventory_batch
                WHERE inventory_brand_id = ib.inventory_brand_id
                  AND expiry_date > CURRENT_DATE
                  AND batch_status_id != (
                      SELECT status_id FROM static_status
                      WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                  )
                ORDER BY expiry_date ASC
                LIMIT 1
            ) fefo ON TRUE
            WHERE ss_i.status_code != 'INACTIVE'
              AND ss_b.status_code != 'ARCHIVED'
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, fefo.unit_cost
            ORDER BY last_received_date ASC NULLS FIRST, i.item_name
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            qty              = int(r[3] or 0)
            last_received    = r[4]
            unit_cost        = float(r[5] or 0)

            if last_received:
                if hasattr(last_received, 'date'):
                    last_received = last_received.date()
                days_in = (today - last_received).days
            else:
                days_in = None

            if days_in is None:
                ageing_category = '—'
                ageing_status   = 'Fresh'
            elif days_in <= 30:
                ageing_category = '0–30 days'
                ageing_status   = 'Fresh'
            elif days_in <= 60:
                ageing_category = '31–60 days'
                ageing_status   = 'Ageing'
            elif days_in <= 90:
                ageing_category = '61–90 days'
                ageing_status   = 'Old'
            else:
                ageing_category = '90+ days'
                ageing_status   = 'Critical'

            value_of_aged_stock = qty * unit_cost

            result.append({
                "item_name":           r[0],
                "brand_name":          r[1],
                "uom":                 r[2],
                "qty_on_hand":         qty,
                "last_received_date":  last_received.isoformat() if last_received else None,
                "days_in_inventory":   days_in,
                "ageing_category":     ageing_category,
                "value_of_aged_stock": round(value_of_aged_stock, 2),
                "ageing_status":       ageing_status,
            })

        AGEING_PRIORITY = {'Critical': 0, 'Old': 1, 'Ageing': 2, 'Fresh': 3}
        result.sort(key=lambda x: (AGEING_PRIORITY.get(x['ageing_status'], 9), -(x['days_in_inventory'] or 0)))

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
                COALESCE(ib.item_sku, '—')                    AS sku,
                i.item_name,
                COALESCE(b.brand_name, 'Generic')              AS brand_name,
                COALESCE(u.uom_name, '—')                      AS uom,
                COALESCE(SUM(bat.quantity_on_hand), 0)         AS qty_on_hand,
                i.inventory_id,
                ib.inventory_brand_id,
                COALESCE(s.supplier_name,    '—')              AS primary_supplier,
                COALESCE(s.supplier_contact, '—')              AS supplier_contact
            FROM inventory_brand ib
            JOIN inventory         i    ON i.inventory_id  = ib.inventory_id
            LEFT JOIN brand        b    ON b.brand_id      = ib.brand_id
            LEFT JOIN unit_of_measure u ON u.uom_id        = ib.uom_id
            JOIN static_status     ss_i ON ss_i.status_id = i.item_status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
                AND bat.batch_status_id != (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'ARCHIVED'
                )
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
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     ib.item_sku, u.uom_name, i.inventory_id,
                     s.supplier_name, s.supplier_contact
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
        cur.execute("""
            SELECT
                c.customer_name,
                COUNT(DISTINCT ot.order_id)                AS total_orders,
                COALESCE(SUM(DISTINCT ot.total_amount), 0) AS total_revenue,
                MAX(ot.order_date)                         AS last_purchase_date,
                COALESCE(SUM(DISTINCT ot.total_amount) FILTER (
                    WHERE ot.order_date >= DATE_TRUNC('month', CURRENT_DATE)
                ), 0) AS this_month,
                COALESCE(SUM(DISTINCT ot.total_amount) FILTER (
                    WHERE ot.order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                      AND ot.order_date <  DATE_TRUNC('month', CURRENT_DATE)
                ), 0) AS last_month,
                (
                    SELECT STRING_AGG(DISTINCT pm2.status_name, ', ')
                    FROM order_transaction ot3
                    JOIN static_status pm2 ON pm2.status_id = ot3.payment_method_id
                    WHERE ot3.customer_id = c.customer_id
                ) AS preferred_payment
            FROM order_transaction  ot
            JOIN customer           c  ON c.customer_id  = ot.customer_id
            WHERE 1=1
            GROUP BY c.customer_id, c.customer_name
            ORDER BY total_revenue DESC
        """)
        rows = cur.fetchall()

        result = []
        for r in rows:
            last_date  = r[3]
            this_month = float(r[4] or 0)
            last_month = float(r[5] or 0)
            if last_month == 0 and this_month == 0:
                ltv_trend = 'new'
            elif last_month == 0:
                ltv_trend = 'up'
            elif this_month > last_month:
                ltv_trend = 'up'
            elif this_month < last_month:
                ltv_trend = 'down'
            else:
                ltv_trend = 'flat'

            days_inactive = (date.today() - last_date).days if last_date else None
            if days_inactive is None:
                activity_status = 'Unknown'
            elif days_inactive <= 7:
                activity_status = 'Active'
            elif days_inactive <= 30:
                activity_status = 'Inactive'
            elif days_inactive <= 90:
                activity_status = 'At Risk'
            else:
                activity_status = 'Dormant'

            result.append({
                "customer_name":      r[0] or "Unknown",
                "total_orders":       int(r[1] or 0),
                "total_revenue":      float(r[2] or 0),
                "last_purchase_date": last_date.isoformat() if last_date else None,
                "days_inactive":      days_inactive,
                "activity_status":    activity_status,
                "ltv_trend":          ltv_trend,
                "this_month":         this_month,
                "last_month":         last_month,
                "preferred_payment":  r[6] or "—",
            })
        return jsonify(result), 200
    except Exception as e:
        print("[reports/customer-sales] error:", e)
        return err(e)
    finally:
        cur.close(); conn.close()