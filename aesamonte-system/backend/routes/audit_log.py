from flask import Blueprint, jsonify
from database.db_config import get_connection

audit_log_bp = Blueprint("audit_log", __name__, url_prefix="/api/audit-log")

@audit_log_bp.route("", methods=["GET"])
def get_all_audit_logs():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM (
            -- EMPLOYEE
            SELECT 
                eal.employee_audit_log_id AS id,
                'EMPLOYEE' AS module,
                e.employee_name AS record_name,
                sl.status_name AS action_type,
                performer.employee_name AS performed_by,
                eal.employee_audit_log_date AS action_date,
                eal.changed_fields
            FROM employee_audit_log eal
            JOIN employee e ON e.employee_id = eal.employee_id
            JOIN status_like sl ON sl.status_id = eal.audit_log_type_id
            JOIN employee performer ON performer.employee_id = eal.performed_by

            UNION ALL

            -- SUPPLIER
            SELECT 
                sal.supplier_audit_log_id AS id,
                'SUPPLIER' AS module,
                s.supplier_name AS record_name,
                sl.status_name AS action_type,
                performer.employee_name AS performed_by,
                sal.supplier_audit_log_date AS action_date,
                sal.changed_fields
            FROM supplier_audit_log sal
            JOIN supplier s ON s.supplier_id = sal.supplier_id
            JOIN status_like sl ON sl.status_id = sal.audit_log_type_id
            JOIN employee performer ON performer.employee_id = sal.performed_by

            UNION ALL

            -- CUSTOMER
            SELECT 
                cal.customer_audit_log_id AS id,
                'CUSTOMER' AS module,
                c.customer_name AS record_name,
                sl.status_name AS action_type,
                performer.employee_name AS performed_by,
                cal.customer_audit_log_date AS action_date,
                cal.changed_fields
            FROM customer_audit_log cal
            JOIN customer c ON c.customer_id = cal.customer_id
            JOIN status_like sl ON sl.status_id = cal.audit_log_type_id
            JOIN employee performer ON performer.employee_id = cal.performed_by

            UNION ALL

            -- INVENTORY
            SELECT 
                ial.inventory_audit_log_id AS id,
                'INVENTORY' AS module,
                i.inventory_item_name AS record_name,
                sl.status_name AS action_type,
                performer.employee_name AS performed_by,
                ial.inventory_audit_log_date AS action_date,
                ial.changed_fields
            FROM inventory_audit_log ial
            JOIN inventory i ON i.inventory_id = ial.inventory_id
            JOIN status_like sl ON sl.status_id = ial.audit_log_type_id
            JOIN employee performer ON performer.employee_id = ial.performed_by
                
            UNION ALL
            
            -- ORDER
            SELECT
                oal.order_audit_log_id AS id,
                'ORDER' AS module,
                ot.order_id::text AS record_name,  -- use order_id as record name
                sl.status_name AS action_type,
                performer.employee_name AS performed_by,
                oal.order_audit_log_date AS action_date,
                oal.changed_fields
            FROM order_audit_log oal
            JOIN order_transaction ot ON ot.order_id = oal.order_id
            JOIN status_like sl ON sl.status_id = oal.audit_log_type_id
            JOIN employee performer ON performer.employee_id = oal.performed_by
                
        ) AS combined_logs
        ORDER BY action_date DESC;
    """)

    rows = cur.fetchall()

    logs = []
    for row in rows:
        logs.append({
            "id": row[0],
            "module": row[1],
            "recordName": row[2],
            "actionType": row[3],
            "performedBy": row[4],
            "actionDate": row[5].isoformat(),
            "changedFields": row[6]
        })

    cur.close()
    conn.close()

    return jsonify(logs)
