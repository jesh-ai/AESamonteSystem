from flask import Blueprint, request, jsonify
from database.db_config import get_connection
from psycopg2.extras import RealDictCursor

roles_bp = Blueprint('roles', __name__)

MODULES = ['sales', 'inventory', 'orders', 'supplier', 'reports', 'settings']
MODULE_COL = {
    'sales': 'sales_permissions', 'inventory': 'inventory_permissions',
    'orders': 'order_permissions', 'supplier': 'supplier_permissions',
    'reports': 'reports_permissions', 'settings': 'settings_permissions',
}


@roles_bp.route('/roles', methods=['GET'])
def get_roles():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT r.role_id, r.role_name,
                   r.sales_permissions, r.inventory_permissions, r.order_permissions,
                   r.supplier_permissions, r.reports_permissions, r.settings_permissions,
                   COUNT(e.employee_id) FILTER (WHERE e.employee_status_id = 9) AS user_count
            FROM employee_role r
            LEFT JOIN employee e ON e.role_id = r.role_id
            GROUP BY r.role_id, r.role_name,
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

        # Granular permissions — try role_permissions table first, fall back to booleans
        bool_map = {
            'sales':     role['sales_permissions'],
            'inventory': role['inventory_permissions'],
            'orders':    role['order_permissions'],
            'supplier':  role['supplier_permissions'],
            'reports':   role['reports_permissions'],
            'settings':  role['settings_permissions'],
        }
        try:
            cur.execute("""
                SELECT module, can_view, can_create, can_edit, can_archive
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

        # Assigned active employees
        cur.execute("""
            SELECT employee_id, employee_name, employee_email
            FROM employee WHERE role_id = %s AND employee_status_id = 9
            ORDER BY employee_name
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
        granular = data.get('granular_permissions', {})

        # ── Step 1: Update basic info + boolean columns, commit immediately ──
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

        # Sync high-level boolean columns from granular data
        for module in MODULES:
            has_access = any([
                granular.get(module, {}).get('can_view', False),
                granular.get(module, {}).get('can_create', False),
                granular.get(module, {}).get('can_edit', False),
                granular.get(module, {}).get('can_archive', False),
            ])
            col = MODULE_COL[module]
            cur.execute(f"UPDATE employee_role SET {col} = %s WHERE role_id = %s", (has_access, role_id))

        conn.commit()  # Commit basic info regardless of granular outcome

        # ── Step 2: Save granular permissions (requires migration) ──
        try:
            cur2 = conn.cursor()
            for module, perms in granular.items():
                cur2.execute("""
                    INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_archive)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (role_id, module) DO UPDATE SET
                        can_view    = EXCLUDED.can_view,
                        can_create  = EXCLUDED.can_create,
                        can_edit    = EXCLUDED.can_edit,
                        can_archive = EXCLUDED.can_archive
                """, (role_id, module,
                      perms.get('can_view', False), perms.get('can_create', False),
                      perms.get('can_edit', False),  perms.get('can_archive', False)))
            conn.commit()
        except Exception:
            conn.rollback()  # Only loses granular — basic info already committed above

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
    if role_id == 1:
        return jsonify({"error": "Cannot delete the Admin role"}), 400
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM employee WHERE role_id = %s AND employee_status_id = 9", (role_id,))
        count = cur.fetchone()[0]
        if count > 0:
            return jsonify({"error": f"Cannot delete: {count} active employee(s) assigned to this role"}), 400
        cur.execute("DELETE FROM employee_role WHERE role_id = %s", (role_id,))
        conn.commit()
        return jsonify({"message": "Role deleted"}), 200
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
        # NOTE: If your database requires every user to have a role (NOT NULL), 
        # change `NULL` to your default lowest-tier role ID (e.g., `2` for Staff).
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