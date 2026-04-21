from flask import Blueprint, request, jsonify
from database.db_config import get_connection
import bcrypt

users_bp = Blueprint("users", __name__)

SUPER_ADMIN_ROLE_ID = 1

def _get_role_rank(cursor, role_id: int) -> int:
    """
    Return the positional rank of a role (0 = highest authority).
    Roles are ordered by role_id ASC; Super Admin (role_id=1) is always rank 0.
    Lower rank = higher authority.
    """
    cursor.execute("SELECT role_id FROM employee_role ORDER BY role_id ASC")
    ids = [r[0] for r in cursor.fetchall()]
    try:
        return ids.index(role_id)
    except ValueError:
        return 999  # unknown role → lowest authority


def _can_act_on(requester_role_id: int, target_role_id: int, cursor) -> bool:
    """Return True if requester outranks the target."""
    if target_role_id == SUPER_ADMIN_ROLE_ID:
        return False
    requester_rank = _get_role_rank(cursor, requester_role_id)
    target_rank    = _get_role_rank(cursor, target_role_id)
    return requester_rank < target_rank

@users_bp.route("/employees", methods=["GET"])
def get_employees():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT e.employee_id, e.employee_name, e.employee_email,
                   e.employee_contact, e.role_id, e.employee_status_id,
                   s.status_code, e.is_archived,
                   e.employee_username
            FROM employee e
            JOIN static_status s ON e.employee_status_id = s.status_id
            WHERE e.employee_id != 1
            ORDER BY e.employed_date DESC
        """)
        rows = cursor.fetchall()
        employees = [
            {
                "id":          r[0],
                "name":        r[1],
                "email":       r[2],
                "contact":     r[3],
                "role_id":     r[4],
                "status_id":   r[5],
                "status_code": r[6],
                "is_archived": r[7],
                "username":    r[8] 
            } for r in rows
        ]
        return jsonify(employees)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@users_bp.route("/employees", methods=["POST"])
def create_employee():
    data = request.json
    status_id = int(data.get("status_id", 11))
    role_id   = int(data.get("role_id", 0))

    if role_id == SUPER_ADMIN_ROLE_ID:
        return jsonify({"error": "Cannot create a Super Admin account."}), 403

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SET LOCAL app.current_user_id = %s", (1,))
        hashed = bcrypt.hashpw(data['password'].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute("""
            INSERT INTO employee (employee_name, employee_username, employee_email, employee_contact,
                               employee_password, role_id, employed_date, employee_status_id)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_DATE, %s)
        """, (data['name'], data['username'], data['email'], data['contact'], hashed, role_id, status_id))
        conn.commit()
        return jsonify({"message": "Created"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@users_bp.route("/employees/<int:employee_id>", methods=["PUT"])
def update_employee(employee_id):
    data = request.json
    status_id       = int(data.get("status_id", 11))
    new_role_id     = int(data.get("role_id", 0))
    requester_role  = int(data.get("requester_role_id", 0))
    requester_emp   = int(data.get("requester_employee_id", 0))

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT role_id FROM employee WHERE employee_id = %s", (employee_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Employee not found"}), 404

        current_role_id = row[0]

        # Super Admin is immutable
        if current_role_id == SUPER_ADMIN_ROLE_ID:
            return jsonify({"error": "The Super Admin account cannot be modified."}), 403

        # Cannot promote anyone to Super Admin
        if new_role_id == SUPER_ADMIN_ROLE_ID:
            return jsonify({"error": "Cannot assign the Super Admin role to an account."}), 403

        # Hierarchy check — uses DB role ordering, not raw role_id numbers
        if requester_role > 0 and not _can_act_on(requester_role, current_role_id, cursor):
            # Allow self-edit regardless of rank
            if requester_emp != employee_id:
                return jsonify({"error": "You can only manage users with a lower role than yours."}), 403

        cursor.execute("SET LOCAL app.current_user_id = %s", (1,))
        cursor.execute("""
            UPDATE employee SET employee_name=%s, employee_username=%s, employee_email=%s,
            employee_contact=%s, role_id=%s, employee_status_id=%s
            WHERE employee_id=%s
        """, (data['name'], data['username'], data['email'], data['contact'], new_role_id, status_id, employee_id))
        if data.get("password") and data.get("password").strip():
            hashed = bcrypt.hashpw(data['password'].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cursor.execute("UPDATE employee SET employee_password=%s WHERE employee_id=%s", (hashed, employee_id))
        conn.commit()
        return jsonify({"message": "Updated"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@users_bp.route("/employees/<int:employee_id>", methods=["DELETE"])
def delete_employee(employee_id):
    requester_role = int(request.args.get("requester_role_id", 0))

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SET LOCAL app.current_user_id = %s", (1,))
        cursor.execute("""
            SELECT e.role_id, s.status_code FROM employee e
            JOIN static_status s ON e.employee_status_id = s.status_id
            WHERE e.employee_id = %s
        """, (employee_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Employee not found"}), 404

        role_id, status_code = row

        if role_id == SUPER_ADMIN_ROLE_ID:
            return jsonify({"error": "The Super Admin account cannot be archived."}), 403

        if requester_role > 0 and not _can_act_on(requester_role, role_id, cursor):
            return jsonify({"error": "You can only manage users with a lower role than yours."}), 403

        if status_code == 'ACTIVE':
            return jsonify({"error": "Cannot archive an active employee. Set to Inactive first."}), 400

        cursor.execute("UPDATE employee SET is_archived = TRUE WHERE employee_id = %s", (employee_id,))
        conn.commit()
        return jsonify({"message": "Employee archived successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Update failed", "details": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@users_bp.route("/employees/<int:employee_id>/restore", methods=["PUT"])
def restore_employee(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SET LOCAL app.current_user_id = %s", (1,))
        cursor.execute("""
            UPDATE employee 
            SET is_archived = FALSE
            WHERE employee_id = %s
        """, (employee_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Employee not found"}), 404
        conn.commit()
        return jsonify({"message": "Employee restored successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()