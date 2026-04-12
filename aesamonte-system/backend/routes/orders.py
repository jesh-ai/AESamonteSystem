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
        yesterday = today - timedelta(days=1)

        # Helper for counting specific statuses
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

        shipped_today = count_orders("RECEIVED", today)
        total_shipped = count_orders("RECEIVED")
        cancelled_today = count_orders("CANCELLED", today)

        cur.execute("SELECT COUNT(*) FROM order_transaction")
        total_orders = cur.fetchone()[0]

        # --- MTD GROWTH CALCULATION ---
        this_month_start = today.replace(day=1)
        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        current_day = today.day
        try:
            last_month_same_day = last_month_start.replace(day=current_day)
        except ValueError:
            # Fallback if today is the 31st but last month only had 30 days
            last_month_same_day = last_month_end

        # Helper for MTD comparison
        def get_order_count(start_date, end_date=None):
            query = "SELECT COUNT(*) FROM order_transaction WHERE order_date >= %s"
            params = [start_date]
            if end_date:
                query += " AND order_date <= %s"
                params.append(end_date)
            cur.execute(query, params)
            return float(cur.fetchone()[0])

        mtd_current = get_order_count(this_month_start)
        mtd_last = get_order_count(last_month_start, last_month_same_day)

        if mtd_last == 0:
            growth = 100.0 if mtd_current > 0 else 0.0
        else:
            growth = round(((mtd_current - mtd_last) / mtd_last) * 100, 1)

        return jsonify({
            "shippedToday": {
                "current": shipped_today,
                "total": total_shipped,
            },
            "cancelled": {
                "current": cancelled_today,
            },
            "totalOrders": {
                "count": total_orders,
                "growth": growth 
            }
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
    cur = conn.cursor()

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
                            'inventory_id',        ib.inventory_id,
                            'inventory_brand_id',  od.inventory_brand_id,
                            'order_quantity',      od.order_quantity,
                            'available_quantity',  COALESCE(ib.total_quantity, 0),
                            'item_status_id',      ib.item_status_id,
                            'item_name',           i.item_name,
                            'brand_name',          COALESCE(b.brand_name, 'No Brand'),
                            'item_description',    COALESCE(ib.item_description, ''),
                            'amount',              od.order_total,
                            'uom',                 u.uom_name
                        )
                    ) FILTER (WHERE od.order_item_id IS NOT NULL
                                AND NOT COALESCE(od.is_archived, FALSE)),
                    '[]'
                ) AS items_json
            FROM order_transaction ot
            JOIN  customer      c         ON c.customer_id       = ot.customer_id
            LEFT JOIN static_status sl_status ON sl_status.status_id = ot.order_status_id
            LEFT JOIN static_status sl_pm     ON sl_pm.status_id     = ot.payment_method_id
            LEFT JOIN static_status sl_ps     ON sl_ps.status_id     = ot.payment_status_id
            LEFT JOIN order_details  od  ON od.order_id           = ot.order_id
            LEFT JOIN inventory_brand ib ON ib.inventory_brand_id = od.inventory_brand_id
            LEFT JOIN inventory       i  ON i.inventory_id        = ib.inventory_id
            LEFT JOIN brand           b  ON b.brand_id            = ib.brand_id
            LEFT JOIN unit_of_measure u  ON u.uom_id              = ib.uom_id
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

        rows = cur.fetchall()
        orders = []

        for row in rows:
            (order_id, customer_name, customer_address, customer_contact,
             order_date, order_status, payment_method, payment_status,
             total_qty, total_amount, items_json) = row

            order_status_upper = (order_status or "").upper()
            is_archived = order_status_upper == 'INACTIVE'

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
                    order_qty    = item.get('order_quantity')    or 0
                    available_qty = item.get('available_quantity') or 0
                    item_name    = item.get('item_name')         or 'Unknown'
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
    cur = conn.cursor()

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

        if current_status == 'INACTIVE':
            cur.execute("""
                SELECT status_id, status_name FROM static_status 
                WHERE status_scope = 'ORDER_STATUS' AND status_code = 'PREPARING'
            """)
            res = cur.fetchone()
            is_archived = False
            action_msg = "Order restored from Archive"
        else:
            cur.execute("""
                SELECT status_id, status_name FROM static_status 
                WHERE status_scope = 'ORDER_STATUS' AND status_code = 'INACTIVE'
            """)
            res = cur.fetchone()
            is_archived = True
            action_msg = "Order moved to Archive"

        if not res:
            return jsonify({"error": "Target status not found in static_status."}), 404

        new_status_id = res[0]

        cur.execute("""
            UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s
        """, (new_status_id, order_id))

        conn.commit()

        return jsonify({
            "message": action_msg,
            "is_archived": is_archived
        }), 200

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
    
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        if scope:
            cur.execute("SELECT status_id, status_name FROM static_status WHERE status_scope = %s", (scope,))
        else:
            cur.execute("SELECT status_id, status_name FROM static_status")
            
        rows = cur.fetchall()
        result = [{"status_id": r[0], "status_name": r[1]} for r in rows]
        return jsonify(result), 200
    except Exception as e:
        print("Error fetching statuses:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= UPDATE ORDER =================
@orders_bp.route("/update/<string:order_id>", methods=["PUT", "OPTIONS"])
def update_order(order_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    data = request.json
    conn = get_connection()
    cur = conn.cursor()

    try:
        # --- Resolve new status (id + code) ---
        status_name = data.get('status', '').strip()
        cur.execute("""
            SELECT status_id, status_code
            FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s
        """, (status_name,))
        status_row = cur.fetchone()
        new_status_id   = status_row[0] if status_row else None
        new_status_code = status_row[1].upper() if status_row else None

        # --- Resolve payment method ---
        pm_name = data.get('paymentMethod', '').strip()
        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s", (pm_name,))
        pm_row = cur.fetchone()
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
        old_row = cur.fetchone()
        old_status_code = old_row[0].upper() if old_row else 'PENDING'

        # --- State machine helpers ---
        # States where stock has already been deducted from inventory
        DEDUCTED_STATES = {'PREPARING', 'PACKED', 'SHIPPING'}

        old_is_deducted = old_status_code in DEDUCTED_STATES
        new_is_active   = new_status_code in DEDUCTED_STATES if new_status_code else False

        def restore_current_items():
            """Add back stock for every item currently on this order."""
            cur.execute("""
                SELECT inventory_brand_id, order_quantity FROM order_details WHERE order_id = %s
            """, (order_id,))
            rows = cur.fetchall()
            for brand_id, qty in rows:
                cur.execute("""
                    UPDATE inventory_brand SET total_quantity = total_quantity + %s
                    WHERE inventory_brand_id = %s
                """, (qty, brand_id))

                cur.execute("SELECT inventory_id FROM inventory_brand WHERE inventory_brand_id = %s", (brand_id,))
                inv_row = cur.fetchone()
                if inv_row:
                    inv_id = inv_row[0]
                    # Flip back to AVAILABLE only if total stock is now positive
                    cur.execute("""
                        UPDATE inventory
                        SET item_status_id = (
                            SELECT status_id FROM static_status
                            WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'AVAILABLE'
                            LIMIT 1
                        )
                        WHERE inventory_id = %s
                          AND COALESCE((SELECT SUM(total_quantity) FROM inventory_brand WHERE inventory_id = %s), 0) > 0
                          AND item_status_id = (
                            SELECT status_id FROM static_status
                            WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK'
                            LIMIT 1
                          )
                    """, (inv_id, inv_id))

        def insert_and_deduct_items():
            """Insert items from the request payload and deduct stock for each."""
            for item in data.get('items', []):
                inv_brand_id = item.get('inventory_brand_id')
                if not inv_brand_id or str(inv_brand_id).strip() == "":
                    continue

                cur.execute("""
                    SELECT ib.inventory_id, ss.status_code, i.item_name
                    FROM inventory_brand ib
                    JOIN inventory i ON i.inventory_id = ib.inventory_id
                    JOIN static_status ss ON i.item_status_id = ss.status_id
                    WHERE ib.inventory_brand_id = %s
                """, (inv_brand_id,))
                inv_check = cur.fetchone()
                if not inv_check:
                    raise Exception(f"Variant ID {inv_brand_id} not found.")
                inv_id, status_code, item_name = inv_check
                if status_code == 'INACTIVE':
                    raise Exception(f"Cannot add '{item_name}' because it has been archived.")

                try:
                    raw_qty = item.get('quantity') or item.get('qty') or item.get('order_quantity') or 1
                    qty = int(raw_qty) or 1
                except (ValueError, TypeError):
                    qty = 1
                try:
                    raw_amount = item.get('amount') or item.get('order_total') or 0
                    amount = float(raw_amount)
                except (ValueError, TypeError):
                    amount = 0.0

                unit_price = (amount / qty) if qty > 0 else 0.0

                cur.execute("""
                    INSERT INTO order_details (order_id, inventory_brand_id, order_quantity, unit_price, order_total)
                    VALUES (%s, %s, %s, %s, %s)
                """, (order_id, inv_brand_id, qty, unit_price, amount))

                cur.execute("""
                    UPDATE inventory_brand SET total_quantity = total_quantity - %s
                    WHERE inventory_brand_id = %s
                """, (qty, inv_brand_id))

                cur.execute("""
                    SELECT COALESCE(SUM(total_quantity), 0) FROM inventory_brand WHERE inventory_id = %s
                """, (inv_id,))
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

        def insert_items_only():
            """Insert items from the request payload without touching inventory stock."""
            for item in data.get('items', []):
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
                cur.execute("""
                    INSERT INTO order_details (order_id, inventory_brand_id, order_quantity, unit_price, order_total)
                    VALUES (%s, %s, %s, %s, %s)
                """, (order_id, inv_brand_id, qty, unit_price, amount))

        # --- State machine: apply the correct stock action ---
        #
        #  old \ new  | PENDING | ACTIVE (PREPARING/PACKED/SHIPPING) | CANCELLED
        # ------------+---------+-------------------------------------+----------
        #  PENDING    |  swap*  |  first deduction + swap            |  no-op
        #  ACTIVE     |  —      |  restore old + swap + deduct new   |  RESTORE
        #
        # *swap = delete old order_details rows, insert new ones

        if old_is_deducted and new_status_code == 'CANCELLED':
            # RESTORE: give back stock for the items that were deducted
            restore_current_items()
            # Do NOT modify order_details — preserve the audit trail

        elif old_is_deducted and new_is_active:
            # SWAP while active: restock old items, replace with new items, deduct new
            restore_current_items()
            cur.execute("DELETE FROM order_details WHERE order_id = %s", (order_id,))
            insert_and_deduct_items()

        elif not old_is_deducted and new_is_active:
            # FIRST DEDUCTION: order promoted from PENDING to an active state
            cur.execute("DELETE FROM order_details WHERE order_id = %s", (order_id,))
            insert_and_deduct_items()

        else:
            # No stock change (e.g. PENDING → PENDING, PENDING → CANCELLED).
            # Allow item edits on non-active orders, but skip if cancelling.
            if new_status_code != 'CANCELLED' and data.get('items') is not None:
                cur.execute("DELETE FROM order_details WHERE order_id = %s", (order_id,))
                insert_items_only()

        # --- Apply status and payment updates ---
        if new_status_id:
            cur.execute("UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s", (new_status_id, order_id))

        if new_pm_id:
            cur.execute("UPDATE order_transaction SET payment_method_id = %s WHERE order_id = %s", (new_pm_id, order_id))

        # Always sync total_amount from order_details
        # (sales_transaction is created automatically by trg_move_received_order trigger on RECEIVED)
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
    cur = conn.cursor()
    
    try:
        customer_name = data.get('customerName', '').strip()
        contact_number = data.get('contactNumber', '').strip()
        delivery_address = data.get('deliveryAddress', '').strip()

        # 1. Customer Handling 
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

        # 2. Get Status & Payment IDs
        items = data.get('items', [])
        first_item_status = items[0].get('orderStatus', 'Preparing').strip() if items else 'Preparing'
        cur.execute("SELECT status_id, status_code FROM static_status WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s", (first_item_status,))
        status_row = cur.fetchone()
        status_id = status_row[0] if status_row else None
        initial_status_code = status_row[1].upper() if status_row else 'PENDING'

        first_item_pm = items[0].get('paymentMethod', 'Cash').strip() if items else 'Cash'
        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s", (first_item_pm,))
        pm_row = cur.fetchone()
        pm_id = pm_row[0] if pm_row else None

        # Resolve payment_status_id — default to UNPAID since new orders have no payment yet
        payment_status_code = data.get('paymentStatus', 'UNPAID').strip().upper()
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'PAYMENT_STATUS' AND status_code = %s
        """, (payment_status_code,))
        ps_row = cur.fetchone()
        if not ps_row:
            # Fallback: grab whichever PAYMENT_STATUS row exists for UNPAID
            cur.execute("""
                SELECT status_id FROM static_status
                WHERE status_scope = 'PAYMENT_STATUS' AND status_code = 'UNPAID'
                LIMIT 1
            """)
            ps_row = cur.fetchone()
        payment_status_id = ps_row[0] if ps_row else None

        # 3. Create Order Transaction
        today = date.today()
        cur.execute("""
            INSERT INTO order_transaction (customer_id, order_date, order_status_id, payment_method_id, payment_status_id)
            VALUES (%s, %s, %s, %s, %s) RETURNING order_id
        """, (customer_id, today, status_id, pm_id, payment_status_id))
        order_id = cur.fetchone()[0]

        # 4. Insert Items and UPDATE INVENTORY
        for item in items:
            inv_brand_id = item.get('inventory_brand_id')
            if not inv_brand_id or str(inv_brand_id).strip() == "":
                continue

            # Look up inventory_id and check for archived status in one query
            cur.execute("""
                SELECT ib.inventory_id, ss.status_code, i.item_name
                FROM inventory_brand ib
                JOIN inventory i ON i.inventory_id = ib.inventory_id
                JOIN static_status ss ON i.item_status_id = ss.status_id
                WHERE ib.inventory_brand_id = %s
            """, (inv_brand_id,))
            inv_check = cur.fetchone()

            if not inv_check:
                raise Exception(f"Variant ID {inv_brand_id} not found.")
            inv_id, status_code, item_name = inv_check
            if status_code == 'INACTIVE':
                raise Exception(f"Order failed: '{item_name}' is archived.")

            try:
                qty = int(item.get('quantity', 1)) or 1
            except (ValueError, TypeError):
                qty = 1

            try:
                amount = float(item.get('amount', 0))
            except (ValueError, TypeError):
                amount = 0.0

            unit_price = (amount / qty) if qty > 0 else 0.0

            # Insert into order_details using inventory_brand_id
            cur.execute("""
                INSERT INTO order_details (order_id, inventory_brand_id, order_quantity, unit_price, order_total)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, inv_brand_id, qty, unit_price, amount))

            # Only deduct stock when the order is created directly into an active state
            # (e.g. POS creating an order already in PREPARING). PENDING orders do not
            # touch inventory here — deduction happens on the PENDING → PREPARING transition.
            if initial_status_code in {'PREPARING', 'PACKED', 'SHIPPING'}:
                cur.execute("""
                    UPDATE inventory_brand SET total_quantity = total_quantity - %s
                    WHERE inventory_brand_id = %s
                """, (qty, inv_brand_id))

                cur.execute("""
                    SELECT COALESCE(SUM(total_quantity), 0) FROM inventory_brand WHERE inventory_id = %s
                """, (inv_id,))
                new_qty = cur.fetchone()[0]

                if new_qty <= 0:
                    cur.execute("""
                        UPDATE inventory
                        SET item_status_id = (
                            SELECT status_id FROM static_status
                            WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK'
                            LIMIT 1
                        )
                        WHERE inventory_id = %s
                    """, (inv_id,))

        # 5. Sync total_amount on order_transaction from inserted order_details
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