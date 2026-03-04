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

    today = date.today()
    yesterday = today - timedelta(days=1)

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
    shipped_yesterday = count_orders("RECEIVED", yesterday)
    total_shipped = count_orders("RECEIVED")
    cancelled_today = count_orders("CANCELLED", today)
    cancelled_yesterday = count_orders("CANCELLED", yesterday)

    cur.execute("SELECT COUNT(*) FROM order_transaction")
    total_orders = cur.fetchone()[0]

    cur.close()
    conn.close()

    return jsonify({
        "shippedToday": {
            "current": shipped_today,
            "total": total_shipped,
            "yesterday": shipped_yesterday
        },
        "cancelled": {
            "current": cancelled_today,
            "yesterday": cancelled_yesterday
        },
        "totalOrders": {
            "count": total_orders,
            "growth": 3.1  
        }
    })

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
                sl.status_code AS order_status,
                COALESCE(pm.status_name, 'Cash') AS payment_method_name, 
                COALESCE(SUM(od.order_quantity), 0) as total_qty,
                COALESCE(SUM(od.order_total), 0) as total_amount,
                COALESCE(json_agg(
                    json_build_object(
                        'inventory_id', od.inventory_id,
                        'order_quantity', od.order_quantity,
                        'available_quantity', i.item_quantity,
                        'item_name', i.item_name,
                        'description', i.item_description,
                        'amount', od.order_total
                    )
                ) FILTER (WHERE od.order_id IS NOT NULL), '[]') AS items_json
            FROM order_transaction ot
            JOIN customer c ON ot.customer_id = c.customer_id
            JOIN static_status sl ON ot.order_status_id = sl.status_id
            LEFT JOIN static_status pm ON ot.payment_method_id = pm.status_id
            LEFT JOIN order_details od ON od.order_id = ot.order_id
            LEFT JOIN inventory i ON i.inventory_id = od.inventory_id
            WHERE sl.status_scope = 'ORDER_STATUS'
            GROUP BY 
                ot.order_id, 
                c.customer_name, 
                c.customer_address, 
                c.customer_contact, 
                ot.order_date, 
                sl.status_code,
                pm.status_name
            ORDER BY ot.order_id DESC
        """)

        rows = cur.fetchall()
        orders = []

        for row in rows:
            order_id, customer_name, customer_address, customer_contact, order_date, order_status, payment_method, total_qty, total_amount, items_json = row
            
            order_status_upper = (order_status or "").upper()
            is_archived = order_status_upper == 'INACTIVE'  

            if isinstance(items_json, str):
                try:
                    items_list = json.loads(items_json)
                except json.JSONDecodeError:
                    items_list = []
            else:
                items_list = items_json or []

            problematic_items = []
            if order_status_upper == "PREPARING":
                for item in items_list:
                    order_qty = item.get('order_quantity') or 0
                    available_qty = item.get('available_quantity') or 0
                    item_name = item.get('item_name') or 'Unknown'
                    if available_qty < order_qty:
                        problematic_items.append(f"{item_name} ({available_qty}/{order_qty})")

            availability_status = "Out of Stock" if problematic_items else None

            orders.append({
            "id": order_id,
            "customer": customer_name,
            "address": customer_address,     
            "contact": customer_contact,     
            "date": order_date.strftime("%m/%d/%y") if order_date else None,
            "status": order_status_upper.replace("_", " ").title(),
            "paymentMethod": payment_method, 
            "totalQty": total_qty,           
            "totalAmount": total_amount,     
            "availabilityStatus": availability_status,
            "problematicItems": problematic_items,
            "items": items_list,
            "is_archived": is_archived,
        })

        return jsonify(orders)
    except Exception as e:
        print("Error fetching list:", e)
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
        status_name = data.get('status', '').strip()
        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s", (status_name,))
        status_row = cur.fetchone()
        new_status_id = status_row[0] if status_row else None

        pm_name = data.get('paymentMethod', '').strip()
        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s", (pm_name,))
        pm_row = cur.fetchone()
        new_pm_id = pm_row[0] if pm_row else None

        cur.execute("SELECT customer_id FROM order_transaction WHERE order_id = %s", (order_id,))
        cust_row = cur.fetchone()
        if cust_row:
            customer_id = cust_row[0]
            cur.execute("""
                UPDATE customer 
                SET customer_name = %s, customer_contact = %s, customer_address = %s
                WHERE customer_id = %s
            """, (data.get('customerName'), data.get('contact'), data.get('address'), customer_id))

        cur.execute("""
            SELECT sl.status_name 
            FROM order_transaction ot
            JOIN static_status sl ON ot.order_status_id = sl.status_id
            WHERE ot.order_id = %s
        """, (order_id,))
        current_status_row = cur.fetchone()
        current_status = current_status_row[0].upper() if current_status_row else 'PREPARING'

        if current_status == 'PREPARING':
            
            # =======================================================
            # FIX STEP 1: RESTOCK OLD ITEMS
            # =======================================================
            cur.execute("SELECT inventory_id, order_quantity FROM order_details WHERE order_id = %s", (order_id,))
            old_items = cur.fetchall()
            for old_inv_id, old_qty in old_items:
                # Add the old quantity back into the inventory
                cur.execute("""
                    UPDATE inventory 
                    SET item_quantity = item_quantity + %s 
                    WHERE inventory_id = %s
                """, (old_qty, old_inv_id))
                
                # Automatically restore status to 'Available' if it had hit 0 previously
                cur.execute("""
                    UPDATE inventory
                    SET item_status_id = (
                        SELECT status_id FROM static_status 
                        WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'AVAILABLE' 
                        LIMIT 1
                    )
                    WHERE inventory_id = %s AND item_quantity > 0 AND item_status_id = (
                        SELECT status_id FROM static_status 
                        WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK' 
                        LIMIT 1
                    )
                """, (old_inv_id,))
            # =======================================================

            # FIX STEP 2: DELETE OLD ITEMS
            cur.execute("DELETE FROM order_details WHERE order_id = %s", (order_id,))
            
            # FIX STEP 3: INSERT NEW ITEMS & DEDUCT NEW AMOUNTS
            for item in data.get('items', []):
                inv_id = item.get('inventory_id')
                if inv_id and str(inv_id).strip() != "":
                    
                    # --- SECURITY CHECK: REJECT ARCHIVED ITEMS ---
                    cur.execute("""
                        SELECT ss.status_code, i.item_name 
                        FROM inventory i
                        JOIN static_status ss ON i.item_status_id = ss.status_id
                        WHERE i.inventory_id = %s
                    """, (inv_id,))
                    inv_check = cur.fetchone()
                    if not inv_check:
                        raise Exception(f"Item ID {inv_id} not found.")
                    if inv_check[0] == 'INACTIVE':
                        raise Exception(f"Cannot add '{inv_check[1]}' because it has been archived.")
                    # ---------------------------------------------
                    
                    try:
                        qty = int(item.get('quantity', 1)) or 1
                    except (ValueError, TypeError):
                        qty = 1
                    try:
                        amount = float(item.get('amount', 0))
                    except (ValueError, TypeError):
                        amount = 0.0
                        
                    unit_price = (amount / qty) if qty > 0 else 0.0

                    cur.execute("""
                        INSERT INTO order_details (order_id, inventory_id, order_quantity, unit_price, order_total)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (order_id, inv_id, qty, unit_price, amount))

                    # Deduct the new quantities from the inventory table
                    cur.execute("""
                        UPDATE inventory
                        SET item_quantity = item_quantity - %s
                        WHERE inventory_id = %s
                        RETURNING item_quantity
                    """, (qty, inv_id))
                    
                    result = cur.fetchone()
                    
                    if result:
                        new_qty = result[0]
                        # Automatically set status to "Out of Stock" if it drops to 0
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

        if new_status_id:
            cur.execute("UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s", (new_status_id, order_id))
            
        if new_pm_id:
            cur.execute("UPDATE order_transaction SET payment_method_id = %s WHERE order_id = %s", (new_pm_id, order_id))

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
        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s", (first_item_status,))
        status_row = cur.fetchone()
        status_id = status_row[0] if status_row else None

        first_item_pm = items[0].get('paymentMethod', 'Cash').strip() if items else 'Cash'
        cur.execute("SELECT status_id FROM static_status WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s", (first_item_pm,))
        pm_row = cur.fetchone()
        pm_id = pm_row[0] if pm_row else None

        # 3. Create Order Transaction
        today = date.today()
        cur.execute("""
            INSERT INTO order_transaction (customer_id, order_date, order_status_id, payment_method_id)
            VALUES (%s, %s, %s, %s) RETURNING order_id
        """, (customer_id, today, status_id, pm_id))
        order_id = cur.fetchone()[0]

        # 4. Insert Items and UPDATE INVENTORY
        for item in items:
            inv_id = item.get('inventory_id')
            if inv_id and str(inv_id).strip() != "":
                
                # --- SECURITY CHECK: REJECT ARCHIVED ITEMS ---
                cur.execute("""
                    SELECT ss.status_code, i.item_name 
                    FROM inventory i
                    JOIN static_status ss ON i.item_status_id = ss.status_id
                    WHERE i.inventory_id = %s
                """, (inv_id,))
                inv_check = cur.fetchone()
                
                if not inv_check:
                    raise Exception(f"Item ID {inv_id} not found.")
                if inv_check[0] == 'INACTIVE':
                    raise Exception(f"Order failed: '{inv_check[1]}' is archived.")
                # ---------------------------------------------

                try:
                    qty = int(item.get('quantity', 1)) or 1
                except (ValueError, TypeError):
                    qty = 1
                    
                try:
                    amount = float(item.get('amount', 0))
                except (ValueError, TypeError):
                    amount = 0.0
                    
                unit_price = (amount / qty) if qty > 0 else 0.0

                # Insert into order details
                cur.execute("""
                    INSERT INTO order_details (order_id, inventory_id, order_quantity, unit_price, order_total)
                    VALUES (%s, %s, %s, %s, %s)
                """, (order_id, inv_id, qty, unit_price, amount))

                # Deduct from Inventory Table Automatically
                cur.execute("""
                    UPDATE inventory
                    SET item_quantity = item_quantity - %s
                    WHERE inventory_id = %s
                    RETURNING item_quantity
                """, (qty, inv_id))
                
                result = cur.fetchone()
                
                if result:
                    new_qty = result[0]
                    
                    # Automatically set status to "Out of Stock" if it drops to 0
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

        conn.commit()
        return jsonify({"message": "Order added successfully!", "order_id": order_id}), 201

    except Exception as e:
        conn.rollback() 
        print("Error adding order:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()