from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta
import json

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

# ===================== SUMMARY =====================
@orders_bp.route("/summary", methods=["GET"])
def orders_summary():
    conn = get_connection()
    cur = conn.cursor()

    try:
        today = date.today()

        def count_orders(status_code, for_date=None):
            query = """
                SELECT COUNT(*)
                FROM order_transaction ot
                JOIN static_status sl ON ot.order_status_id = sl.status_id
                WHERE sl.status_scope = 'ORDER_STATUS'
                  AND sl.status_code ILIKE %s
            """
            params = [status_code]
            if for_date:
                query += " AND ot.order_date = %s"
                params.append(for_date)
            cur.execute(query, params)
            return cur.fetchone()[0]

        shipped_today   = count_orders("RECEIVED", today)
        total_shipped   = count_orders("RECEIVED")
        cancelled_today = count_orders("CANCELLED", today)

        cur.execute("SELECT COUNT(*) FROM order_transaction")
        total_orders = cur.fetchone()[0]

        # --- MTD GROWTH CALCULATION ---
        this_month_start = today.replace(day=1)
        last_month_end   = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        current_day      = today.day
        try:
            last_month_same_day = last_month_start.replace(day=current_day)
        except ValueError:
            last_month_same_day = last_month_end

        def get_order_count(start_date, end_date=None):
            query  = "SELECT COUNT(*) FROM order_transaction WHERE order_date >= %s"
            params = [start_date]
            if end_date:
                query += " AND order_date <= %s"
                params.append(end_date)
            cur.execute(query, params)
            return float(cur.fetchone()[0])

        mtd_current = get_order_count(this_month_start)
        mtd_last    = get_order_count(last_month_start, last_month_same_day)

        if mtd_last == 0:
            growth = 100.0 if mtd_current > 0 else 0.0
        else:
            growth = round(((mtd_current - mtd_last) / mtd_last) * 100, 1)

        return jsonify({
            "shippedToday": {"current": shipped_today, "total": total_shipped},
            "cancelled":    {"current": cancelled_today},
            "totalOrders":  {"count": total_orders, "growth": growth}
        })
    except Exception as e:
        print("Error fetching summary:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ===================== LIST =====================
@orders_bp.route("/list", methods=["GET"])
def orders_list():
    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            SELECT
                ot.order_id,
                c.customer_name,
                c.customer_address,
                c.customer_contact,
                ot.order_date,
                COALESCE(sl_status.status_name, 'Preparing') AS order_status,
                COALESCE(sl_pm.status_name, 'Cash')          AS payment_method_name,
                COALESCE(sl_ps.status_name, NULL)            AS payment_status_name,
                COALESCE(
                    SUM(od.order_quantity)
                    FILTER (WHERE od.order_item_id IS NOT NULL
                              AND NOT COALESCE(od.is_archived, FALSE)),
                    0
                ) AS total_qty,
                COALESCE(ot.total_amount, 0) AS total_amount,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'batch_id',           ib.batch_id,
                            'inventory_brand_id',  ibr.inventory_brand_id,
                            'order_quantity',      od.order_quantity,
                            'available_quantity',  COALESCE(ib.quantity_on_hand, 0),
                            'batch_status_id',     ib.batch_status_id,
                            'item_name',           i.item_name,
                            'brand_name',          COALESCE(b.brand_name, 'No Brand'),
                            'item_description',    COALESCE(ibr.item_description, ''),
                            'amount',              od.order_total,
                            'uom',                 u.uom_name,
                            'batch_number',        ib.batch_number,
                            'expiry_date',         ib.expiry_date
                        )
                    ) FILTER (WHERE od.order_item_id IS NOT NULL
                                AND NOT COALESCE(od.is_archived, FALSE)),
                    '[]'
                ) AS items_json
            FROM order_transaction ot
            JOIN  customer          c         ON c.customer_id          = ot.customer_id
            LEFT JOIN static_status sl_status ON sl_status.status_id    = ot.order_status_id
            LEFT JOIN static_status sl_pm     ON sl_pm.status_id        = ot.payment_method_id
            LEFT JOIN static_status sl_ps     ON sl_ps.status_id        = ot.payment_status_id
            LEFT JOIN order_details  od       ON od.order_id            = ot.order_id
            LEFT JOIN inventory_batch ib      ON ib.batch_id            = od.batch_id
            LEFT JOIN inventory_brand ibr     ON ibr.inventory_brand_id = ib.inventory_brand_id
            LEFT JOIN inventory       i       ON i.inventory_id         = ibr.inventory_id
            LEFT JOIN brand           b       ON b.brand_id             = ibr.brand_id
            LEFT JOIN unit_of_measure u       ON u.uom_id               = ibr.uom_id
            GROUP BY
                ot.order_id,
                c.customer_name,
                c.customer_address,
                c.customer_contact,
                ot.order_date,
                sl_status.status_name,
                sl_pm.status_name,
                sl_ps.status_name,
                ot.total_amount
            ORDER BY ot.order_id DESC
        """)

        rows   = cur.fetchall()
        orders = []

        for row in rows:
            (order_id, customer_name, customer_address, customer_contact,
             order_date, order_status, payment_method, payment_status,
             total_qty, total_amount, items_json) = row

            order_status_upper = (order_status or "").upper()
            is_archived        = order_status_upper == 'ARCHIVED'

            if isinstance(items_json, str):
                try:
                    items_list = json.loads(items_json)
                except json.JSONDecodeError:
                    items_list = []
            else:
                items_list = items_json if isinstance(items_json, list) else []

            problematic_items = []
            if order_status_upper == "PREPARING":
                for item in items_list:
                    order_qty     = item.get('order_quantity')    or 0
                    available_qty = item.get('available_quantity') or 0
                    item_name     = item.get('item_name')         or 'Unknown'
                    if available_qty < order_qty:
                        problematic_items.append(f"{item_name} ({available_qty}/{order_qty})")

            availability_status = "Out of Stock" if problematic_items else None

            orders.append({
                "id":                 order_id,
                "customer":           customer_name,
                "address":            customer_address,
                "contact":            customer_contact,
                "date":               order_date.strftime("%m/%d/%y") if order_date else None,
                "status":             order_status_upper.replace("_", " ").title(),
                "paymentMethod":      payment_method,
                "paymentStatus":      payment_status,
                "totalQty":           int(total_qty),
                "totalAmount":        float(total_amount) if total_amount is not None else 0.0,
                "availabilityStatus": availability_status,
                "problematicItems":   problematic_items,
                "items":              items_list,
                "is_archived":        is_archived,
            })

        return jsonify(orders)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ===================== TOGGLE ARCHIVE =====================
@orders_bp.route("/archive/<string:order_id>", methods=["PUT", "OPTIONS"])
def toggle_order_archive(order_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            SELECT ss.status_code
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ot.order_id = %s
        """, (order_id,))

        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Order not found."}), 404

        current_status = row[0]

        if current_status == 'ARCHIVED':
            cur.execute("""
                SELECT status_id, status_name FROM static_status
                WHERE status_scope = 'ORDER_STATUS' AND status_code = 'PREPARING'
            """)
            res         = cur.fetchone()
            is_archived = False
            action_msg  = "Order restored from Archive"
        else:
            cur.execute("""
                SELECT status_id, status_name FROM static_status
                WHERE status_scope = 'ORDER_STATUS' AND status_code = 'ARCHIVED'
            """)
            res         = cur.fetchone()
            is_archived = True
            action_msg  = "Order moved to Archive"

        if not res:
            return jsonify({"error": "Target status not found in static_status."}), 404

        new_status_id = res[0]
        cur.execute("""
            UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s
        """, (new_status_id, order_id))

        conn.commit()
        return jsonify({"message": action_msg, "is_archived": is_archived}), 200

    except Exception as e:
        conn.rollback()
        print("Error toggling order archive:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= GET STATUSES =================
@orders_bp.route("/status", methods=["GET"])
def get_order_statuses():
    scope = request.args.get('scope')
    conn  = get_connection()
    cur   = conn.cursor()

    try:
        if scope:
            cur.execute("SELECT status_id, status_name FROM static_status WHERE status_scope = %s", (scope,))
        else:
            cur.execute("SELECT status_id, status_name FROM static_status")
        rows   = cur.fetchall()
        result = [{"status_id": r[0], "status_name": r[1]} for r in rows]
        return jsonify(result), 200
    except Exception as e:
        print("Error fetching statuses:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ===================== SHARED FIFO HELPERS =====================

def _fifo_allocate(cur, inv_brand_id, qty_needed):
    """
    Returns list of (batch_id, qty_to_take) using FIFO (oldest date_created first).
    Raises Exception if total available stock < qty_needed.
    """
    cur.execute("""
        SELECT batch_id, quantity_on_hand
        FROM inventory_batch
        WHERE inventory_brand_id = %s
          AND quantity_on_hand > 0
        ORDER BY date_created ASC
    """, (inv_brand_id,))
    batches         = cur.fetchall()
    total_available = sum(r[1] for r in batches)

    if total_available < qty_needed:
        raise Exception(
            f"Insufficient stock for inventory_brand_id {inv_brand_id}: "
            f"need {qty_needed}, available {total_available}."
        )

    allocation = []
    remaining  = qty_needed
    for batch_id, on_hand in batches:
        if remaining <= 0:
            break
        take = min(on_hand, remaining)
        allocation.append((batch_id, take))
        remaining -= take

    return allocation


def _restore_batch_items(cur, order_id):
    """
    Returns stock to inventory_batch for every order_details row on this order.
    Flips inventory back to AVAILABLE if stock is now positive.
    """
    cur.execute("""
        SELECT od.batch_id, od.order_quantity, ib.inventory_brand_id
        FROM order_details od
        JOIN inventory_batch ib ON ib.batch_id = od.batch_id
        WHERE od.order_id = %s
    """, (order_id,))
    rows = cur.fetchall()

    for batch_id, qty, inv_brand_id in rows:
        cur.execute("""
            UPDATE inventory_batch
            SET quantity_on_hand = quantity_on_hand + %s
            WHERE batch_id = %s
        """, (qty, batch_id))

        cur.execute("""
            SELECT inventory_id FROM inventory_brand WHERE inventory_brand_id = %s
        """, (inv_brand_id,))
        inv_row = cur.fetchone()
        if inv_row:
            inv_id = inv_row[0]
            cur.execute("""
                UPDATE inventory
                SET item_status_id = (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'AVAILABLE'
                    LIMIT 1
                )
                WHERE inventory_id = %s
                  AND COALESCE(
                        (SELECT SUM(quantity_on_hand) FROM inventory_batch
                         WHERE inventory_brand_id = %s), 0) > 0
                  AND item_status_id = (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK'
                    LIMIT 1
                  )
            """, (inv_id, inv_brand_id))


def _insert_and_deduct_items(cur, order_id, items):
    """
    Inserts order_details rows using FIFO batch allocation and deducts
    quantity_on_hand from each allocated batch.
    Marks inventory OUT_OF_STOCK when all batches for a brand are exhausted.
    """
    for item in items:
        inv_brand_id = item.get('inventory_brand_id')
        if not inv_brand_id or str(inv_brand_id).strip() == "":
            continue

        # Validate brand / inventory status
        cur.execute("""
            SELECT ibr.inventory_id, ss.status_code, i.item_name
            FROM inventory_brand ibr
            JOIN inventory i ON i.inventory_id = ibr.inventory_id
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ibr.inventory_brand_id = %s
        """, (inv_brand_id,))
        inv_check = cur.fetchone()
        if not inv_check:
            raise Exception(f"Variant ID {inv_brand_id} not found.")
        inv_id, status_code, item_name = inv_check
        if status_code == 'INACTIVE':
            raise Exception(f"Cannot add '{item_name}' because it has been archived.")

        try:
            qty = int(item.get('quantity') or item.get('qty') or item.get('order_quantity') or 1) or 1
        except (ValueError, TypeError):
            qty = 1
        try:
            amount = float(item.get('amount') or item.get('order_total') or 0)
        except (ValueError, TypeError):
            amount = 0.0

        unit_price = (amount / qty) if qty > 0 else 0.0

        # FIFO allocation across batches
        allocation = _fifo_allocate(cur, inv_brand_id, qty)

        for batch_id, batch_qty in allocation:
            batch_amount = round(unit_price * batch_qty, 4)
            cur.execute("""
                INSERT INTO order_details
                    (order_id, batch_id, order_quantity, unit_price, order_total)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, batch_id, batch_qty, unit_price, batch_amount))

            cur.execute("""
                UPDATE inventory_batch
                SET quantity_on_hand = quantity_on_hand - %s
                WHERE batch_id = %s
            """, (batch_qty, batch_id))

        # Mark OUT_OF_STOCK if all batches for this brand are now empty
        cur.execute("""
            SELECT COALESCE(SUM(quantity_on_hand), 0)
            FROM inventory_batch WHERE inventory_brand_id = %s
        """, (inv_brand_id,))
        if cur.fetchone()[0] <= 0:
            cur.execute("""
                UPDATE inventory
                SET item_status_id = (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK'
                    LIMIT 1
                )
                WHERE inventory_id = %s
            """, (inv_id,))


def _insert_items_only(cur, order_id, items):
    """
    Inserts order_details rows for a PENDING order without touching stock.
    Picks the oldest available batch per brand for FK reference only.
    """
    for item in items:
        inv_brand_id = item.get('inventory_brand_id')
        if not inv_brand_id or str(inv_brand_id).strip() == "":
            continue
        try:
            qty = int(item.get('quantity') or item.get('qty') or item.get('order_quantity') or 1) or 1
        except (ValueError, TypeError):
            qty = 1
        try:
            amount = float(item.get('amount') or item.get('order_total') or 0)
        except (ValueError, TypeError):
            amount = 0.0
        unit_price = (amount / qty) if qty > 0 else 0.0

        # Pick oldest batch for FK reference — no stock deduction
        cur.execute("""
            SELECT batch_id FROM inventory_batch
            WHERE inventory_brand_id = %s AND quantity_on_hand > 0
            ORDER BY date_created ASC LIMIT 1
        """, (inv_brand_id,))
        batch_row = cur.fetchone()
        if not batch_row:
            continue
        batch_id = batch_row[0]

        cur.execute("""
            INSERT INTO order_details
                (order_id, batch_id, order_quantity, unit_price, order_total)
            VALUES (%s, %s, %s, %s, %s)
        """, (order_id, batch_id, qty, unit_price, amount))



def _create_sales_record(cur, order_id):
    """
    Inserts a row into sales_transaction when an order is marked RECEIVED.
    Skips silently if a record already exists for this order.
    """
    # Check if a sales record already exists
    cur.execute(
        "SELECT sales_id FROM sales_transaction WHERE order_id = %s LIMIT 1",
        (order_id,)
    )
    if cur.fetchone():
        return  # Already recorded — idempotent

    # Resolve the PENDING payment status id (auto-fix will upgrade to PAID later)
    cur.execute("""
        SELECT status_id FROM static_status
        WHERE status_scope = 'SALES_STATUS' AND status_code = 'PENDING'
        LIMIT 1
    """)
    pending_row = cur.fetchone()

    # Fallback: try PAID if PENDING doesn't exist
    if not pending_row:
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'SALES_STATUS' AND status_code = 'PAID'
            LIMIT 1
        """)
        pending_row = cur.fetchone()

    if not pending_row:
        raise Exception("No PENDING or PAID status found in SALES_STATUS scope.")

    payment_status_id = pending_row[0]

    # Fetch payment_method_id from the order
    cur.execute("""
        SELECT payment_method_id
        FROM order_transaction
        WHERE order_id = %s
    """, (order_id,))
    order_row = cur.fetchone()
    payment_method_id = order_row[0] if order_row else None

    cur.execute("""
        INSERT INTO sales_transaction
            (order_id, sales_date, payment_status_id, employee_id, payment_method_id)
        VALUES (%s, CURRENT_DATE, %s, %s, %s)
    """, (order_id, payment_status_id, 1, payment_method_id))


# ================= UPDATE ORDER =================
@orders_bp.route("/update/<string:order_id>", methods=["PUT", "OPTIONS"])
def update_order(order_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    data = request.json
    conn = get_connection()
    cur  = conn.cursor()

    try:
        # --- BLOCK UPDATES IF ALREADY CANCELLED ---
        cur.execute("""
            SELECT ss.status_code
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ot.order_id = %s
        """, (order_id,))
        row = cur.fetchone()
        if row:
            current_status = row[0].upper()
            if current_status == 'CANCELLED':
                return jsonify({"error": "Cannot edit an order that is already CANCELLED."}), 400

        # --- Resolve new status (id + code) ---
        status_name = data.get('status', '').strip()
        cur.execute("""
            SELECT status_id, status_code
            FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s
        """, (status_name,))
        status_row      = cur.fetchone()
        new_status_id   = status_row[0] if status_row else None
        new_status_code = status_row[1].upper() if status_row else None

        # --- Resolve payment method ---
        pm_name = data.get('paymentMethod', '').strip()
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s
        """, (pm_name,))
        pm_row    = cur.fetchone()
        new_pm_id = pm_row[0] if pm_row else None

        # --- Update customer info ---
        cur.execute("SELECT customer_id FROM order_transaction WHERE order_id = %s", (order_id,))
        cust_row = cur.fetchone()
        if cust_row:
            customer_id = cust_row[0]
            cur.execute("""
                UPDATE customer
                SET customer_name = %s, customer_contact = %s, customer_address = %s
                WHERE customer_id = %s
            """, (data.get('customerName'), data.get('contact'), data.get('address'), customer_id))

        # --- Fetch old status code ---
        cur.execute("""
            SELECT ss.status_code
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ot.order_id = %s
        """, (order_id,))
        old_row         = cur.fetchone()
        old_status_code = old_row[0].upper() if old_row else 'PENDING'

        # States where stock has already been deducted
        DEDUCTED_STATES = {'PREPARING', 'PACKED', 'SHIPPING'}
        old_is_deducted = old_status_code in DEDUCTED_STATES
        new_is_active   = new_status_code in DEDUCTED_STATES if new_status_code else False

        # --- State machine ---
        if new_status_code == 'RECEIVED':
            # Order is being marked as received → create sales record
            # Stock was already deducted when order entered PREPARING/PACKED/SHIPPING
            _create_sales_record(cur, order_id)

        elif old_is_deducted and new_status_code == 'CANCELLED':
            # Restore stock, preserve order_details for audit trail
            _restore_batch_items(cur, order_id)

        elif old_is_deducted and new_is_active:
            # Swap: restore old stock, replace items, deduct new stock
            _restore_batch_items(cur, order_id)
            cur.execute("DELETE FROM order_details WHERE order_id = %s", (order_id,))
            _insert_and_deduct_items(cur, order_id, data.get('items', []))

        elif not old_is_deducted and new_is_active:
            # First deduction: order promoted from PENDING to active state
            cur.execute("DELETE FROM order_details WHERE order_id = %s", (order_id,))
            _insert_and_deduct_items(cur, order_id, data.get('items', []))

        else:
            # No stock change (PENDING → PENDING, PENDING → CANCELLED)
            if new_status_code != 'CANCELLED' and data.get('items') is not None:
                cur.execute("DELETE FROM order_details WHERE order_id = %s", (order_id,))
                _insert_items_only(cur, order_id, data.get('items', []))

        # --- Apply status and payment updates ---
        if new_status_id:
            cur.execute("""
                UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s
            """, (new_status_id, order_id))

        if new_pm_id:
            cur.execute("""
                UPDATE order_transaction SET payment_method_id = %s WHERE order_id = %s
            """, (new_pm_id, order_id))

        # Sync total_amount from order_details
        cur.execute("""
            UPDATE order_transaction
            SET total_amount = (
                SELECT COALESCE(SUM(order_total), 0) FROM order_details WHERE order_id = %s
            )
            WHERE order_id = %s
        """, (order_id, order_id))

        conn.commit()
        return jsonify({"message": "Order updated successfully"}), 200

    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        print("Error updating order:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= ADD ORDER =================
@orders_bp.route("/add", methods=["POST", "OPTIONS"])
def add_order():
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    data = request.json
    conn = get_connection()
    cur  = conn.cursor()

    try:
        customer_name    = data.get('customerName', '').strip()
        contact_number   = data.get('contactNumber', '').strip()
        delivery_address = data.get('deliveryAddress', '').strip()

        # 1. Customer handling
        cur.execute("SELECT customer_id FROM customer WHERE customer_name = %s", (customer_name,))
        existing_cust = cur.fetchone()

        if existing_cust:
            customer_id = existing_cust[0]
            cur.execute("""
                UPDATE customer
                SET customer_contact = %s, customer_address = %s
                WHERE customer_id = %s
            """, (contact_number, delivery_address, customer_id))
        else:
            cur.execute("""
                INSERT INTO customer (customer_name, customer_contact, customer_address, customer_email)
                VALUES (%s, %s, %s, %s) RETURNING customer_id
            """, (customer_name, contact_number, delivery_address, 'no-email@placeholder.com'))
            customer_id = cur.fetchone()[0]

        # 2. Resolve status & payment IDs
        items             = data.get('items', [])
        first_item_status = items[0].get('orderStatus', 'Preparing').strip() if items else 'Preparing'
        cur.execute("""
            SELECT status_id, status_code FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s
        """, (first_item_status,))
        status_row          = cur.fetchone()
        status_id           = status_row[0] if status_row else None
        initial_status_code = status_row[1].upper() if status_row else 'PENDING'

        first_item_pm = items[0].get('paymentMethod', 'Cash').strip() if items else 'Cash'
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s
        """, (first_item_pm,))
        pm_row = cur.fetchone()
        pm_id  = pm_row[0] if pm_row else None

        payment_status_code = data.get('paymentStatus', 'UNPAID').strip().upper()
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'PAYMENT_STATUS' AND status_code = %s
        """, (payment_status_code,))
        ps_row = cur.fetchone()
        if not ps_row:
            cur.execute("""
                SELECT status_id FROM static_status
                WHERE status_scope = 'PAYMENT_STATUS' AND status_code = 'UNPAID'
                LIMIT 1
            """)
            ps_row = cur.fetchone()
        payment_status_id = ps_row[0] if ps_row else None

        # 3. Create order transaction
        today = date.today()
        cur.execute("""
            INSERT INTO order_transaction
                (customer_id, order_date, order_status_id, payment_method_id, payment_status_id)
            VALUES (%s, %s, %s, %s, %s) RETURNING order_id
        """, (customer_id, today, status_id, pm_id, payment_status_id))
        order_id = cur.fetchone()[0]

        # 4. Insert items — FIFO deduction only for active/received states
        ACTIVE_STATES = {'PREPARING', 'PACKED', 'SHIPPING', 'RECEIVED'}
        if initial_status_code in ACTIVE_STATES:
            _insert_and_deduct_items(cur, order_id, items)
        else:
            _insert_items_only(cur, order_id, items)

        # 5a. If created directly as RECEIVED, create the sales record immediately
        if initial_status_code == 'RECEIVED':
            _create_sales_record(cur, order_id)

        # 5b. Sync total_amount
        cur.execute("""
            UPDATE order_transaction
            SET total_amount = (
                SELECT COALESCE(SUM(order_total), 0) FROM order_details WHERE order_id = %s
            )
            WHERE order_id = %s
        """, (order_id, order_id))

        conn.commit()
        return jsonify({"message": "Order added successfully!", "order_id": order_id}), 201

    except Exception as e:
        conn.rollback()
        print("Error adding order:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()