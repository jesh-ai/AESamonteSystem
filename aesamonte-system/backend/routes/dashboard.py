# Required pip installs:
#   pip install pandas numpy darts prophet
#   (darts will also pull in statsmodels; prophet is optional but recommended)

from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta
from collections import defaultdict
import calendar
import time
import warnings
import pandas as pd
import numpy as np

warnings.filterwarnings("ignore")

# ── Optional darts / Prophet imports ─────────────────────────────────────────
_DARTS_OK = False
_PROPHET_OK = False

try:
    from darts import TimeSeries as _DartsTS
    from darts.models import ExponentialSmoothing as _DartsETS
    _DARTS_OK = True
except ImportError:
    pass

if _DARTS_OK:
    try:
        from darts.models import Prophet as _DartsProphet
        _PROPHET_OK = True
    except ImportError:
        pass

# ─────────────────────────────────────────────────────────────────────────────

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


# ── Time-Series Forecasting Helpers ──────────────────────────────────────────

def _resample_daily(daily_df: pd.DataFrame, freq: str) -> pd.Series:
    """
    Aggregate a daily DataFrame (columns: 'date', 'sales') to target frequency.
    Handles both modern pandas (ME/QE) and legacy (M/Q) aliases automatically.
    """
    df = daily_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    try:
        return df["sales"].resample(freq).sum().fillna(0.0)
    except (ValueError, TypeError):
        # Fallback for older pandas versions
        legacy = {"ME": "M", "QE": "Q", "YE": "Y"}
        return df["sales"].resample(legacy.get(freq, freq)).sum().fillna(0.0)


def _variance_aware_forecast(series: pd.Series, n: int,
                              seasonal_period: int = 4) -> list:
    """
    Dynamic fallback that preserves historical seasonal shape instead of
    returning a flat line.

    Algorithm
    ---------
    1. Baseline  = rolling mean of the last min(4, len) periods.
    2. Seasonal ratios = for every position 0…seasonal_period-1, average all
       historical values at that position divided by the overall series mean.
       This captures "Q1 is usually 80% of average, Q3 is 120%", etc.
    3. Apply the ratios cyclically starting from where the series ends.
    4. If there are fewer than 2 data points, fall back to a gentle sinusoidal
       ±12% variation so the UI never shows a dead-flat line.
    """
    if len(series) == 0:
        return [0.0] * n

    baseline = float(series.iloc[-min(4, len(series)):].mean())
    if baseline == 0:
        return [0.0] * n

    if len(series) >= 2:
        overall_mean = float(series.mean())
        if overall_mean > 0:
            # Build per-position ratio buckets
            ratio_buckets: dict = defaultdict(list)
            for i, val in enumerate(series):
                ratio_buckets[i % seasonal_period].append(float(val) / overall_mean)
            avg_ratios = {pos: float(np.mean(vals)) for pos, vals in ratio_buckets.items()}

            # Forecast starting from where the series left off in the cycle
            start_pos = len(series) % seasonal_period
            return [
                max(0.0, baseline * avg_ratios.get((start_pos + i) % seasonal_period, 1.0))
                for i in range(n)
            ]

    # Absolute minimum: sinusoidal ±12% around baseline
    return [
        max(0.0, baseline * (1.0 + 0.12 * np.sin(2 * np.pi * i / max(n, seasonal_period))))
        for i in range(n)
    ]


# Maps pandas resample alias → natural seasonal period
_SEASONAL_PERIOD = {
    "W": 52, "W-SUN": 52, "W-MON": 52,
    "ME": 12, "M": 12,
    "QE": 4,  "Q": 4,
}


