from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor
import jwt
import datetime
import os
import random
import time
import bcrypt
import requests as http_requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

auth_bp = Blueprint('auth', __name__)

SECRET_KEY        = os.environ.get("JWT_SECRET_KEY", "aesamonte_rbac_secret_2025")
SEMAPHORE_API_KEY = os.environ.get("SEMAPHORE_API_KEY", "")
SEMAPHORE_SENDER  = os.environ.get("SEMAPHORE_SENDER_NAME", "AESAMONTE")
GMAIL_USER        = os.environ.get("GMAIL_USER", "")
GMAIL_PASSWORD    = os.environ.get("GMAIL_APP_PASSWORD", "")

_otp_store: dict = {}

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
        "role_id":           user['role_id'],
        "employee_id":       user['employee_id'],
        "employee_name":     user['employee_name'],
        "employee_username": user['employee_username'],
        "permissions":       permissions,
    }


@auth_bp.route('/profile', methods=['GET', 'PATCH'])
def profile():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    token = auth_header.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return jsonify({"status": "error", "message": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"status": "error", "message": "Invalid token"}), 401

    employee_id = payload.get('employee_id')

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if request.method == 'GET':
            cur.execute(
                "SELECT employee_name, employee_email, employee_contact FROM employee WHERE employee_id = %s",
                (employee_id,)
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"status": "error", "message": "Employee not found"}), 404
            return jsonify({
                "name":    row['employee_name'],
                "email":   row['employee_email'],
                "contact": row['employee_contact'],
            }), 200

        data    = request.json or {}
        contact = data.get('contact')
        if contact is not None:
            cur.execute(
                "UPDATE employee SET employee_contact = %s WHERE employee_id = %s",
                (contact, employee_id)
            )
            conn.commit()
        return jsonify({"status": "success"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()


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
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    token = auth_header.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return jsonify({"status": "error", "message": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"status": "error", "message": "Invalid token"}), 401

    data             = request.json or {}
    employee_id      = data.get('employeeId')
    current_password = data.get('currentPassword', '')
    new_password     = data.get('newPassword', '')

    if not employee_id or not current_password or not new_password:
        return jsonify({"status": "error", "message": "All fields are required."}), 400

    if int(employee_id) != int(payload.get('employee_id', -1)):
        return jsonify({"status": "error", "message": "You can only change your own password."}), 403

    if len(new_password) < 8:
        return jsonify({"status": "error", "message": "New password must be at least 8 characters."}), 400
    if new_password == current_password:
        return jsonify({"status": "error", "message": "New password must be different from the current password."}), 400

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


@auth_bp.route('/send-otp', methods=['POST'])
def send_otp():
    data     = request.json or {}
    username = (data.get('username') or '').strip().lower()
    contact  = (data.get('contact') or '').strip()
    method   = data.get('method')

    if not username or not contact:
        return jsonify({"status": "error", "message": "Username and email address are required."}), 400

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if method == 'sms':
            cur.execute(
                "SELECT employee_id, employee_contact FROM employee WHERE employee_username ILIKE %s",
                (username,)
            )
            employee = cur.fetchone()
            if not employee:
                return jsonify({"status": "error", "message": "Username not found."}), 404

            def normalize(num):
                return ''.join(filter(str.isdigit, num or ''))[-10:]

            if normalize(employee['employee_contact']) != normalize(contact):
                return jsonify({"status": "error", "message": "Contact number does not match our records."}), 400

            otp_code = str(random.randint(100000, 999999))
            _otp_store[username] = {"otp": otp_code, "expires_at": time.time() + 120}

            digits = ''.join(filter(str.isdigit, contact))
            if digits.startswith('0'):
                digits = '63' + digits[1:]
            if not digits.startswith('63'):
                digits = '63' + digits

            try:
                resp = http_requests.post(
                    "https://api.semaphore.co/api/v4/messages",
                    data={
                        "apikey":      SEMAPHORE_API_KEY,
                        "number":      digits,
                        "message":     f"Your AE Samonte verification code is: {otp_code}. It expires in 2 minutes.",
                        "sendername":  SEMAPHORE_SENDER,
                    },
                    timeout=10,
                )
                if resp.status_code not in (200, 201):
                    error_msg = resp.json()[0].get("message", "Unknown error") if resp.json() else "Unknown error"
                    return jsonify({"status": "error", "message": f"Failed to send SMS: {error_msg}"}), 500
            except Exception as e:
                return jsonify({"status": "error", "message": f"Failed to send SMS: {str(e)}"}), 500

            return jsonify({"status": "success", "message": "OTP sent via SMS."}), 200

        if method == 'email':
            cur.execute(
                "SELECT employee_id, employee_email FROM employee WHERE employee_username ILIKE %s",
                (username,)
            )
            employee = cur.fetchone()
            if not employee:
                return jsonify({"status": "error", "message": "Username not found."}), 404

            if (employee['employee_email'] or '').strip().lower() != contact.lower():
                return jsonify({"status": "error", "message": "Email address does not match our records."}), 400

            otp_code = str(random.randint(100000, 999999))
            _otp_store[username] = {"otp": otp_code, "expires_at": time.time() + 120}

            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "AE Samonte – Your Verification Code"
                msg["From"]    = GMAIL_USER
                msg["To"]      = contact
                html_body = f"""
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e0e0e0;border-radius:8px;">
                  <h2 style="color:#b91c1c;">AE Samonte System</h2>
                  <p>Your one-time verification code is:</p>
                  <h1 style="letter-spacing:8px;color:#111;">{otp_code}</h1>
                  <p style="color:#666;">This code expires in <strong>2 minutes</strong>. Do not share it with anyone.</p>
                </div>
                """
                msg.attach(MIMEText(html_body, "html"))
                with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                    server.login(GMAIL_USER, GMAIL_PASSWORD)
                    server.sendmail(GMAIL_USER, contact, msg.as_string())
            except Exception as e:
                return jsonify({"status": "error", "message": f"Failed to send email: {str(e)}"}), 500

            return jsonify({"status": "success", "message": "OTP sent via email."}), 200

        return jsonify({"status": "error", "message": "Unsupported method."}), 400

    finally:
        cur.close()
        conn.close()


@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data      = request.json or {}
    username  = (data.get('username') or '').strip().lower()
    otp_input = (data.get('otp') or '').strip()
    method    = data.get('method')

    if method in ('sms', 'email'):
        record = _otp_store.get(username)
        if not record:
            return jsonify({"status": "error", "message": "No OTP was sent to this account."}), 400
        if time.time() > record['expires_at']:
            _otp_store.pop(username, None)
            return jsonify({"status": "error", "message": "OTP has expired. Please request a new one."}), 400
        if otp_input != record['otp']:
            return jsonify({"status": "error", "message": "Invalid OTP. Please try again."}), 400

        _otp_store.pop(username, None)
        return jsonify({"status": "success", "message": "OTP verified."}), 200

    return jsonify({"status": "error", "message": "Unsupported method."}), 400


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data     = request.json or {}
    username = (data.get('username') or '').strip()
    email    = (data.get('email') or '').strip()

    if not username or not email:
        return jsonify({"status": "error", "message": "Missing required fields."}), 400

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT employee_id, employee_email FROM employee WHERE employee_username ILIKE %s",
            (username,)
        )
        employee = cur.fetchone()
        if not employee:
            return jsonify({"status": "error", "message": "Username not found."}), 404

        import string
        chars        = string.ascii_letters + string.digits + "!@#$%"
        temp_password = ''.join(random.choices(chars, k=10))

        hashed = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(
            "UPDATE employee SET employee_password = %s WHERE employee_id = %s",
            (hashed, employee['employee_id'])
        )
        conn.commit()

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "AE Samonte – Your Temporary Password"
            msg["From"]    = GMAIL_USER
            msg["To"]      = email
            html_body = f"""
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e0e0e0;border-radius:8px;">
              <h2 style="color:#b91c1c;">AE Samonte System</h2>
              <p>Your password has been reset. Use the temporary password below to log in:</p>
              <h2 style="letter-spacing:4px;color:#111;background:#f5f5f5;padding:12px;border-radius:6px;">{temp_password}</h2>
              <p style="color:#666;">Please change your password immediately after logging in.</p>
              <p style="color:#999;font-size:12px;">If you did not request this, please contact your administrator.</p>
            </div>
            """
            msg.attach(MIMEText(html_body, "html"))
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(GMAIL_USER, GMAIL_PASSWORD)
                server.sendmail(GMAIL_USER, email, msg.as_string())
        except Exception as e:
            return jsonify({"status": "error", "message": f"Password reset but failed to send email: {str(e)}"}), 500

        return jsonify({"status": "success", "message": "Temporary password sent to your email."}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()
