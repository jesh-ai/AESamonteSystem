# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor
import jwt
import datetime
import os
import bcrypt

auth_bp = Blueprint('auth', __name__)

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "aesamonte_rbac_secret_2025")


def _build_permissions(role: dict) -> dict:
    """Map employee_role boolean columns to per-module permission objects."""
    export = bool(role.get('export_permissions'))

    def m(flag: bool) -> dict:
        v = bool(flag)
        return {
            "can_view":    v,
            "can_create":  v,
            "can_edit":    v,
            "can_archive": v,
            "can_export":  export,
        }

    return {
        "dashboard": m(role.get('dashboard_permissions')),
        "sales":     m(role.get('sales_permissions')),
        "inventory": m(role.get('inventory_permissions')),
        "orders":    m(role.get('order_permissions')),
        "supplier":  m(role.get('supplier_permissions')),
        "reports":   m(role.get('reports_permissions')),
        "settings":  m(role.get('settings_permissions')),
    }


def _build_token_response(user: dict) -> dict:
    permissions = _build_permissions(user)
    payload = {
        "employee_id":       user['employee_id'],
        "employee_username": user['employee_username'],
        "role_id":           user['role_id'],
        "role_name":         user['role_name'],
        "employee_name":     user['employee_name'],
        "permissions":       permissions,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return {
        "status":            "success",
        "token":             token,
        "role":              user['role_name'],
        "employee_id":       user['employee_id'],
        "employee_name":     user['employee_name'],
        "employee_username": user['employee_username'],
        "permissions":       permissions,
    }


@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.json or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '')

    if not username or not password:
        return jsonify({"status": "error", "message": "Username and password are required."}), 400

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT e.employee_id, e.role_id, e.employee_name, e.employee_username,
                   e.employee_password,
                   r.role_name,
                   r.dashboard_permissions, r.export_permissions,
                   r.sales_permissions, r.inventory_permissions, r.order_permissions,
                   r.supplier_permissions, r.reports_permissions, r.settings_permissions,
                   s.status_code
            FROM employee e
            JOIN employee_role  r ON e.role_id          = r.role_id
            JOIN static_status  s ON e.employee_status_id = s.status_id
            WHERE e.employee_username ILIKE %s
        """, (username,))

        user = cur.fetchone()

        if not user:
            return jsonify({"status": "error", "message": "Invalid credentials."}), 401

        if user['status_code'] != 'ACTIVE':
            return jsonify({
                "status":  "error",
                "message": "Account is inactive. Please contact an administrator.",
            }), 403

        if not bcrypt.checkpw(password.encode('utf-8'), user['employee_password'].encode('utf-8')):
            return jsonify({"status": "error", "message": "Invalid credentials."}), 401

        return jsonify(_build_token_response(user)), 200

    finally:
        cur.close()
        conn.close()


@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    data             = request.json or {}
    employee_id      = data.get('employeeId')
    current_password = data.get('currentPassword', '')
    new_password     = data.get('newPassword', '')

    if not employee_id or not current_password or not new_password:
        return jsonify({"status": "error", "message": "All fields are required."}), 400
    if len(new_password) < 8:
        return jsonify({"status": "error", "message": "New password must be at least 8 characters."}), 400

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT employee_password FROM employee WHERE employee_id = %s", (employee_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Employee not found."}), 404
        if not bcrypt.checkpw(current_password.encode('utf-8'), row['employee_password'].encode('utf-8')):
            return jsonify({"status": "error", "message": "Current password is incorrect."}), 400

        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(
            "UPDATE employee SET employee_password = %s WHERE employee_id = %s",
            (hashed, employee_id),
        )
        conn.commit()
        return jsonify({"status": "success", "message": "Password changed successfully."}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()
