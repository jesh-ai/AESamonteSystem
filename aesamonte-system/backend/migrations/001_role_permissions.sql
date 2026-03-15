-- Run this once in your PostgreSQL database (local and on Render)

-- Add description and status to roles
ALTER TABLE employee_role
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Granular permissions table (view/create/edit/delete per module per role)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id    INTEGER NOT NULL REFERENCES employee_role(role_id) ON DELETE CASCADE,
    module     VARCHAR(50) NOT NULL,
    can_view   BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit   BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (role_id, module)
);

-- Seed default granular permissions from existing boolean columns
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.role_id, m.module,
       CASE m.module
           WHEN 'sales'      THEN r.sales_permissions
           WHEN 'inventory'  THEN r.inventory_permissions
           WHEN 'orders'     THEN r.order_permissions
           WHEN 'supplier'   THEN r.supplier_permissions
           WHEN 'reports'    THEN r.reports_permissions
           WHEN 'settings'   THEN r.settings_permissions
       END,
       CASE m.module
           WHEN 'sales'      THEN r.sales_permissions
           WHEN 'inventory'  THEN r.inventory_permissions
           WHEN 'orders'     THEN r.order_permissions
           WHEN 'supplier'   THEN r.supplier_permissions
           WHEN 'reports'    THEN r.reports_permissions
           WHEN 'settings'   THEN r.settings_permissions
       END,
       CASE m.module
           WHEN 'sales'      THEN r.sales_permissions
           WHEN 'inventory'  THEN r.inventory_permissions
           WHEN 'orders'     THEN r.order_permissions
           WHEN 'supplier'   THEN r.supplier_permissions
           WHEN 'reports'    THEN r.reports_permissions
           WHEN 'settings'   THEN r.settings_permissions
       END,
       FALSE  -- delete defaults to false for all roles
FROM employee_role r
CROSS JOIN (VALUES ('sales'),('inventory'),('orders'),('supplier'),('reports'),('settings')) AS m(module)
ON CONFLICT (role_id, module) DO NOTHING;
