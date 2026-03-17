-- Run this once in your PostgreSQL database (local and on Render)
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING / DO UPDATE

-- 1. Add description and status columns to employee_role
ALTER TABLE employee_role
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;

-- 2. Add dashboard_permissions and export_permissions if missing
ALTER TABLE employee_role
    ADD COLUMN IF NOT EXISTS dashboard_permissions BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS export_permissions    BOOLEAN DEFAULT FALSE;

-- 3. Add can_export to role_permissions if missing
ALTER TABLE role_permissions
    ADD COLUMN IF NOT EXISTS can_export BOOLEAN DEFAULT FALSE;

-- 4. Seed granular permissions from existing boolean columns.
--    Uses module_name to match the actual role_permissions schema.
--    ON CONFLICT leaves existing rows untouched.
INSERT INTO role_permissions (role_id, module_name, can_view, can_create, can_edit, can_archive, can_export)
SELECT
    r.role_id,
    m.module_name,
    -- can_view: true if the role had any access to that module
    CASE m.module_name
        WHEN 'dashboard' THEN COALESCE(r.dashboard_permissions, FALSE)
        WHEN 'sales'     THEN r.sales_permissions
        WHEN 'inventory' THEN r.inventory_permissions
        WHEN 'orders'    THEN r.order_permissions
        WHEN 'supplier'  THEN r.supplier_permissions
        WHEN 'reports'   THEN r.reports_permissions
        WHEN 'settings'  THEN r.settings_permissions
        ELSE FALSE
    END AS can_view,
    -- can_create: same as can_view (seeded from old boolean)
    CASE m.module_name
        WHEN 'dashboard' THEN COALESCE(r.dashboard_permissions, FALSE)
        WHEN 'sales'     THEN r.sales_permissions
        WHEN 'inventory' THEN r.inventory_permissions
        WHEN 'orders'    THEN r.order_permissions
        WHEN 'supplier'  THEN r.supplier_permissions
        WHEN 'reports'   THEN r.reports_permissions
        WHEN 'settings'  THEN r.settings_permissions
        ELSE FALSE
    END AS can_create,
    -- can_edit: same seeding
    CASE m.module_name
        WHEN 'dashboard' THEN COALESCE(r.dashboard_permissions, FALSE)
        WHEN 'sales'     THEN r.sales_permissions
        WHEN 'inventory' THEN r.inventory_permissions
        WHEN 'orders'    THEN r.order_permissions
        WHEN 'supplier'  THEN r.supplier_permissions
        WHEN 'reports'   THEN r.reports_permissions
        WHEN 'settings'  THEN r.settings_permissions
        ELSE FALSE
    END AS can_edit,
    FALSE AS can_archive,  -- archive defaults to false; set explicitly via UI
    FALSE AS can_export    -- export defaults to false; set explicitly via UI
FROM employee_role r
CROSS JOIN (
    VALUES
        ('dashboard'),
        ('sales'),
        ('inventory'),
        ('orders'),
        ('supplier'),
        ('reports'),
        ('settings')
) AS m(module_name)
ON CONFLICT (role_id, module_name) DO NOTHING;