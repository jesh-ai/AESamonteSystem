from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import datetime

inventory_bp = Blueprint("inventory", __name__)

# ================= GET BRANDS =================
@inventory_bp.route("/api/brands", methods=["GET"])
def get_brands():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT brand_id, brand_code, brand_name
            FROM brand
            ORDER BY brand_name ASC
        """)
        rows = cur.fetchall()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
    return jsonify([{"id": r[0], "code": r[1], "name": r[2]} for r in rows])

# ================= GET INVENTORY =================
@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                i.inventory_id,
                i.item_name,
                COALESCE(
                    (SELECT ib2.item_description FROM inventory_brands ib2
                     WHERE ib2.inventory_id = i.inventory_id LIMIT 1),
                    ''
                ) AS item_description,
                i.total_quantity,
                COALESCE(
                    (SELECT u2.uom_code FROM inventory_brands ib2
                     JOIN unit_of_measure u2 ON ib2.unit_of_measure = u2.uom_id
                     WHERE ib2.inventory_id = i.inventory_id LIMIT 1),
                    '—'
                ) AS uom,
                s.status_name AS item_status,
                i.item_status_id
            FROM inventory i
            JOIN static_status s ON i.item_status_id = s.status_id
            ORDER BY i.inventory_id ASC;
        """)
        rows = cur.fetchall()

        cur.execute("""
            SELECT ib.inventory_id, b.brand_id, b.brand_name,
                   ib.item_sku, ib.item_unit_price, ib.item_selling_price,
                   ib.item_qty, ib.item_description
            FROM inventory_brands ib
            JOIN brand b ON ib.brand_id = b.brand_id
            ORDER BY ib.inventory_id, b.brand_name
        """)
        brand_rows = cur.fetchall()

        cur.execute("""
            SELECT ins.inventory_id, s.supplier_id, s.supplier_name,
                   s.contact_person, s.supplier_contact
            FROM inventory_supplier ins
            JOIN supplier s ON ins.supplier_id = s.supplier_id
            ORDER BY ins.inventory_id
        """)
        supplier_rows = cur.fetchall()

    except Exception as e:
        print("Inventory GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

    brands_map = {}
    for br in brand_rows:
        inv_id = str(br[0])
        brands_map.setdefault(inv_id, []).append({
            "brand_id": br[1],
            "brand_name": br[2],
            "sku": br[3] or "—",
            "unit_price": float(br[4] or 0),
            "selling_price": float(br[5] or 0),
            "qty": int(br[6] or 0),
            "description": br[7] or "",
        })

    suppliers_map = {}
    for sr in supplier_rows:
        inv_id = str(sr[0])
        suppliers_map.setdefault(inv_id, []).append({
            "supplier_id": sr[1],
            "supplier_name": sr[2],
            "contact_person": sr[3] or "",
            "contact_number": sr[4] or "",
        })

    result = []
    for r in rows:
        inv_id = str(r[0])
        status_id = r[6]
        is_arch = (status_id == 4)
        result.append({
            "id": inv_id,
            "item_name": r[1],
            "item_description": r[2],
            "qty": int(r[3] or 0),
            "uom": r[4] or "—",
            "status": r[5] or "Unknown",
            "is_archived": is_arch,
            "brands": brands_map.get(inv_id, []),
            "suppliers": suppliers_map.get(inv_id, []),
        })

    return jsonify(result)

# ===================== TOGGLE ARCHIVE =====================
@inventory_bp.route("/api/inventory/archive/<string:inventory_id>", methods=["PUT", "OPTIONS"])
def toggle_inventory_archive(inventory_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT ss.status_code, i.total_quantity
            FROM inventory i
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE i.inventory_id = %s
        """, (inventory_id,))

        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Item not found in DB."}), 404

        current_status = row[0]
        qty = int(row[1] or 0)

        if current_status == 'INACTIVE':
            target_code = 'AVAILABLE' if qty > 0 else 'OUT_OF_STOCK'
            cur.execute("SELECT status_id, status_name FROM static_status WHERE status_scope = 'INVENTORY_STATUS' AND status_code = %s", (target_code,))
            res = cur.fetchone()
            new_status_id = res[0]
            new_status_name = res[1]
            is_archived = False
            action_msg = "Restored from Archive"
        else:
            cur.execute("SELECT status_id, status_name FROM static_status WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'INACTIVE'")
            res = cur.fetchone()
            new_status_id = res[0]
            new_status_name = res[1]
            is_archived = True
            action_msg = "Moved to Archive"

        cur.execute("SET LOCAL session_replication_role = 'replica';")
        cur.execute("UPDATE inventory SET item_status_id = %s WHERE inventory_id = %s", (new_status_id, inventory_id))

        if cur.rowcount == 0:
            raise Exception("Database blocked the update! Check Supabase RLS policies.")

        conn.commit()
        return jsonify({
            "message": action_msg,
            "is_archived": is_archived,
            "new_status": new_status_name
        }), 200

    except Exception as e:
        conn.rollback()
        print("Error archiving:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= ADD INVENTORY (New Schema) =================
@inventory_bp.route("/api/inventory/add", methods=["POST"])
def add_inventory_batch():
    conn = get_connection()
    cur = conn.cursor()
    try:
        items = request.get_json()
        if not items or not isinstance(items, list):
            return jsonify({"error": "Invalid data format."}), 400

        for item in items:
            item_name = item.get('itemName', '').strip()
            if not item_name:
                raise Exception("Item name is required.")

            # Resolve suppliers by name
            suppliers = item.get('suppliers', [])
            resolved_suppliers = []
            for sup in suppliers:
                sname = sup.get('supplierName', '').strip()
                if not sname:
                    continue
                cur.execute("SELECT supplier_id FROM supplier WHERE supplier_name = %s", (sname,))
                s_res = cur.fetchone()
                if not s_res:
                    raise Exception(f"Supplier '{sname}' not found.")
                resolved_suppliers.append({
                    "supplier_id": s_res[0],
                    "leadTime": int(sup.get('leadTime') or 0),
                    "minOrder": int(sup.get('minOrder') or 0),
                })

            # Insert master inventory record
            cur.execute("""
                INSERT INTO public.inventory (item_name, item_status_id)
                VALUES (%s, 1)
                RETURNING inventory_id
            """, (item_name,))
            new_inventory_id = cur.fetchone()[0]

            # Link suppliers
            for sup in resolved_suppliers:
                cur.execute("""
                    INSERT INTO public.inventory_supplier (inventory_id, supplier_id)
                    VALUES (%s, %s)
                """, (new_inventory_id, sup['supplier_id']))

            # Insert brand variants (UOM and description are per-brand)
            brand_variants = item.get('brands', [])
            if not brand_variants:
                raise Exception(f"At least one brand variant is required for '{item_name}'.")

            first_reorder_point = 0
            for idx, bv in enumerate(brand_variants):
                # Resolve brand by id or name
                brand_id = bv.get('brand_id')
                if not brand_id:
                    brand_name = (bv.get('brand_name') or 'No Brand').strip()
                    cur.execute("SELECT brand_id FROM brand WHERE brand_name = %s", (brand_name,))
                    b_res = cur.fetchone()
                    if b_res:
                        brand_id = b_res[0]
                    else:
                        cur.execute(
                            "INSERT INTO brand (brand_name, brand_code) VALUES (%s, %s) RETURNING brand_id",
                            (brand_name, brand_name.upper()[:20])
                        )
                        brand_id = cur.fetchone()[0]

                # Per-brand UOM
                uom_code = bv.get('uom')
                if not uom_code or uom_code == 'Select':
                    raise Exception(f"UOM missing for a brand variant of '{item_name}'")
                cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_code = %s", (uom_code,))
                uom_res = cur.fetchone()
                if not uom_res:
                    raise Exception(f"UOM '{uom_code}' not found.")
                uom_id = uom_res[0]

                item_description = bv.get('itemDescription') or ''
                if idx == 0:
                    first_reorder_point = int(bv.get('reorderPoint', 0))

                cur.execute("""
                    INSERT INTO public.inventory_brands
                        (inventory_id, brand_id, item_sku, item_unit_price, item_selling_price,
                         item_qty, unit_of_measure, item_description, item_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)
                """, (
                    new_inventory_id, brand_id,
                    bv.get('sku') or None,
                    float(bv.get('unit_price', 0)),
                    float(bv.get('selling_price', 0)),
                    int(bv.get('qty', 0)),
                    uom_id,
                    item_description,
                ))

            # Insert inventory_action (reorder point from first brand)
            primary = resolved_suppliers[0] if resolved_suppliers else {}
            cur.execute("""
                INSERT INTO public.inventory_action (inventory_id, suggestion_date, stockout_predict, lead_time_days, min_order_qty, reorder_qty)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                new_inventory_id, datetime.now(), False,
                primary.get('leadTime', 0),
                primary.get('minOrder', 0),
                first_reorder_point,
            ))

        conn.commit()
        return jsonify({"message": f"Successfully saved {len(items)} item(s)"}), 201

    except Exception as e:
        conn.rollback()
        print("Batch Save Error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= GET SINGLE INVENTORY ITEM =================
@inventory_bp.route("/api/inventory/<string:id>", methods=["GET"])
def get_inventory_item(id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                i.inventory_id, i.item_name,
                COALESCE(
                    (SELECT ib2.item_description FROM inventory_brands ib2
                     WHERE ib2.inventory_id = i.inventory_id LIMIT 1),
                    ''
                ) AS item_description,
                COALESCE(
                    (SELECT u2.uom_code FROM inventory_brands ib2
                     JOIN unit_of_measure u2 ON ib2.unit_of_measure = u2.uom_id
                     WHERE ib2.inventory_id = i.inventory_id LIMIT 1),
                    'Select'
                ) AS uom,
                ia.lead_time_days, ia.min_order_qty, ia.reorder_qty
            FROM inventory i
            LEFT JOIN inventory_action ia ON i.inventory_id = ia.inventory_id
            WHERE i.inventory_id = %s
        """, (id,))
        r = cur.fetchone()
        if not r:
            return jsonify({"error": "Item not found"}), 404

        cur.execute("""
            SELECT b.brand_id, b.brand_name, ib.item_sku, ib.item_unit_price,
                   ib.item_selling_price, ib.item_qty, ib.item_description
            FROM inventory_brands ib
            JOIN brand b ON ib.brand_id = b.brand_id
            WHERE ib.inventory_id = %s
            ORDER BY b.brand_name
        """, (id,))
        brands_list = [
            {
                "brand_id": row[0],
                "brand_name": row[1],
                "sku": row[2] or "",
                "unit_price": float(row[3] or 0),
                "selling_price": float(row[4] or 0),
                "qty": int(row[5] or 0),
                "description": row[6] or "",
            }
            for row in cur.fetchall()
        ]

        cur.execute("""
            SELECT s.supplier_id, s.supplier_name, s.contact_person, s.supplier_contact
            FROM inventory_supplier ins
            JOIN supplier s ON s.supplier_id = ins.supplier_id
            WHERE ins.inventory_id = %s
        """, (id,))
        suppliers_list = [
            {
                "supplier_id": row[0],
                "supplier_name": row[1] or "",
                "contact_person": row[2] or "",
                "contact_number": row[3] or "",
                "isPrimary": idx == 0,
            }
            for idx, row in enumerate(cur.fetchall())
        ]

        return jsonify({
            "id": r[0],
            "itemName": r[1],
            "itemDescription": r[2],
            "uom": r[3] or "Select",
            "leadTime": r[4] or 0,
            "minOrder": r[5] or 0,
            "reorderPoint": r[6] or 0,
            "brands": brands_list,
            "suppliers": suppliers_list,
        })

    except Exception as e:
        print("Inventory item GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= UPDATE INVENTORY ITEM =================
@inventory_bp.route("/api/inventory/update/<string:id>", methods=["PUT"])
def update_inventory_item(id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()

        suppliers = data.get('suppliers', [])
        resolved_suppliers = []
        for sup in suppliers:
            sname = sup.get('supplierName', '').strip()
            if not sname:
                continue
            cur.execute("SELECT supplier_id FROM supplier WHERE supplier_name = %s", (sname,))
            s_res = cur.fetchone()
            if not s_res:
                return jsonify({"error": f"Supplier '{sname}' not found"}), 400
            resolved_suppliers.append({
                "supplier_id": s_res[0],
                "leadTime": int(sup.get('leadTime') or 0),
                "minOrder": int(sup.get('minOrder') or 0),
            })

        # Only item_name lives on inventory; description/uom are on inventory_brands
        cur.execute("""
            UPDATE public.inventory
            SET item_name = %s
            WHERE inventory_id = %s
        """, (data.get('itemName'), id))

        cur.execute("DELETE FROM public.inventory_supplier WHERE inventory_id = %s", (id,))
        for sup in resolved_suppliers:
            cur.execute("""
                INSERT INTO public.inventory_supplier (inventory_id, supplier_id)
                VALUES (%s, %s)
            """, (id, sup['supplier_id']))

        cur.execute("DELETE FROM public.inventory_brands WHERE inventory_id = %s", (id,))
        first_reorder_point = 0
        for idx, bv in enumerate(data.get('brands', [])):
            # Resolve brand by id or name
            brand_id = bv.get('brand_id')
            if not brand_id:
                brand_name = (bv.get('brand_name') or 'No Brand').strip()
                cur.execute("SELECT brand_id FROM brand WHERE brand_name = %s", (brand_name,))
                b_res = cur.fetchone()
                if b_res:
                    brand_id = b_res[0]
                else:
                    cur.execute(
                        "INSERT INTO brand (brand_name, brand_code) VALUES (%s, %s) RETURNING brand_id",
                        (brand_name, brand_name.upper()[:20])
                    )
                    brand_id = cur.fetchone()[0]

            # Per-brand UOM
            uom_code = bv.get('uom')
            if not uom_code or uom_code == 'Select':
                return jsonify({"error": "UOM is required for each brand variant"}), 400
            cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_code = %s", (uom_code,))
            uom_res = cur.fetchone()
            if not uom_res:
                return jsonify({"error": f"UOM '{uom_code}' not found"}), 400
            uom_id = uom_res[0]

            item_description = bv.get('itemDescription') or ''
            if idx == 0:
                first_reorder_point = int(bv.get('reorderPoint', 0))

            cur.execute("""
                INSERT INTO public.inventory_brands
                    (inventory_id, brand_id, item_sku, item_unit_price, item_selling_price,
                     item_qty, unit_of_measure, item_description, item_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)
            """, (
                id, brand_id,
                bv.get('sku') or None,
                float(bv.get('unit_price', 0)),
                float(bv.get('selling_price', 0)),
                int(bv.get('qty', 0)),
                uom_id,
                item_description,
            ))

        primary = resolved_suppliers[0] if resolved_suppliers else {}
        lead_time = primary.get('leadTime', 0)
        min_order = primary.get('minOrder', 0)
        reorder_point = first_reorder_point

        cur.execute("""
            UPDATE public.inventory_action
            SET lead_time_days = %s, min_order_qty = %s, reorder_qty = %s
            WHERE inventory_id = %s
        """, (lead_time, min_order, reorder_point, id))
        if cur.rowcount == 0:
            cur.execute("""
                INSERT INTO public.inventory_action (inventory_id, suggestion_date, stockout_predict, lead_time_days, min_order_qty, reorder_qty)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (id, datetime.now(), False, lead_time, min_order, reorder_point))

        conn.commit()
        return jsonify({"message": "Item updated successfully"}), 200

    except Exception as e:
        conn.rollback()
        print("Update Error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= GET UOMs =================
@inventory_bp.route("/api/uom", methods=["GET"])
def get_uoms():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT uom_id, uom_code, uom_name, low_stock_threshold
            FROM unit_of_measure
            WHERE is_active = true
            ORDER BY uom_name ASC
        """)
        rows = cur.fetchall()
        return jsonify([{"id": r[0], "code": r[1], "name": r[2], "low_stock_threshold": r[3]} for r in rows])
    except Exception as e:
        print("UOM GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= ADD UOM =================
@inventory_bp.route("/api/uom", methods=["POST"])
def add_uom():
    data = request.get_json()
    uom_name = (data.get("uom_name") or "").strip()
    if not uom_name:
        return jsonify({"error": "UOM name is required"}), 400
    uom_code = uom_name.upper().replace(" ", "_")
    low_stock_threshold = data.get("low_stock_threshold")
    if low_stock_threshold is not None:
        try:
            low_stock_threshold = int(low_stock_threshold)
        except (ValueError, TypeError):
            low_stock_threshold = None

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT uom_id FROM unit_of_measure WHERE uom_code = %s",
            (uom_code,)
        )
        if cur.fetchone():
            return jsonify({"error": f"UOM '{uom_name}' already exists"}), 409
        cur.execute("""
            INSERT INTO unit_of_measure (uom_name, uom_code, is_active, low_stock_threshold)
            VALUES (%s, %s, true, %s)
            RETURNING uom_id
        """, (uom_name, uom_code, low_stock_threshold))
        new_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": new_id, "code": uom_code, "name": uom_name, "low_stock_threshold": low_stock_threshold}), 201
    except Exception as e:
        conn.rollback()
        print("UOM POST error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= UPDATE UOM =================
@inventory_bp.route("/api/uom/<int:uom_id>", methods=["PUT"])
def update_uom(uom_id):
    data = request.get_json()
    conn = get_connection()
    cur = conn.cursor()
    try:
        updates = []
        values = []
        if "uom_name" in data:
            uom_name = (data["uom_name"] or "").strip()
            if not uom_name:
                return jsonify({"error": "UOM name cannot be empty"}), 400
            updates.append("uom_name = %s")
            values.append(uom_name)
            updates.append("uom_code = %s")
            values.append(uom_name.upper().replace(" ", "_"))
        if "low_stock_threshold" in data:
            lsq = data["low_stock_threshold"]
            updates.append("low_stock_threshold = %s")
            values.append(int(lsq) if lsq is not None else None)
        if not updates:
            return jsonify({"error": "Nothing to update"}), 400
        values.append(uom_id)
        cur.execute(
            f"UPDATE unit_of_measure SET {', '.join(updates)} WHERE uom_id = %s RETURNING uom_id, uom_code, uom_name, low_stock_threshold",
            values
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "UOM not found"}), 404
        conn.commit()
        return jsonify({"id": row[0], "code": row[1], "name": row[2], "low_stock_threshold": row[3]})
    except Exception as e:
        conn.rollback()
        print("UOM PUT error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= INVENTORY SUMMARY =================
@inventory_bp.route("/api/inventory/summary", methods=["GET"])
def get_inventory_summary():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                COALESCE(SUM(od.order_quantity) FILTER (WHERE ot.order_date >= NOW() - INTERVAL '7 days'), 0) AS weekly_count,
                COALESCE(SUM(od.order_quantity) FILTER (WHERE ot.order_date >= NOW() - INTERVAL '30 days'), 0) AS monthly_count,
                COALESCE(SUM(od.order_quantity) FILTER (WHERE ot.order_date >= NOW() - INTERVAL '1 year'), 0) AS yearly_count
            FROM order_details od
            JOIN order_transaction ot ON od.order_id = ot.order_id
        """)
        row = cur.fetchone()
        return jsonify({"weekly": row[0], "monthly": row[1], "yearly": row[2]})
    except Exception as e:
        print("Error fetching inventory summary:", e)
        return jsonify({"weekly": 0, "monthly": 0, "yearly": 0}), 200
    finally:
        cur.close()
        conn.close()
