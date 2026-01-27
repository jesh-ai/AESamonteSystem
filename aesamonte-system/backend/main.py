from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

def get_db_connection():
    # Uses the credentials you already verified in your .env
    return psycopg2.connect(
        host=os.getenv("host"),
        database=os.getenv("dbname"),
        user=os.getenv("user"),
        password=os.getenv("password"),
        port=os.getenv("port"),
        sslmode='require' # Required for Supabase
    )

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. Check if employee exists
        cur.execute("SELECT employee_id, role_id, employee_password FROM Employee WHERE employee_email = %s", (email,))
        user = cur.fetchone()

        if user and user['employee_password'] == password: # Note: In production, use bcrypt.hashpw
            # 2. SUCCESS: Create an Audit Log entry
            cur.execute("""
                INSERT INTO Employee_Audit_Log (employee_id, role_id, employee_audit_log_type)
                VALUES (%s, %s, 'LOGIN')
            """, (user['employee_id'], user['role_id']))
            
            conn.commit()
            return jsonify({"status": "success", "message": "Logged in", "role": user['role_id']}), 200
        else:
            return jsonify({"status": "error", "message": "Invalid credentials"}), 401

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)