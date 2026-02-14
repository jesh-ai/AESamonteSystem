from flask import Blueprint, jsonify
from database.db_config import get_connection
from flask import request

inventory_bp = Blueprint("inventory", __name__)

@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            i.inventory_id,
            i.inventory_item_name,
            i.brand,
            i.item_quantity,
            u.status_name AS uom,
            s.status_name AS item_status,
            i.item_unit_price,
            i.item_selling_price
        FROM inventory i
        LEFT JOIN status_like u ON i.unit_of_measure = u.status_id
        LEFT JOIN status_like s ON i.item_status_id = s.status_id
        ORDER BY i.inventory_id ASC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    for r in rows:
        stock_qty = r[3]  # physical stock
        status_name = r[5]  # item status

        # Determine display status
        if stock_qty <= 0:
            display_status = f"Out of Stock"
        else:
            display_status = f"Available"

        # Optional: mark items as low stock if below reorder point
        # display_status = display_status if stock_qty > 5 else f"Low Stock: {r[1]} ({stock_qty})"

        result.append({
            "id": str(r[0]),
            "item": r[1],
            "brand": r[2],
            "qty": stock_qty,
            "uom": r[4],
            "status": display_status,
            "unitPrice": float(r[6]),
            "price": float(r[7]),
        })

    return jsonify(result)