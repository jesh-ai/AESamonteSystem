from flask import Blueprint, jsonify, request
from database.db_config import get_connection

inventory_bp = Blueprint("inventory", __name__)

# ================= GET INVENTORY =================
@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            i.inventory_id,
            i.item_name,
            i.item_description,
            i.item_sku,
            i.brand,
            i.item_quantity,
            u.uom_code AS uom,  -- Fetching uom_code (e.g., 'PCS') to match frontend
            s.status_name AS item_status,
            i.item_unit_price,
            i.item_selling_price
        FROM inventory i
        LEFT JOIN unit_of_measure u ON i.unit_of_measure = u.uom_id
        LEFT JOIN status_like s ON i.item_status_id = s.status_id AND s.status_scope='INVENTORY_STATUS'
        ORDER BY i.inventory_id ASC;
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "item_name": r[1],
            "item_description": r[2],
            "sku": r[3],
            "brand": r[4],
            "qty": r[5],
            "uom": r[6] or '—',
            "status": "Out of Stock" if r[5] <= 0 else f"Low Stock ({r[5]})" if r[5] <= 5 else "Available",
            "unitPrice": float(r[8]),
            "price": float(r[9])
        })

    return jsonify(result)

# ================= ADD BATCH INVENTORY =================
@inventory_bp.route("/api/inventory/add", methods=["POST"])
def add_inventory_batch():
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        items = request.get_json()
        
        if not items or not isinstance(items, list):
            return jsonify({"error": "Invalid data format. Expected a list."}), 400

        for item in items:
            # 1. Look up Supplier ID
            # Ensure your frontend sends 'detailSupplierName' correctly
            if not item.get('detailSupplierName') or item.get('detailSupplierName') == 'Select':
                raise Exception(f"Please select a valid supplier for item: {item.get('itemName')}")

            cur.execute("SELECT supplier_id FROM supplier WHERE supplier_name = %s", (item['detailSupplierName'],))
            supplier_res = cur.fetchone()
            if not supplier_res:
                raise Exception(f"Supplier '{item['detailSupplierName']}' not found.")
            supplier_id = supplier_res[0]

            # 2. Look up Unit of Measure ID
            # Frontend sends codes like 'PCS', 'BOX'. We check against uom_code.
            uom_val = item.get('uom')
            if uom_val == 'Select' or not uom_val:
                raise Exception(f"Please select a Unit of Measure for item: {item.get('itemName')}")

            cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_code = %s", (uom_val,))
            uom_res = cur.fetchone()
            
            if not uom_res:
                raise Exception(f"Unit of Measure '{uom_val}' not defined in database.")
            uom_id = uom_res[0]

            # 3. Insert into Inventory
            # We explicitly map frontend fields to the database columns
            cur.execute("""
                INSERT INTO public.inventory (
                    supplier_id, 
                    item_name, 
                    item_description, 
                    item_sku, 
                    brand, 
                    unit_of_measure, 
                    item_quantity, 
                    item_unit_price, 
                    item_selling_price,
                    item_status_id,
                    lead_time,
                    moq,
                    reorder_point
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s, %s, %s)
            """, (
                supplier_id,
                item['itemName'], 
                item['itemDescription'], 
                item['internalSku'], 
                item['brand'],
                uom_id,
                int(item['qty']), 
                float(item['unitPrice']), 
                float(item['sellingPrice']),
                # lead_time, moq, reorder_point (Make sure these cols exist in DB now)
                int(item.get('detailLeadTime') or 0), 
                int(item.get('detailMinOrder') or 0),
                int(item.get('reorderPoint') or 0)
            ))

        conn.commit()
        return jsonify({"message": f"Successfully saved {len(items)} items"}), 201

    except Exception as e:
        conn.rollback()
        print("Batch Save Error:", str(e)) # Check your backend terminal for this log
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/uom", methods=["GET"])
def get_uoms():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT uom_id, uom_code, uom_name 
        FROM unit_of_measure 
        WHERE is_active = true 
        ORDER BY uom_name ASC
    """)
    
    rows = cur.fetchall()
    cur.close()
    conn.close()

    uoms = [
        {"id": r[0], "code": r[1], "name": r[2]}
        for r in rows
    ]

    return jsonify(uoms)