import os
import csv
import json
import zipfile
import io
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, send_file
from database.db_config import get_connection

backup_bp = Blueprint("backup", __name__, url_prefix="/api/backup")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
STORAGE_BUCKET = "backups"

DAY_MAP = {
    'monday': 0, 'tuesday': 1, 'wednesday': 2,
    'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6
}


# ---------------------------------------------------------------------------
# Supabase Storage helper
# ---------------------------------------------------------------------------

def _supabase():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Settings — stored in the backup_settings DB table (single row, id=1)
# Run migrations/002_backup_settings_table.sql once to create the table.
# ---------------------------------------------------------------------------

def load_settings():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT settings FROM backup_settings WHERE id = 1")
        row = cur.fetchone()
        if row:
            return row[0]
        return {
            "daily":  {"enabled": False, "hour": 12, "minute": 0, "ampm": "PM"},
            "weekly": {"enabled": False, "hour": 12, "minute": 0, "ampm": "PM", "day": "monday"},
        }
    finally:
        cur.close()
        conn.close()


def _save_settings(settings):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO backup_settings (id, settings)
            VALUES (1, %s)
            ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings
            """,
            (json.dumps(settings),),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# CSV / ZIP helpers
# ---------------------------------------------------------------------------

def write_csv_buffer(cur, headers):
    rows = cur.fetchall()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([str(v) if v is not None else '' for v in row])
    return buf.getvalue()


def _build_zip_bytes():
    """Generate a ZIP of all module CSVs entirely in memory. Returns (BytesIO, date_str)."""
    date_str = datetime.now().strftime("%m-%d-%y")
    conn = get_connection()
    cur = conn.cursor()
    zip_buffer = io.BytesIO()
    try:
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            cur.execute("""
                SELECT i.inventory_id, i.item_name, i.item_description, i.item_sku, i.brand,
                       i.item_quantity, u.uom_code, s.status_name, i.item_unit_price, i.item_selling_price
                FROM inventory i
                LEFT JOIN unit_of_measure u ON i.unit_of_measure = u.uom_id
                JOIN static_status s ON i.item_status_id = s.status_id
                ORDER BY i.inventory_id
            """)
            zf.writestr(f"Inventory_{date_str}.csv", write_csv_buffer(cur, [
                'inventory_id', 'item_name', 'item_description', 'item_sku', 'brand',
                'item_quantity', 'uom', 'status', 'item_unit_price', 'item_selling_price',
            ]))

            cur.execute("""
                SELECT s.supplier_id, s.supplier_name, s.contact_person, s.supplier_contact,
                       s.supplier_email, s.supplier_address, st.status_name
                FROM supplier s
                LEFT JOIN static_status st ON s.supplier_status_id = st.status_id
                ORDER BY s.supplier_id
            """)
            zf.writestr(f"Supplier_{date_str}.csv", write_csv_buffer(cur, [
                'supplier_id', 'supplier_name', 'contact_person', 'supplier_contact',
                'supplier_email', 'supplier_address', 'status',
            ]))

            cur.execute("""
                SELECT ot.order_id, c.customer_name, c.customer_address, ot.order_date,
                       sl.status_name, i.item_name, od.order_quantity, ot.total_amount
                FROM order_transaction ot
                JOIN customer c ON ot.customer_id = c.customer_id
                JOIN static_status sl ON ot.order_status_id = sl.status_id
                LEFT JOIN order_details od ON ot.order_id = od.order_id
                LEFT JOIN inventory i ON od.inventory_id = i.inventory_id
                ORDER BY ot.order_id
            """)
            zf.writestr(f"Orders_{date_str}.csv", write_csv_buffer(cur, [
                'order_id', 'customer_name', 'customer_address', 'order_date',
                'status', 'item_name', 'quantity', 'total_amount',
            ]))

            cur.execute("""
                SELECT st.sales_id, c.customer_name, st.sales_date, ot.total_amount,
                       ss.status_name, pm.status_name
                FROM sales_transaction st
                JOIN order_transaction ot ON st.order_id = ot.order_id
                JOIN customer c ON ot.customer_id = c.customer_id
                JOIN static_status ss ON st.sales_status_id = ss.status_id
                LEFT JOIN static_status pm ON st.payment_method_id = pm.status_id
                ORDER BY st.sales_date DESC
            """)
            zf.writestr(f"Sales_{date_str}.csv", write_csv_buffer(cur, [
                'sales_id', 'customer_name', 'sales_date', 'total_amount', 'status', 'payment_method',
            ]))
    finally:
        cur.close()
        conn.close()

    zip_buffer.seek(0)
    return zip_buffer, date_str


# ---------------------------------------------------------------------------
# Scheduled backup — uploads ZIP to Supabase Storage
# ---------------------------------------------------------------------------

def run_backup():
    """Build a backup ZIP and upload it to Supabase Storage."""
    zip_buffer, date_str = _build_zip_bytes()
    filename = f"Backup_{date_str}.zip"
    _supabase().storage.from_(STORAGE_BUCKET).upload(
        path=filename,
        file=zip_buffer.read(),
        file_options={"content-type": "application/zip", "upsert": "true"},
    )
    print(f"[Backup] Uploaded {filename} to Supabase Storage at {datetime.now()}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@backup_bp.route("/settings", methods=["GET"])
def get_settings():
    return jsonify(load_settings())


@backup_bp.route("/settings", methods=["POST"])
def save_settings():
    data = request.get_json()
    _save_settings(data)
    return jsonify({"message": "Backup settings saved"})


@backup_bp.route("/download", methods=["GET"])
def download_backup():
    """On-demand: generate all CSVs and return as a ZIP download."""
    zip_buffer, date_str = _build_zip_bytes()
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f"Backup_{date_str}.zip",
    )


@backup_bp.route("/cron", methods=["POST"])
def cron_backup():
    """
    Called daily by Vercel Cron Job (see vercel.json).
    Checks saved settings and runs the backup only when the schedule says to.
    Vercel automatically sends: Authorization: Bearer <CRON_SECRET>
    """
    cron_secret = os.environ.get("CRON_SECRET", "")
    if cron_secret and request.headers.get("Authorization") != f"Bearer {cron_secret}":
        return jsonify({"error": "Unauthorized"}), 401

    settings = load_settings()
    now = datetime.now(timezone.utc)
    should_run = False

    daily = settings.get("daily", {})
    if daily.get("enabled"):
        should_run = True

    weekly = settings.get("weekly", {})
    if weekly.get("enabled"):
        target_weekday = DAY_MAP.get(weekly.get("day", "monday").lower(), 0)
        if now.weekday() == target_weekday:
            should_run = True

    if not should_run:
        return jsonify({"message": "No backup scheduled for now"}), 200

    try:
        run_backup()
        return jsonify({"message": "Backup completed successfully"})
    except Exception as e:
        print(f"[Backup] Cron backup failed: {e}")
        return jsonify({"error": str(e)}), 500


@backup_bp.route("/list", methods=["GET"])
def list_backups():
    """List all backup ZIPs stored in Supabase Storage."""
    try:
        files = _supabase().storage.from_(STORAGE_BUCKET).list()
        return jsonify(files)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@backup_bp.route("/restore", methods=["POST"])
def restore_backup():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    filename = file.filename

    if not filename.endswith('.csv'):
        return jsonify({"error": "Only CSV files are supported"}), 400

    name_lower = filename.lower()
    if name_lower.startswith('inventory'):
        module = 'inventory'
    elif name_lower.startswith('supplier'):
        module = 'supplier'
    elif name_lower.startswith('orders'):
        module = 'orders'
    elif name_lower.startswith('sales'):
        module = 'sales'
    else:
        return jsonify({"error": "Filename must start with: Inventory, Supplier, Orders, or Sales"}), 400

    content = file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)

    if not rows:
        return jsonify({"error": "CSV file is empty"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        if module == 'inventory':
            count = restore_inventory(cur, rows)
        elif module == 'supplier':
            count = restore_supplier(cur, rows)
        elif module == 'orders':
            count = restore_orders(cur, rows)
        else:
            count = restore_sales(cur, rows)

        conn.commit()
        return jsonify({"message": f"Successfully restored {count} records to {module.capitalize()} module"})
    except Exception as e:
        conn.rollback()
        print("Restore error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


def restore_inventory(cur, rows):
    count = 0
    for row in rows:
        inv_id = row.get('inventory_id')
        if not inv_id:
            continue

        uom_code = row.get('uom', '')
        cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_code = %s", (uom_code,))
        uom_res = cur.fetchone()
        uom_id = uom_res[0] if uom_res else None

        status_name = row.get('status', 'Available')
        cur.execute(
            "SELECT status_id FROM static_status WHERE status_name = %s AND status_scope = 'INVENTORY_STATUS'",
            (status_name,)
        )
        st_res = cur.fetchone()
        status_id = st_res[0] if st_res else 1

        cur.execute("""
            INSERT INTO inventory (inventory_id, item_name, item_description, item_sku, brand,
                item_quantity, unit_of_measure, item_unit_price, item_selling_price, item_status_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (inventory_id) DO UPDATE SET
                item_name = EXCLUDED.item_name,
                item_description = EXCLUDED.item_description,
                item_sku = EXCLUDED.item_sku,
                brand = EXCLUDED.brand,
                item_quantity = EXCLUDED.item_quantity,
                unit_of_measure = EXCLUDED.unit_of_measure,
                item_unit_price = EXCLUDED.item_unit_price,
                item_selling_price = EXCLUDED.item_selling_price,
                item_status_id = EXCLUDED.item_status_id
        """, (
            inv_id, row.get('item_name'), row.get('item_description'), row.get('item_sku'),
            row.get('brand'), int(row.get('item_quantity', 0) or 0), uom_id,
            float(row.get('item_unit_price', 0) or 0), float(row.get('item_selling_price', 0) or 0),
            status_id
        ))
        count += 1
    return count


def restore_supplier(cur, rows):
    count = 0
    for row in rows:
        sup_id = row.get('supplier_id')
        if not sup_id:
            continue

        status_name = row.get('status', 'Active')
        cur.execute(
            "SELECT status_id FROM static_status WHERE status_name = %s AND status_scope = 'SUPPLIER_STATUS'",
            (status_name,)
        )
        st_res = cur.fetchone()
        status_id = st_res[0] if st_res else None

        cur.execute("""
            INSERT INTO supplier (supplier_id, supplier_name, contact_person, supplier_contact,
                supplier_email, supplier_address, supplier_status_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (supplier_id) DO UPDATE SET
                supplier_name = EXCLUDED.supplier_name,
                contact_person = EXCLUDED.contact_person,
                supplier_contact = EXCLUDED.supplier_contact,
                supplier_email = EXCLUDED.supplier_email,
                supplier_address = EXCLUDED.supplier_address,
                supplier_status_id = EXCLUDED.supplier_status_id
        """, (
            sup_id, row.get('supplier_name'), row.get('contact_person'),
            row.get('supplier_contact'), row.get('supplier_email'),
            row.get('supplier_address'), status_id
        ))
        count += 1
    return count


def restore_orders(cur, rows):
    count = 0
    seen = set()
    for row in rows:
        order_id = row.get('order_id')
        if not order_id or order_id in seen:
            continue
        seen.add(order_id)
        status_name = row.get('status')
        if status_name:
            cur.execute(
                "SELECT status_id FROM static_status WHERE status_name = %s AND status_scope = 'ORDER_STATUS'",
                (status_name,)
            )
            st_res = cur.fetchone()
            if st_res:
                cur.execute(
                    "UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s",
                    (st_res[0], order_id)
                )
        count += 1
    return count


def restore_sales(cur, rows):
    count = 0
    for row in rows:
        sales_id = row.get('sales_id')
        if not sales_id:
            continue
        status_name = row.get('status')
        if status_name:
            cur.execute(
                "SELECT status_id FROM static_status WHERE status_name = %s AND status_scope = 'SALES_STATUS'",
                (status_name,)
            )
            st_res = cur.fetchone()
            if st_res:
                cur.execute(
                    "UPDATE sales_transaction SET sales_status_id = %s WHERE TRIM(sales_id) = %s",
                    (st_res[0], sales_id)
                )
        count += 1
    return count
