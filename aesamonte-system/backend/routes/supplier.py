from flask import Blueprint, jsonify
from database.db_config import get_connection

supplier_bp = Blueprint("supplier", __name__, url_prefix="/api/suppliers")

# ===================== LIST SUPPLIERS =====================
@supplier_bp.route("", methods=["GET"])
def get_suppliers():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            supplier_id,
            supplier_name,
            contact_person,
            supplier_contact,
            supplier_email,
            supplier_address
        FROM supplier
        ORDER BY supplier_id DESC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    suppliers = []
    for r in rows:
        suppliers.append({
            "id": r[0],
            "supplierName": r[1],
            "contactPerson": r[2],
            "contactNumber": r[3],
            "email": r[4],
            "address": r[5]
        })

    return jsonify(suppliers)
