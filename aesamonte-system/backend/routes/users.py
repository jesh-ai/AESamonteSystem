from flask import Blueprint, request, jsonify
from database.db_config import get_connection
import bcrypt

users_bp = Blueprint("users", __name__)

@users_bp.route("/employees", methods=["GET"])
def get_employees():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT employee_id, employee_name, employee_email, 
                   employee_contact, role_id, employee_status_id
            FROM employee ORDER BY employed_date DESC
        """)
        rows = cursor.fetchall()
        employees = [
            {
                "id": r[0], 
                "name": r[1], 
                "email": r[2], 
                "contact": r[3], 
                "role_id": r[4], 
                "status_id": r[5]
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
    # Default to 9 (Active) if not provided to pass DB check constraint
    status_id = int(data.get("status_id", 9)) 

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Set Actor ID for Audit Trigger (System Admin = 1)
        cursor.execute("SET app.current_user_id = %s", (1,))

        hashed = bcrypt.hashpw(data['password'].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        
        cursor.execute("""
            INSERT INTO employee (employee_name, employee_username, employee_email, employee_contact,
                               employee_password, role_id, employed_date, employee_status_id)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_DATE, %s)
        """, (data['name'], data['username'], data['email'], data['contact'], hashed, data['role_id'], status_id))
        
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
    status_id = int(data.get("status_id", 9))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SET app.current_user_id = %s", (1,))
        cursor.execute("""
            UPDATE employee SET employee_name=%s, employee_username=%s, employee_email=%s,
            employee_contact=%s, role_id=%s, employee_status_id=%s
            WHERE employee_id=%s
        """, (data['name'], data['username'], data['email'], data['contact'], data['role_id'], status_id, employee_id))
        
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
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SET app.current_user_id = %s", (1,)) 

        cursor.execute("""
            UPDATE employee 
            SET employee_status_id = 10 
            WHERE employee_id = %s
        """, (employee_id,))
        
        if cursor.rowcount == 0:
            return jsonify({"error": "Employee not found"}), 404

        conn.commit()
        return jsonify({"message": "Employee deactivated successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Update failed", "details": str(e)}), 500
    finally:
        cursor.close()
        conn.close()