def _ts_forecast(daily_df: pd.DataFrame, freq: str, n_periods: int,
                 min_obs: int = 8) -> list:
    """
    Forecast n_periods steps ahead at the given pandas frequency.

    Strategy (in order of preference):
      1. Prophet via darts   — seasonality flags tuned per frequency
      2. ExponentialSmoothing via darts — additive trend enabled; flatline
         detection reroutes to the variance-aware fallback if ETS stalls
      3. Variance-aware seasonal-ratio fallback — never returns a flat line

    Parameters
    ----------
    daily_df  : DataFrame with columns ['date', 'sales']
    freq      : pandas resample alias, e.g. 'W', 'ME', 'QE'
    n_periods : how many future periods to forecast
    min_obs   : minimum resampled observations required to attempt darts models
    """
    if daily_df is None or daily_df.empty:
        return [0.0] * n_periods

    series = _resample_daily(daily_df, freq)
    seasonal_p = _SEASONAL_PERIOD.get(freq, 4)

    # ── Cold-start: not enough history → variance-aware fallback ─────────
    if len(series) < min_obs or series.sum() == 0:
        return _variance_aware_forecast(series, n_periods, seasonal_p)

    # ── No darts available → variance-aware fallback ──────────────────────
    if not _DARTS_OK:
        return _variance_aware_forecast(series, n_periods, seasonal_p)

    try:
        ts = _DartsTS.from_series(series)
        is_weekly = freq.startswith("W")

        # ── 1. Prophet (best for trend + seasonality) ─────────────────────
        if _PROPHET_OK and len(series) >= max(min_obs * 2, n_periods * 2):
            try:
                model = _DartsProphet(
                    yearly_seasonality=not is_weekly,   # monthly/quarterly
                    weekly_seasonality=is_weekly,       # weekly
                    daily_seasonality=False,
                )
                model.fit(ts)
                pred = model.predict(n_periods)
                vals = [max(0.0, float(v)) for v in pred.values().flatten()]
                # Reject Prophet if it flatlined too
                if len({round(v, 2) for v in vals}) > 1:
                    return vals
            except Exception as e:
                print(f"[Forecast] Prophet failed ({e}), trying ETS...")

        # ── 2. ExponentialSmoothing with additive trend ───────────────────
        try:
            model = _DartsETS(trend="add")
            model.fit(ts)
            pred = model.predict(n_periods)
            vals = [max(0.0, float(v)) for v in pred.values().flatten()]
            # If ETS produced a flat line, don't return it
            if len({round(v, 2) for v in vals}) > 1:
                return vals
        except Exception as e:
            print(f"[Forecast] ETS failed ({e}), using variance-aware fallback...")

        # ── 3. Variance-aware seasonal-ratio fallback ─────────────────────
        return _variance_aware_forecast(series, n_periods, seasonal_p)

    except Exception:
        return _variance_aware_forecast(series, n_periods, seasonal_p)


