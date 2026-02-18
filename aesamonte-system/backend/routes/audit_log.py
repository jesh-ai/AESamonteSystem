from flask import Blueprint, jsonify
from database.db_config import get_connection

audit_log_bp = Blueprint("audit_log", __name__, url_prefix="/api/audit-log")

@audit_log_bp.route("", methods=["GET"])
def get_all_audit_logs():
    try:
        logs = []

        with get_connection() as conn:
            with conn.cursor() as cur:

                try:
                    cur.execute("SELECT current_setting('app.current_user_role')::text")
                    current_user_role = cur.fetchone()[0].upper()
                except Exception:
                    current_user_role = "USER"
                    conn.rollback() 
                
                query = f"""
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
                        JOIN static_status sl ON sl.status_id = eal.audit_log_type_id
                        JOIN employee performer ON performer.employee_id = eal.performed_by

                        UNION ALL

                        -- EMPLOYEE_ROLE (only admin)
                            {"""
                            SELECT 
                                eral.role_audit_log_id AS id,
                                'EMPLOYEE_ROLE' AS module,
                                r.role_name AS record_name,
                                sl.status_name AS action_type,
                                performer.employee_name AS performed_by,
                                eral.role_audit_log_date AS action_date,
                                eral.changed_fields
                            FROM employee_role_audit_log eral
                            JOIN employee_role r ON r.role_id = eral.role_id
                            JOIN static_status sl ON sl.status_id = eral.audit_log_type_id
                            JOIN employee performer ON performer.employee_id = eral.performed_by
                            """ if current_user_role == 'ADMIN' else """
                            SELECT 
                                NULL::BIGINT AS id,
                                'EMPLOYEE_ROLE'::TEXT AS module,
                                NULL::TEXT AS record_name,
                                NULL::TEXT AS action_type,
                                NULL::TEXT AS performed_by,
                                NULL::TIMESTAMP AS action_date,
                                '{}'::JSONB AS changed_fields
                            WHERE FALSE
                            """}

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
                        JOIN static_status sl ON sl.status_id = sal.audit_log_type_id
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
                        JOIN static_status sl ON sl.status_id = cal.audit_log_type_id
                        JOIN employee performer ON performer.employee_id = cal.performed_by

                        UNION ALL

                        -- INVENTORY
                        SELECT 
                            ial.inventory_audit_log_id AS id,
                            'INVENTORY' AS module,
                            i.item_name AS record_name,
                            sl.status_name AS action_type,
                            performer.employee_name AS performed_by,
                            ial.inventory_audit_log_date AS action_date,
                            ial.changed_fields
                        FROM inventory_audit_log ial
                        JOIN inventory i ON i.inventory_id = ial.inventory_id
                        JOIN static_status sl ON sl.status_id = ial.audit_log_type_id
                        JOIN employee performer ON performer.employee_id = ial.performed_by
                                                UNION ALL

                        -- ORDER
                        SELECT
                            oal.order_audit_log_id AS id,
                            'ORDER' AS module,
                            ot.order_id::text AS record_name,
                            sl.status_name AS action_type,
                            performer.employee_name AS performed_by,
                            oal.order_audit_log_date AS action_date,
                            oal.changed_fields
                        FROM order_audit_log oal
                        JOIN order_transaction ot ON ot.order_id = oal.order_id
                        JOIN static_status sl ON sl.status_id = oal.audit_log_type_id
                        JOIN employee performer ON performer.employee_id = oal.performed_by

                        UNION ALL

                        -- SALES
                        SELECT
                            sal.sales_audit_log_id AS id,
                            'SALES' AS module,
                            st.sales_id::text AS record_name,
                            sl.status_name AS action_type,
                            performer.employee_name AS performed_by,
                            sal.sales_audit_log_date AS action_date,
                            sal.changed_fields
                        FROM sales_audit_log sal
                        JOIN sales_transaction st ON st.sales_id = sal.sales_id
                        JOIN static_status sl ON sl.status_id = sal.audit_log_type_id
                        JOIN employee performer ON performer.employee_id = sal.performed_by
                    ) AS combined_logs
                    ORDER BY action_date DESC;
                """

                cur.execute(query)
                rows = cur.fetchall()

                # Build response
                logs = []
                for r in rows:
                    if r[0] is None:
                        continue  # skip SELECT NULL WHERE FALSE rows
                    logs.append({
                        "id": r[0],
                        "module": r[1],
                        "recordName": r[2],
                        "actionType": r[3],
                        "performedBy": r[4],
                        "actionDate": r[5].isoformat() if r[5] else None,
                        "changedFields": r[6] or {}
                    })

        return jsonify(logs)

    except Exception as e:
        print("Error fetching audit logs:", e)
        return jsonify([]), 200  # always return an array to avoid frontend crash
