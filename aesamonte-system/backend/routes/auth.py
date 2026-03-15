# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor
import jwt
import datetime
import os

auth_bp = Blueprint('auth', __name__)

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "aesamonte_rbac_secret_2025")

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    employee_id = int(data.get('employee_id'))
    password = data.get('password')

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
            SELECT e.employee_id, e.role_id, r.role_name,
                   r.sales_permissions, r.inventory_permissions, r.order_permissions,
                   r.supplier_permissions, r.reports_permissions, r.settings_permissions
            FROM employee e
            JOIN employee_role r ON e.role_id = r.role_id
            WHERE e.employee_id = %s
              AND e.employee_password = crypt(%s, e.employee_password)
        """, (employee_id, password))

        user = cur.fetchone()

        if user:
            permissions = {
                "sales":     user['sales_permissions'],
                "inventory": user['inventory_permissions'],
                "orders":    user['order_permissions'],
                "suppliers": user['supplier_permissions'],
                "reports":   user['reports_permissions'],
                "settings":  user['settings_permissions'],
            }

            payload = {
                "employee_id": user['employee_id'],
                "role_id":     user['role_id'],
                "role_name":   user['role_name'],
                "permissions": permissions,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
            }

            token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

            return jsonify({
                "status":      "success",
                "token":       token,
                "role":        user['role_name'],
                "employee_id": user['employee_id'],
                "permissions": permissions,
            }), 200

        return jsonify({"status": "error", "message": "Invalid credentials"}), 401

    finally:
        cur.close()
        conn.close()


@auth_bp.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.json
    employee_id = data.get('employeeId')
    contact = data.get('contact')
    method = data.get('method')

    # TODO: integrate SMS/email provider
    return jsonify({"status": "success", "message": f"OTP sent via {method}"}), 200


@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    otp = data.get('otp')
    employee_id = data.get('employeeId')
    method = data.get('method')

    # TODO: verify OTP against stored value
    return jsonify({"status": "success", "message": "OTP verified"}), 200
