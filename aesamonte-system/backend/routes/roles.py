from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor

roles_bp = Blueprint('roles', __name__)

MODULES = ['dashboard', 'sales', 'inventory', 'orders', 'supplier', 'reports', 'settings']
MODULE_COL = {
    'dashboard': 'dashboard_permissions',
    'sales':     'sales_permissions',
    'inventory': 'inventory_permissions',
    'orders':    'order_permissions',
    'supplier':  'supplier_permissions',
    'reports':   'reports_permissions',
    'settings':  'settings_permissions',
}


@roles_bp.route('/roles', methods=['GET'])
def get_roles():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT r.role_id, r.role_name,
                   COALESCE(r.is_active, TRUE) AS is_active,
                   r.sales_permissions, r.inventory_permissions, r.order_permissions,
                   r.supplier_permissions, r.reports_permissions, r.settings_permissions,
                   COUNT(e.employee_id) FILTER (
                       WHERE s.status_code = 'ACTIVE'
                   ) AS user_count
            FROM employee_role r
            LEFT JOIN employee e ON e.role_id = r.role_id
            LEFT JOIN static_status s ON e.employee_status_id = s.status_id
            WHERE COALESCE(r.is_active, TRUE) = TRUE
            GROUP BY r.role_id, r.role_name, r.is_active,
                     r.sales_permissions, r.inventory_permissions, r.order_permissions,
                     r.supplier_permissions, r.reports_permissions, r.settings_permissions
            ORDER BY r.role_id
        """)
        return jsonify([dict(r) for r in cur.fetchall()])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/archived', methods=['GET'])
def get_archived_roles():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT r.role_id, r.role_name,
                   COALESCE(r.is_active, TRUE) AS is_active,
                   r.sales_permissions, r.inventory_permissions, r.order_permissions,
                   r.supplier_permissions, r.reports_permissions, r.settings_permissions,
                   COUNT(e.employee_id) FILTER (
                       WHERE s.status_code = 'ACTIVE'
                   ) AS user_count
            FROM employee_role r
            LEFT JOIN employee e ON e.role_id = r.role_id
            LEFT JOIN static_status s ON e.employee_status_id = s.status_id
            WHERE COALESCE(r.is_active, TRUE) = FALSE
            GROUP BY r.role_id, r.role_name, r.is_active,
                     r.sales_permissions, r.inventory_permissions, r.order_permissions,
                     r.supplier_permissions, r.reports_permissions, r.settings_permissions
            ORDER BY r.role_id
        """)
        return jsonify([dict(r) for r in cur.fetchall()])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles', methods=['POST'])
