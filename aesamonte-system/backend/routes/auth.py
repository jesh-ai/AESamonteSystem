# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor
import jwt
import datetime
import os
import random
import bcrypt
import time
import requests as http_requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

auth_bp = Blueprint('auth', __name__)

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "aesamonte_rbac_secret_2025")

SEMAPHORE_API_KEY = os.environ.get("SEMAPHORE_API_KEY", "")
SEMAPHORE_SENDER  = os.environ.get("SEMAPHORE_SENDER_NAME", "AESAMONTE")

GMAIL_USER     = os.environ.get("GMAIL_USER", "")
GMAIL_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")

# In-memory OTP store: { employee_id: { "otp": "123456", "expires_at": <timestamp> } }
_otp_store: dict = {}


def _build_trust_token(employee_id: int) -> str:
    """7-day device trust token — lets user skip 2FA OTP on this browser."""
    payload = {
        "employee_id": employee_id,
        "type":        "2fa_trust",
        "exp":         datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def _verify_trust_token(token: str, employee_id: int) -> bool:
    """Returns True if the trust token is valid and belongs to this employee."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("type") == "2fa_trust" and payload.get("employee_id") == employee_id
    except Exception:
        return False


def _build_token_response(user: dict) -> dict:
    """Build the standard login success payload from an employee+role row."""
    permissions = {
        "sales":     user['sales_permissions'],
        "inventory": user['inventory_permissions'],
        "orders":    user['order_permissions'],
        "suppliers": user['supplier_permissions'],
        "reports":   user['reports_permissions'],
        "settings":  user['settings_permissions'],
    }
    payload = {
        "employee_id":   user['employee_id'],
        "role_id":       user['role_id'],
        "role_name":     user['role_name'],  
        "employee_name": user.get('employee_name', ''),
        "permissions":   permissions,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return {
        "status":        "success",
        "token":         token,
        "role":          user['role_name'],  
        "employee_name": user.get('employee_name', ''),
        "employee_id":   user['employee_id'],
        "permissions":   permissions,
    }


def _send_2fa_email(to_email: str, otp_code: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "AE Samonte – 2FA Verification Code"
    msg["From"]    = GMAIL_USER
    msg["To"]      = to_email
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;
                border:1px solid #e0e0e0;border-radius:8px;">
      <h2 style="color:#1a4263;">AE Samonte System</h2>
      <p>Your two-factor authentication code is:</p>
      <h1 style="letter-spacing:8px;color:#111;background:#f5f5f5;
                 padding:12px;border-radius:6px;">{otp_code}</h1>
      <p style="color:#666;">This code expires in <strong>2 minutes</strong>.
         Do not share it with anyone.</p>
    </div>
    """
    msg.attach(MIMEText(html_body, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_PASSWORD)
        server.sendmail(GMAIL_USER, to_email, msg.as_string())


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
                   e.employee_name, e.employee_password, e.two_fa_enabled,
                   e.employee_email, e.employee_contact,
                   r.sales_permissions, r.inventory_permissions, r.order_permissions,
                   r.supplier_permissions, r.reports_permissions, r.settings_permissions
            FROM employee e
            JOIN employee_role r ON e.role_id = r.role_id
            WHERE e.employee_id = %s
        """, (employee_id,))

        user = cur.fetchone()

        if not (user and bcrypt.checkpw(password.encode("utf-8"), user['employee_password'].encode("utf-8"))):
            return jsonify({"status": "error", "message": "Invalid credentials"}), 401

        # ── 2FA path ──
        if user.get('two_fa_enabled'):
            device_trust_token = (data.get('device_trust_token') or '').strip()
            if device_trust_token and _verify_trust_token(device_trust_token, employee_id):
                return jsonify(_build_token_response(user)), 200

            email = (user.get('employee_email') or '').strip()
            if not email:
                return jsonify({"status": "error", "message": "No email on file for 2FA."}), 400

            otp_code = str(random.randint(100000, 999999))
            _otp_store[str(employee_id)] = {"otp": otp_code, "expires_at": time.time() + 120}

            try:
                _send_2fa_email(email, otp_code)
            except Exception as e:
                return jsonify({"status": "error", "message": f"Failed to send 2FA code: {str(e)}"}), 500

            masked = email[:2] + '***@' + email.split('@')[1] if '@' in email else email
            return jsonify({"status": "otp_required", "employee_id": user['employee_id'], "contact": masked}), 200

        # ── Normal path ──
        return jsonify(_build_token_response(user)), 200

    finally:
        cur.close()
        conn.close()


@auth_bp.route('/complete-2fa-login', methods=['POST'])
def complete_2fa_login():
    data = request.json or {}
    employee_id = data.get('employee_id')
    otp_input   = data.get('otp', '').strip()

    if not employee_id or not otp_input:
        return jsonify({"status": "error", "message": "Missing required fields."}), 400

    record = _otp_store.get(str(employee_id))
    if not record:
        return jsonify({"status": "error", "message": "No OTP was sent to this account."}), 400
    if time.time() > record['expires_at']:
        _otp_store.pop(str(employee_id), None)
        return jsonify({"status": "error", "message": "OTP has expired. Please log in again."}), 400
    if otp_input != record['otp']:
        return jsonify({"status": "error", "message": "Invalid OTP. Please try again."}), 400

    _otp_store.pop(str(employee_id), None)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT e.employee_id, e.role_id, r.role_name,
                   e.employee_name,
                   r.sales_permissions, r.inventory_permissions, r.order_permissions,
                   r.supplier_permissions, r.reports_permissions, r.settings_permissions
            FROM employee e
            JOIN employee_role r ON e.role_id = r.role_id
            WHERE e.employee_id = %s
        """, (employee_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({"status": "error", "message": "Employee not found."}), 404
        response = _build_token_response(user)
        response['device_trust_token'] = _build_trust_token(employee_id)
        return jsonify(response), 200
    finally:
        cur.close()
        conn.close()


@auth_bp.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.json
    employee_id = data.get('employeeId')
    contact = data.get('contact', '').strip()
    method = data.get('method')

    if not employee_id or not contact:
        return jsonify({"status": "error", "message": "Employee ID and contact are required."}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if method == 'sms':
            cur.execute("SELECT employee_id, employee_contact FROM employee WHERE employee_id = %s", (employee_id,))
            employee = cur.fetchone()
            if not employee:
                return jsonify({"status": "error", "message": "Employee ID not found."}), 404

            def normalize(num):
                return ''.join(filter(str.isdigit, num or ''))[-10:]

            if normalize(employee['employee_contact']) != normalize(contact):
                return jsonify({"status": "error", "message": "Contact number does not match our records."}), 400

            otp_code = str(random.randint(100000, 999999))
            _otp_store[str(employee_id)] = {"otp": otp_code, "expires_at": time.time() + 120}

            digits = ''.join(filter(str.isdigit, contact))
            if digits.startswith('0'): digits = '63' + digits[1:]
            if not digits.startswith('63'): digits = '63' + digits

            try:
                resp = http_requests.post(
                    "https://api.semaphore.co/api/v4/messages",
                    data={
                        "apikey": SEMAPHORE_API_KEY, "number": digits,
                        "message": f"Your AE Samonte verification code is: {otp_code}. It expires in 2 minutes.",
                        "sendername": SEMAPHORE_SENDER,
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
            cur.execute("SELECT employee_id, employee_email FROM employee WHERE employee_id = %s", (employee_id,))
            employee = cur.fetchone()
            if not employee:
                return jsonify({"status": "error", "message": "Employee ID not found."}), 404

            if (employee['employee_email'] or '').strip().lower() != contact.lower():
                return jsonify({"status": "error", "message": "Email address does not match our records."}), 400

            otp_code = str(random.randint(100000, 999999))
            _otp_store[str(employee_id)] = {"otp": otp_code, "expires_at": time.time() + 120}

            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "AE Samonte – Your Verification Code"
                msg["From"] = GMAIL_USER
                msg["To"] = contact
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
    data = request.json
    otp_input   = data.get('otp', '').strip()
    employee_id = str(data.get('employeeId', ''))
    method      = data.get('method')

    if method in ('sms', 'email'):
        record = _otp_store.get(employee_id)
        if not record:
            return jsonify({"status": "error", "message": "No OTP was sent to this account."}), 400
        if time.time() > record['expires_at']:
            _otp_store.pop(employee_id, None)
            return jsonify({"status": "error", "message": "OTP has expired. Please request a new one."}), 400
        if otp_input != record['otp']:
            return jsonify({"status": "error", "message": "Invalid OTP. Please try again."}), 400
        _otp_store.pop(employee_id, None)
        return jsonify({"status": "success", "message": "OTP verified."}), 200

    return jsonify({"status": "error", "message": "Unsupported method."}), 400


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    employee_id = data.get('employeeId')
    email = data.get('email', '').strip()

    if not employee_id or not email:
        return jsonify({"status": "error", "message": "Missing required fields."}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT employee_id, employee_email FROM employee WHERE employee_id = %s", (employee_id,))
        employee = cur.fetchone()
        if not employee:
            return jsonify({"status": "error", "message": "Employee not found."}), 404

        import string
        chars = string.ascii_letters + string.digits + "!@#$%"
        temp_password = ''.join(random.choices(chars, k=10))

        hashed = bcrypt.hashpw(temp_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cur.execute("UPDATE employee SET employee_password = %s WHERE employee_id = %s", (hashed, employee_id))
        conn.commit()

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "AE Samonte – Your Temporary Password"
            msg["From"] = GMAIL_USER
            msg["To"] = email
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


@auth_bp.route('/profile', methods=['GET'])
def get_profile():
    auth_header = request.headers.get('Authorization', '')
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        employee_id = payload['employee_id']
    except Exception:
        return jsonify({"error": "Invalid or missing token"}), 401

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT employee_name, employee_email, employee_contact, two_fa_enabled FROM employee WHERE employee_id = %s",
            (employee_id,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Employee not found"}), 404
        return jsonify({
            "name":           row['employee_name'],
            "email":          row['employee_email'],
            "contact":        row['employee_contact'] or '',
            "two_fa_enabled": row['two_fa_enabled'] or False,
        }), 200
    finally:
        cur.close()
        conn.close()


@auth_bp.route('/profile', methods=['PATCH'])
def update_profile():
    auth_header = request.headers.get('Authorization', '')
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        employee_id = payload['employee_id']
    except Exception:
        return jsonify({"error": "Invalid or missing token"}), 401

    data = request.json or {}
    contact        = data.get('contact', '').strip()
    two_fa_enabled = data.get('two_fa_enabled')

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("UPDATE employee SET employee_contact = %s WHERE employee_id = %s", (contact, employee_id))
        if two_fa_enabled is not None:
            cur.execute("UPDATE employee SET two_fa_enabled = %s WHERE employee_id = %s", (bool(two_fa_enabled), employee_id))
        conn.commit()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    data = request.json
    employee_id      = data.get('employeeId')
    current_password = data.get('currentPassword', '')
    new_password     = data.get('newPassword', '')

    if not employee_id or not current_password or not new_password:
        return jsonify({"status": "error", "message": "All fields are required."}), 400
    if len(new_password) < 6:
        return jsonify({"status": "error", "message": "New password must be at least 6 characters."}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT employee_password FROM employee WHERE employee_id = %s", (employee_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Employee not found."}), 404
        if not bcrypt.checkpw(current_password.encode("utf-8"), row['employee_password'].encode("utf-8")):
            return jsonify({"status": "error", "message": "Current password is incorrect."}), 400
        hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cur.execute("UPDATE employee SET employee_password = %s WHERE employee_id = %s", (hashed, employee_id))
        conn.commit()
        return jsonify({"status": "success", "message": "Password changed successfully."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()