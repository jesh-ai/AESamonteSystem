from flask import Blueprint, jsonify
from database.db_config import get_connection
from flask import request, jsonify

supplier_bp = Blueprint("supplier", __name__, url_prefix="/api/suppliers")

# ===================== LIST SUPPLIERS =====================
@supplier_bp.route("", methods=["GET"])
def get_suppliers():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            s.supplier_id,
            s.supplier_name,
            s.contact_person,
            s.supplier_contact,
            s.supplier_email,
            s.supplier_address,
            st.status_name AS supplier_status
        FROM supplier s
        LEFT JOIN static_status st 
            ON s.supplier_status_id = st.status_id
        WHERE st.status_scope = 'SUPPLIER_STATUS'
        ORDER BY s.supplier_id DESC
    """)


    rows = cur.fetchall()
    cur.close()
    conn.close()

    suppliers = [
        {
            "id": r[0],
            "supplierName": r[1],
            "contactPerson": r[2],
            "contactNumber": r[3],
            "email": r[4],
            "address": r[5],
            "status": r[6] 
        }
        for r in rows
    ]

    return jsonify(suppliers)