# ── 1. TOP METRICS ───────────────────────────────────────────────────────────
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

        # Low Stock count — reorder_qty lives in inventory_action (keyed by inventory_brand_id)
        cur.execute("""
            SELECT COUNT(*)
            FROM inventory i
            LEFT JOIN LATERAL (
                SELECT ia2.reorder_qty FROM inventory_brand ib2
                JOIN inventory_action ia2 ON ia2.inventory_brand_id = ib2.inventory_brand_id
                WHERE ib2.inventory_id = i.inventory_id LIMIT 1
            ) ia ON true
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ss.status_code != 'INACTIVE'
              AND COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0) <= COALESCE(ia.reorder_qty, 10)
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

        # ── Monthly actuals for current year (historical, not forecast) ────
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
        # ── Pull ALL historical daily sales for TS model training ──────────
        # No date filter — more history = better forecasts.
        cur.execute("""
            SELECT st.sales_date, COALESCE(SUM(ot.total_amount), 0) AS sales
            FROM sales_transaction st
            JOIN order_transaction ot ON st.order_id = ot.order_id
            JOIN static_status ss ON st.payment_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
            GROUP BY st.sales_date
            ORDER BY st.sales_date
        """)
        hist_rows = cur.fetchall()
        daily_df = pd.DataFrame(hist_rows, columns=["date", "sales"])
        daily_df["sales"] = daily_df["sales"].astype(float)

        # Cold-start flag: < 60 days of data (≈ 2 months)
        data_sufficient = len(daily_df) >= 60
        if not data_sufficient:
            print(f"[Forecast] Cold-start: only {len(daily_df)} days of sales history — using SMA.")

        # ── Build monthlySales: actuals + ML forecast stitched together ────
        # Actuals  : months 1 … current_month (current month may be partial).
        # Forecast : months (current_month+1) … 12 via ML or sparse fallback.
        month_labels = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
        current_month = today.month
        n_forecast = 12 - current_month  # months remaining after current month

        if n_forecast > 0:
            # Ask the ML model for the remaining months.
            # The resampled series ends at the current (possibly partial) month,
            # so predict() will return values for month+1 … month+n_forecast.
            forecast_vals = _ts_forecast(daily_df, "ME", n_forecast, min_obs=2)

            # Sparse-data fallback: if ML returned all zeros, project the
            # average of known actual months forward with ±5 % random variance.
            known_actuals = [month_map[m] for m in range(1, current_month + 1)
                             if month_map.get(m, 0) > 0]
            if all(v == 0.0 for v in forecast_vals) and known_actuals:
                avg = sum(known_actuals) / len(known_actuals)
                rng = np.random.default_rng(int(today.strftime("%Y%m%d")))
                forecast_vals = [
                    round(max(0.0, avg * (1.0 + rng.uniform(-0.05, 0.05))), 2)
                    for _ in range(n_forecast)
                ]
        else:
            forecast_vals = []

        monthly_sales = []
        for i in range(12):
            month_num = i + 1
            if month_num <= current_month:
                sales_val = month_map.get(month_num, 0)
            else:
                sales_val = forecast_vals[month_num - current_month - 1]
            monthly_sales.append({"month": month_labels[i], "sales": round(float(sales_val), 2)})

        # ── Weekly forecast — next 4 weeks ────────────────────────────────
        # min_obs=8 → need at least 8 weeks of history; else SMA fallback.
        weekly_preds = _ts_forecast(daily_df, "W", 4, min_obs=8)
        start_of_this_week = today - timedelta(days=today.weekday())
        weekly_sales = []
        for w in range(4):
            week_start = start_of_this_week + timedelta(weeks=w)
            week_end   = week_start + timedelta(days=6)
            weekly_sales.append({
                "label": f"Week {w + 1}",
                "dateRange": f"{week_start.strftime('%b %d')} - {week_end.strftime('%b %d')}",
                "total": round(weekly_preds[w], 2),
            })

        # ── Quarterly forecast — next 4 quarters ──────────────────────────
        # min_obs=2 → need at least 2 quarters of history; else SMA fallback.
        quarterly_preds = _ts_forecast(daily_df, "QE", 4, min_obs=2)
        all_quarters = [
            (1, 1,  3,  "Jan - Mar"),
            (2, 4,  6,  "Apr - Jun"),
            (3, 7,  9,  "Jul - Sep"),
            (4, 10, 12, "Oct - Dec"),
        ]
        current_quarter = (today.month - 1) // 3  # 0-indexed (0=Q1…3=Q4)
        quarterly_sales = []
        for i in range(4):
            q_num, m_start, m_end, date_range = all_quarters[(current_quarter + i) % 4]
            quarterly_sales.append({
                "label": f"Q{q_num}",
                "dateRange": date_range,
                "total": round(quarterly_preds[i], 2),
            })

        # ── 12-month forecast — starting from current month ────────────────
        # min_obs=3 → need at least 3 months of history; else SMA fallback.
        monthly_preds = _ts_forecast(daily_df, "ME", 12, min_obs=3)
        month_names = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"]
        last_twelve_months = []
        for i in range(12):
            m = today.month + i
            y = today.year
            while m > 12:
                m -= 12
                y += 1
            last_twelve_months.append({
                "label": month_names[m - 1],
                "year":  str(y),
                "dateRange": f"{month_names[m - 1]} {y}",
                "total": round(monthly_preds[i], 2),
            })

        # ── Yearly historical sales (last 3 years) ─────────────────────────
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
        for row in year_rows:
            yr, total = int(row[0]), float(row[1])
            yearly_sales.append({"year": yr, "total": total, "change": None})
        for i in range(len(yearly_sales) - 1):
            curr = yearly_sales[i]["total"]
            prev = yearly_sales[i + 1]["total"]
            if prev > 0:
                yearly_sales[i]["change"] = round(((curr - prev) / prev) * 100, 1)
            else:
                yearly_sales[i]["change"] = 100.0 if curr > 0 else 0.0

        # ── Goal % — current year vs previous year ─────────────────────────
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

        # forecastTotal = actuals-to-date + ML forecast for the rest of the year
        forecast_total = round(sum(m["sales"] for m in monthly_sales), 2)

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


# ── 4. INSIGHTS ───────────────────────────────────────────────────────────────
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
        ninety_days_ago  = today - timedelta(days=90)

        # Shared CTE: units sold per inventory item in last 30 days
        sales_cte = """
            WITH sales_30d AS (
                SELECT ib.inventory_id, COALESCE(SUM(od.order_quantity), 0) AS units_sold
                FROM order_details od
                JOIN inventory_batch bat ON bat.batch_id = od.batch_id
                JOIN inventory_brand ib  ON ib.inventory_brand_id = bat.inventory_brand_id
                JOIN sales_transaction st ON st.order_id = od.order_id
                JOIN static_status ss ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID' AND st.sales_date >= %s
                GROUP BY ib.inventory_id
            )
        """

        # --- Smart Reorder: low-stock items ---
        cur.execute(sales_cte + """
            SELECT i.inventory_id, i.item_name,
                   COALESCE((SELECT ib2.item_sku FROM inventory_brand ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS sku,
                   COALESCE((SELECT b2.brand_name FROM inventory_brand ib2 JOIN brand b2 ON ib2.brand_id = b2.brand_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS brand,
                   COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0) AS item_quantity,
                   COALESCE(ia.reorder_qty, 10) AS reorder_qty,
                   COALESCE(s.units_sold, 0) AS units_sold_30d,
                   COALESCE((SELECT u2.uom_name FROM inventory_brand ib2 JOIN unit_of_measure u2 ON ib2.uom_id = u2.uom_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS uom,
                   COALESCE((SELECT ib2.item_description FROM inventory_brand ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS item_description
            FROM inventory i
            LEFT JOIN LATERAL (
                SELECT ia2.reorder_qty FROM inventory_brand ib2
                JOIN inventory_action ia2 ON ia2.inventory_brand_id = ib2.inventory_brand_id
                WHERE ib2.inventory_id = i.inventory_id LIMIT 1
            ) ia ON true
            LEFT JOIN sales_30d s ON s.inventory_id = i.inventory_id
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ss.status_code != 'INACTIVE'
              AND COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0) <= COALESCE(ia.reorder_qty, 10)
            ORDER BY item_quantity ASC
            LIMIT 5
        """, (thirty_days_ago,))
        reorder_rows = cur.fetchall()

        # --- Stockout Predictions: items with stock that will run out ---
        cur.execute(sales_cte + """
            SELECT i.inventory_id, i.item_name,
                   COALESCE((SELECT ib2.item_sku FROM inventory_brand ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS sku,
                   COALESCE((SELECT b2.brand_name FROM inventory_brand ib2 JOIN brand b2 ON ib2.brand_id = b2.brand_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS brand,
                   COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0) AS item_quantity,
                   COALESCE(s.units_sold, 0) AS units_sold_30d,
                   COALESCE(ia.reorder_qty, 10) AS reorder_qty,
                   COALESCE((SELECT u2.uom_name FROM inventory_brand ib2 JOIN unit_of_measure u2 ON ib2.uom_id = u2.uom_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS uom,
                   COALESCE((SELECT ib2.item_description FROM inventory_brand ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS item_description
            FROM inventory i
            LEFT JOIN LATERAL (
                SELECT ia2.reorder_qty FROM inventory_brand ib2
                JOIN inventory_action ia2 ON ia2.inventory_brand_id = ib2.inventory_brand_id
                WHERE ib2.inventory_id = i.inventory_id LIMIT 1
            ) ia ON true
            LEFT JOIN sales_30d s ON s.inventory_id = i.inventory_id
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ss.status_code != 'INACTIVE'
              AND COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0) > 0
              AND COALESCE(s.units_sold, 0) > 0
            ORDER BY (COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0)::float / (COALESCE(s.units_sold, 1)::float / 30)) ASC
            LIMIT 5
        """, (thirty_days_ago,))
        stockout_rows = cur.fetchall()

        # ── Fetch 90-day per-item daily history for TS forecasting ─────────
        # Pulling all relevant items in one query to avoid N+1 overhead.
        all_inv_ids = list({r[0] for r in reorder_rows} | {r[0] for r in stockout_rows})
        item_daily_map: dict = {}  # inv_id → pd.DataFrame

        if all_inv_ids:
            placeholders = ",".join(["%s"] * len(all_inv_ids))
            cur.execute(f"""
                SELECT ib.inventory_id, st.sales_date,
                       COALESCE(SUM(od.order_quantity), 0) AS units
                FROM order_details od
                JOIN inventory_batch bat ON bat.batch_id = od.batch_id
                JOIN inventory_brand ib  ON ib.inventory_brand_id = bat.inventory_brand_id
                JOIN sales_transaction st ON st.order_id = od.order_id
                JOIN static_status ss ON st.payment_status_id = ss.status_id
                WHERE ss.status_code = 'PAID'
                  AND st.sales_date >= %s
                  AND ib.inventory_id IN ({placeholders})
                GROUP BY ib.inventory_id, st.sales_date
                ORDER BY ib.inventory_id, st.sales_date
            """, (ninety_days_ago, *all_inv_ids))

            raw: dict = defaultdict(list)
            for inv_id, s_date, units in cur.fetchall():
                raw[inv_id].append({"date": s_date, "sales": float(units)})

            for inv_id, rows in raw.items():
                df = pd.DataFrame(rows)
                df["sales"] = df["sales"].astype(float)
                item_daily_map[inv_id] = df

        def _item_forecast_30d(inv_id: int, fallback_units_30d: float):
            """
            Returns (forecast_demand_30d, daily_rate) using TS model.

            Strategy:
              - If ≥ 4 weeks of weekly data → weekly ETS/Prophet forecast
                (5 weeks predicted, scaled to 30 days)
              - Cold-start (< 4 weeks) → SMA of available weekly data
              - No item data at all → naive average (fallback_units_30d / 30 * 30)
            """
            df = item_daily_map.get(inv_id)

            if df is None or df.empty:
                # Cold-start: no history at all — use naive 30-day average
                daily_rate = fallback_units_30d / 30 if fallback_units_30d else 0.0
                return round(fallback_units_30d), daily_rate

            # Forecast 5 weeks (35 days) via weekly TS, then scale to 30 days.
            # Weekly aggregation is faster and less noisy than daily per-item.
            weekly_preds = _ts_forecast(df, "W", 5, min_obs=4)
            forecast_35d = sum(weekly_preds)
            forecast_30d = max(0.0, forecast_35d * 30 / 35)
            daily_rate = forecast_30d / 30
            return round(forecast_30d), daily_rate

        # ── Smart Reorder suggestions ──────────────────────────────────────
        reorder_suggestions = []
        for row in reorder_rows:
            inv_id, name, sku, brand, qty, reorder_qty, units_sold_30d, uom, description = row
            forecast_demand, daily_rate = _item_forecast_30d(inv_id, float(units_sold_30d))
            safety_stock   = round(daily_rate * 7) if daily_rate > 0 else round(int(reorder_qty) * 0.2)
            recommended    = max(forecast_demand + safety_stock - int(qty), int(reorder_qty))
            reorder_suggestions.append({
                "inventory_id":   inv_id,
                "item_name":      name,
                "sku":            sku or f"SKU{inv_id:06d}",
                "brand":          brand or "",
                "description":    description or "",
                "uom":            uom,
                "current_qty":    int(qty),
                "forecast_demand": forecast_demand,
                "safety_stock":   safety_stock,
                "recommended_qty": recommended,
                "note":           "Restock to meet forecasted demand",
            })

        # ── Stockout predictions ───────────────────────────────────────────
        stockout_predictions = []
        for row in stockout_rows:
            inv_id, name, sku, brand, qty, units_sold_30d, reorder_qty, uom, description = row
            _, daily_rate = _item_forecast_30d(inv_id, float(units_sold_30d))
            # Guard: if TS returned 0, fall back to naive rate so we still get a date
            if daily_rate <= 0:
                daily_rate = float(units_sold_30d) / 30 if units_sold_30d else 0.0
            days_remaining = int(float(qty) / daily_rate) if daily_rate > 0 else 9999
            stockout_dt    = today + timedelta(days=days_remaining)
            is_low         = int(qty) <= int(reorder_qty)
            stockout_predictions.append({
                "inventory_id":  inv_id,
                "item_name":     name,
                "sku":           sku or f"SKU{inv_id:06d}",
                "brand":         brand or "",
                "description":   description or "",
                "uom":           uom,
                "current_qty":   int(qty),
                "daily_rate":    round(daily_rate, 1),
                "days_remaining": days_remaining,
                "stockout_date": stockout_dt.strftime("%B %d, %Y"),
                "is_low_stock":  is_low,
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
                COALESCE((SELECT ib2.item_sku FROM inventory_brand ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS sku,
                COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0) AS current_qty,
                COALESCE((SELECT u2.uom_name FROM inventory_brand ib2 JOIN unit_of_measure u2 ON ib2.uom_id = u2.uom_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS uom,
                COALESCE(ia.reorder_qty, 10) AS reorder_qty,
                COALESCE((SELECT b2.brand_name FROM inventory_brand ib2 JOIN brand b2 ON ib2.brand_id = b2.brand_id WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS brand,
                COALESCE((SELECT ib2.item_description FROM inventory_brand ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), '') AS description,
                COALESCE((SELECT AVG(bat2.unit_cost) FROM inventory_batch bat2 JOIN inventory_brand ib2 ON ib2.inventory_brand_id = bat2.inventory_brand_id WHERE ib2.inventory_id = i.inventory_id AND bat2.expiry_date > CURRENT_DATE), 0) AS unit_price,
                COALESCE((SELECT ib2.item_selling_price FROM inventory_brand ib2 WHERE ib2.inventory_id = i.inventory_id LIMIT 1), 0) AS selling_price,
                ss.status_code AS status,
                COALESCE(s.supplier_name, '') AS supplier_name
            FROM inventory i
            LEFT JOIN LATERAL (
                SELECT ia2.reorder_qty FROM inventory_brand ib2
                JOIN inventory_action ia2 ON ia2.inventory_brand_id = ib2.inventory_brand_id
                WHERE ib2.inventory_id = i.inventory_id LIMIT 1
            ) ia ON true
            LEFT JOIN static_status ss ON i.item_status_id = ss.status_id
            LEFT JOIN LATERAL (
                SELECT ibs.supplier_id FROM inventory_brand ib
                JOIN inventory_brand_supplier ibs ON ib.inventory_brand_id = ibs.inventory_brand_id
                WHERE ib.inventory_id = i.inventory_id LIMIT 1
            ) latest_sup ON true
            LEFT JOIN supplier s ON s.supplier_id = latest_sup.supplier_id
            WHERE ss.status_code != 'INACTIVE'
            AND COALESCE((SELECT SUM(bat3.quantity_on_hand) FROM inventory_batch bat3 JOIN inventory_brand ib3 ON ib3.inventory_brand_id = bat3.inventory_brand_id WHERE ib3.inventory_id = i.inventory_id AND bat3.expiry_date > CURRENT_DATE), 0) <= COALESCE(ia.reorder_qty, 10)
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
        try:
            cur.close()
        except Exception:
            pass
        conn.close()

# ── 5. ALL-IN-ONE DASHBOARD ──────────────────────────────────────────────────
@dashboard_bp.route("/api/dashboard/all", methods=["GET"])
def get_dashboard_all():
    try:
        metrics_data    = _get("metrics")
        orders_data     = _get("recent_orders")
        charts_data     = _get("charts")
        insights_data   = _get("insights")
        low_stock_data  = _get("low_stock_items")

        if metrics_data is None:
            metrics_data = get_dashboard_metrics()[0].get_json()
        if orders_data is None:
            orders_data = get_recent_orders()[0].get_json()
        if charts_data is None:
            charts_data = get_dashboard_charts()[0].get_json()
        if insights_data is None:
            insights_data = get_dashboard_insights()[0].get_json()
        if low_stock_data is None:
            low_stock_data = get_low_stock_items_data()

        return jsonify({
            "metrics":       metrics_data,
            "recentOrders":  orders_data,
            "charts":        charts_data,
            "insights":      insights_data,
            "lowStockItems": low_stock_data,
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


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


# ── 7. ORDER RECEIPT ─────────────────────────────────────────────────────────
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
            WHERE ot.order_id = %s::int
        """, (order_id,))
        order_row = cur.fetchone()
        if not order_row:
            return jsonify({"error": "Order not found"}), 404
        oid, customer_name, customer_address, order_date, total_amount, status, payment_method = order_row
        cur.execute("""
            SELECT i.item_name, od.order_quantity, od.order_total,
                   COALESCE(u.uom_name, '') AS uom,
                   CASE WHEN od.order_quantity > 0 THEN od.order_total / od.order_quantity ELSE 0 END AS unit_price
            FROM order_details od
            JOIN inventory_batch bat ON bat.batch_id = od.batch_id
            JOIN inventory_brand ib  ON ib.inventory_brand_id = bat.inventory_brand_id
            JOIN inventory i ON i.inventory_id = ib.inventory_id
            LEFT JOIN unit_of_measure u ON u.uom_id = ib.uom_id
            WHERE od.order_id = %s::int
        """, (order_id,))
        items = [
            {
                "item_name": r[0] or "",
                "quantity": int(r[1] or 0),
                "unit_price": float(r[4] or 0),
                "total": float(r[2] or 0),
                "uom": r[3] or "",
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
        import traceback
        print("order-receipt error:", str(e), flush=True)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── 8. SALES REVENUE (historical, monthly actuals) ───────────────────────────
@dashboard_bp.route("/api/dashboard/sales-revenue", methods=["GET"])
def get_sales_revenue():
    # Default to the last complete calendar year so the chart always has 12 data points.
    # Pass ?year=2026 to override.
    year = request.args.get("year", type=int, default=date.today().year - 1)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                EXTRACT(MONTH FROM st.sales_date)::int AS month,
                COALESCE(SUM(ot.total_amount), 0)      AS total
            FROM sales_transaction st
            JOIN order_transaction ot ON ot.order_id = st.order_id
            JOIN static_status     ss ON ss.status_id = st.payment_status_id
            WHERE ss.status_code = 'PAID'
              AND EXTRACT(YEAR FROM st.sales_date) = %s
            GROUP BY month
            ORDER BY month
        """, (year,))

        month_map = {int(r[0]): float(r[1]) for r in cur.fetchall()}
        labels = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
        monthly_sales = [
            {"month": labels[i], "sales": round(month_map.get(i + 1, 0.0), 2)}
            for i in range(12)
        ]
        total = round(sum(m["sales"] for m in monthly_sales), 2)

        # Year-over-year change vs the year before the requested year
        cur.execute("""
            SELECT COALESCE(SUM(ot.total_amount), 0)
            FROM sales_transaction st
            JOIN order_transaction ot ON ot.order_id = st.order_id
            JOIN static_status     ss ON ss.status_id = st.payment_status_id
            WHERE ss.status_code = 'PAID'
              AND EXTRACT(YEAR FROM st.sales_date) = %s
        """, (year - 1,))
        prev_total = float(cur.fetchone()[0] or 0)

        if prev_total > 0:
            change = round(((total - prev_total) / prev_total) * 100, 1)
        else:
            change = 100.0 if total > 0 else 0.0

        return jsonify({
            "year": year,
            "monthlySales": monthly_sales,
            "total": total,
            "change": change,
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── 9. INVENTORY FORECAST (low-stock + velocity-based stockout) ───────────────
@dashboard_bp.route("/api/dashboard/inventory-forecast", methods=["GET"])
def get_inventory_forecast():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            WITH sales_30d AS (
                SELECT
                    ib.inventory_brand_id,
                    COALESCE(SUM(od.order_quantity), 0)::float AS units_sold
                FROM order_details od
                JOIN inventory_batch   bat ON bat.batch_id           = od.batch_id
                JOIN inventory_brand   ib  ON ib.inventory_brand_id  = bat.inventory_brand_id
                JOIN sales_transaction st  ON st.order_id            = od.order_id
                JOIN static_status     ss  ON ss.status_id           = st.payment_status_id
                WHERE ss.status_code = 'PAID'
                  AND st.sales_date >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY ib.inventory_brand_id
            ),
            item_stats AS (
                SELECT
                    i.inventory_id,
                    i.item_name,
                    COALESCE(MIN(u.uom_name), 'pcs')              AS uom,
                    COALESCE(MIN(ib.item_sku), '')                AS sku,
                    COALESCE(MIN(b.brand_name), '')               AS brand,
                    COALESCE(SUM(bat.quantity_on_hand), 0)::float AS current_stock,
                    COALESCE(SUM(s.units_sold), 0)::float         AS units_sold_30d,
                    COALESCE(MIN(ia.low_stock_qty), 10)::float    AS low_stock_qty
                FROM inventory i
                JOIN inventory_brand    ib  ON ib.inventory_id       = i.inventory_id
                LEFT JOIN inventory_action  ia  ON ia.inventory_brand_id = ib.inventory_brand_id
                LEFT JOIN brand             b   ON b.brand_id         = ib.brand_id
                LEFT JOIN sales_30d         s   ON s.inventory_brand_id = ib.inventory_brand_id
                LEFT JOIN unit_of_measure   u   ON u.uom_id           = ib.uom_id
                LEFT JOIN inventory_batch   bat ON bat.inventory_brand_id = ib.inventory_brand_id
                                               AND bat.expiry_date > CURRENT_DATE
                JOIN static_status          ss  ON ss.status_id       = i.item_status_id
                WHERE ss.status_code != 'INACTIVE'
                GROUP BY i.inventory_id, i.item_name
                HAVING
                    -- Out of stock
                    COALESCE(SUM(bat.quantity_on_hand), 0) = 0
                    OR
                    -- At or below the low_stock_qty threshold
                    COALESCE(SUM(bat.quantity_on_hand), 0) <= COALESCE(MIN(ia.low_stock_qty), 10)
                    OR
                    -- Velocity-predicted stockout within 30 days
                    (
                        COALESCE(SUM(s.units_sold), 0) > 0
                        AND COALESCE(SUM(bat.quantity_on_hand), 0) > 0
                        AND (COALESCE(SUM(bat.quantity_on_hand), 0)
                             / (COALESCE(SUM(s.units_sold), 0) / 30.0)) <= 30
                    )
            )
            SELECT
                item_name,
                uom,
                sku,
                brand,
                current_stock::int                                              AS current_stock,
                CASE WHEN units_sold_30d > 0
                     THEN ROUND((units_sold_30d / 30.0)::numeric, 1)::float
                     ELSE 0.0 END                                               AS daily_rate,
                CASE
                    WHEN current_stock = 0      THEN 0
                    WHEN units_sold_30d > 0     THEN (current_stock / (units_sold_30d / 30.0))::int
                    ELSE 9999 END                                               AS days_until_stockout,
                GREATEST(0, CEIL(
                    CASE WHEN units_sold_30d > 0
                         THEN (units_sold_30d / 30.0) * 30 - current_stock
                         ELSE low_stock_qty - current_stock END
                ))::int                                                         AS suggested_reorder_qty
            FROM item_stats
            ORDER BY
                CASE WHEN current_stock = 0 THEN 0 ELSE 1 END ASC,
                CASE WHEN units_sold_30d > 0 AND current_stock > 0
                     THEN current_stock / (units_sold_30d / 30.0)
                     ELSE 9999.0 END ASC
            LIMIT 10
        """)

        rows = cur.fetchall()
        items = []
        for r in rows:
            days = int(r[6])
            # 9999 means no velocity data — show "No sales data" instead of a far-future date
            if days >= 9999:
                stockout_date = "No sales data"
            elif days == 0:
                stockout_date = "Out of stock"
            else:
                stockout_date = (date.today() + timedelta(days=days)).strftime("%B %d, %Y")
            items.append({
                "item_name":             r[0],
                "uom":                   r[1] or "pcs",
                "sku":                   r[2] or "",
                "brand":                 r[3] or "",
                "current_stock":         int(r[4]),
                "daily_rate":            float(r[5]),
                "days_until_stockout":   days,
                "suggested_reorder_qty": int(r[7]),
                "stockout_date":         stockout_date,
            })
        return jsonify(items), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