def create_role():
    data = request.json
    role_name = data.get('role_name', '').strip()
    if not role_name:
        return jsonify({"error": "Role name is required"}), 400

    description  = data.get('description', '')
    is_active    = data.get('is_active', True)
    granular     = data.get('granular_permissions', {})

    conn = get_connection()
    cur  = conn.cursor()
    try:
        bool_vals = {}
        for module in MODULES:
            mp = granular.get(module, {})
            bool_vals[module] = any([
                mp.get('can_view', False),    mp.get('can_create', False),
                mp.get('can_edit', False),    mp.get('can_archive', False),
                mp.get('can_export', False),
            ])

        has_export = any(granular.get(m, {}).get('can_export', False) for m in MODULES)

        try:
            cur.execute("""
                INSERT INTO employee_role
                    (role_name, description, is_active,
                     dashboard_permissions, export_permissions,
                     sales_permissions, inventory_permissions, order_permissions,
                     supplier_permissions, reports_permissions, settings_permissions)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING role_id
            """, (
                role_name, description, is_active,
                bool_vals['dashboard'], has_export,
                bool_vals['sales'],     bool_vals['inventory'], bool_vals['orders'],
                bool_vals['supplier'],  bool_vals['reports'],   bool_vals['settings'],
            ))
        except Exception:
            conn.rollback()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO employee_role
                    (role_name,
                     sales_permissions, inventory_permissions, order_permissions,
                     supplier_permissions, reports_permissions, settings_permissions)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING role_id
            """, (
                role_name,
                bool_vals['sales'],     bool_vals['inventory'], bool_vals['orders'],
                bool_vals['supplier'],  bool_vals['reports'],   bool_vals['settings'],
            ))

        new_id = cur.fetchone()[0]
        conn.commit()

        try:
            cur2 = conn.cursor()
            for module, perms in granular.items():
                cur2.execute("""
                    INSERT INTO role_permissions (role_id, module_name, can_view, can_create, can_edit, can_archive, can_export)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (role_id, module_name) DO UPDATE
                        SET can_view    = EXCLUDED.can_view,
                            can_create  = EXCLUDED.can_create,
                            can_edit    = EXCLUDED.can_edit,
                            can_archive = EXCLUDED.can_archive,
                            can_export  = EXCLUDED.can_export
                """, (new_id, module,
                      perms.get('can_view', False),   perms.get('can_create', False),
                      perms.get('can_edit', False),   perms.get('can_archive', False),
                      perms.get('can_export', False)))
            conn.commit()
        except Exception:
            conn.rollback()

        return jsonify({"message": "Role created", "role_id": new_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/<int:role_id>', methods=['GET'])
def get_role_detail(role_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        try:
            cur.execute("""
                SELECT role_id, role_name,
                       COALESCE(description, '') AS description,
                       COALESCE(is_active, TRUE) AS is_active,
                       sales_permissions, inventory_permissions, order_permissions,
                       supplier_permissions, reports_permissions, settings_permissions
                FROM employee_role WHERE role_id = %s
            """, (role_id,))
        except Exception:
            conn.rollback()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT role_id, role_name,
                       '' AS description, TRUE AS is_active,
                       sales_permissions, inventory_permissions, order_permissions,
                       supplier_permissions, reports_permissions, settings_permissions
                FROM employee_role WHERE role_id = %s
            """, (role_id,))
        role = cur.fetchone()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        bool_map = {
            'dashboard': role.get('dashboard_permissions', False),
            'sales':     role['sales_permissions'],
            'inventory': role['inventory_permissions'],
            'orders':    role['order_permissions'],
            'supplier':  role['supplier_permissions'],
            'reports':   role['reports_permissions'],
            'settings':  role['settings_permissions'],
        }

        try:
            cur.execute("""
                SELECT module_name AS module, can_view, can_create, can_edit, can_archive,
                       COALESCE(can_export, FALSE) AS can_export
                FROM role_permissions WHERE role_id = %s
            """, (role_id,))
            rows = cur.fetchall()
            if rows:
                granular = {r['module']: dict(r) for r in rows}
            else:
                is_admin = (role_id == 1)
                granular = {
                    m: {'module': m, 'can_view': v, 'can_create': v, 'can_edit': v, 'can_archive': is_admin and v}
                    for m, v in bool_map.items()
                }
        except Exception:
            conn.rollback()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            is_admin = (role_id == 1)
            granular = {
                m: {'module': m, 'can_view': v, 'can_create': v, 'can_edit': v, 'can_archive': is_admin and v}
                for m, v in bool_map.items()
            }

        cur.execute("""
            SELECT e.employee_id, e.employee_name, e.employee_email
            FROM employee e
            JOIN static_status s ON e.employee_status_id = s.status_id
            WHERE e.role_id = %s AND s.status_code = 'ACTIVE'
            ORDER BY e.employee_name
        """, (role_id,))
        users = [dict(u) for u in cur.fetchall()]

        result = dict(role)
        result['granular_permissions'] = granular
        result['assigned_users'] = users
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/<int:role_id>', methods=['PUT'])
def update_role(role_id):
    data = request.json
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SET LOCAL app.current_user_id = %s", (1,))
        granular = data.get('granular_permissions', {})

        try:
            cur.execute("""
                UPDATE employee_role
                SET role_name = %s, description = %s, is_active = %s
                WHERE role_id = %s
            """, (data.get('role_name'), data.get('description', ''), data.get('is_active', True), role_id))
        except Exception:
            conn.rollback()
            cur = conn.cursor()
            cur.execute("UPDATE employee_role SET role_name = %s WHERE role_id = %s",
                        (data.get('role_name'), role_id))

        for module in MODULES:
            mp = granular.get(module, {})
            has_access = any([
                mp.get('can_view', False),    mp.get('can_create', False),
                mp.get('can_edit', False),    mp.get('can_archive', False),
                mp.get('can_export', False),
            ])
            col = MODULE_COL[module]
            cur.execute(f"UPDATE employee_role SET {col} = %s WHERE role_id = %s", (has_access, role_id))

        has_export = any(granular.get(m, {}).get('can_export', False) for m in MODULES)
        try:
            cur.execute("UPDATE employee_role SET export_permissions = %s WHERE role_id = %s", (has_export, role_id))
        except Exception:
            conn.rollback()
            cur = conn.cursor()

        conn.commit()

        try:
            cur2 = conn.cursor()
            cur2.execute("DELETE FROM role_permissions WHERE role_id = %s", (role_id,))
            for module, perms in granular.items():
                cur2.execute("""
                    INSERT INTO role_permissions (role_id, module_name, can_view, can_create, can_edit, can_archive, can_export)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (role_id, module,
                      perms.get('can_view', False),   perms.get('can_create', False),
                      perms.get('can_edit', False),   perms.get('can_archive', False),
                      perms.get('can_export', False)))
            conn.commit()
        except Exception:
            conn.rollback()

        return jsonify({"message": "Role updated"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/<int:role_id>/assign', methods=['POST'])
def assign_user(role_id):
    data = request.json
    employee_id = data.get('employee_id')
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE employee SET role_id = %s WHERE employee_id = %s", (role_id, employee_id))
        conn.commit()
        return jsonify({"message": "User assigned"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/<int:role_id>/permissions', methods=['PUT'])
def update_permissions(role_id):
    data = request.json
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE employee_role SET
                sales_permissions = %s, inventory_permissions = %s,
                order_permissions = %s, supplier_permissions  = %s,
                reports_permissions = %s, settings_permissions = %s
            WHERE role_id = %s
        """, (
            data.get('sales_permissions', False), data.get('inventory_permissions', False),
            data.get('order_permissions', False),  data.get('supplier_permissions', False),
            data.get('reports_permissions', False), data.get('settings_permissions', False),
            role_id
        ))
        conn.commit()
        return jsonify({"message": "Permissions updated"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/<int:role_id>', methods=['DELETE'])
def delete_role(role_id):
    if role_id in (1, 2):
        return jsonify({"error": "Cannot archive a system role"}), 400
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SET LOCAL app.current_user_id = %s", (1,))
        cur.execute("""
            SELECT COUNT(*) FROM employee e
            JOIN static_status s ON e.employee_status_id = s.status_id
            WHERE e.role_id = %s AND s.status_code = 'ACTIVE'
        """, (role_id,))
        count = cur.fetchone()[0]
        if count > 0:
            return jsonify({"error": f"Cannot archive: {count} active employee(s) assigned to this role"}), 400
        cur.execute("UPDATE employee_role SET is_active = FALSE WHERE role_id = %s", (role_id,))
        conn.commit()
        return jsonify({"message": "Role archived"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/<int:role_id>/restore', methods=['PUT'])
def restore_role(role_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SET LOCAL app.current_user_id = %s", (1,))
        cur.execute("UPDATE employee_role SET is_active = TRUE WHERE role_id = %s", (role_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Role not found"}), 404
        conn.commit()
        return jsonify({"message": "Role restored successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@roles_bp.route('/roles/<int:role_id>/unassign', methods=['POST'])
def unassign_user(role_id):
    data = request.json
    employee_id = data.get('employee_id')
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE employee SET role_id = 4 WHERE employee_id = %s AND role_id = %s",
            (employee_id, role_id)
        )
        conn.commit()
        return jsonify({"message": "User unassigned"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()