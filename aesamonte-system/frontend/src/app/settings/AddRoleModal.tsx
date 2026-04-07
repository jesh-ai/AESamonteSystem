'use client';

import { useState } from "react";
import styles from "@/css/editRoleModal.module.css";
import { LuX } from "react-icons/lu";

interface GranularPerm {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_archive: boolean;
  can_export: boolean;
}

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sales',     label: 'Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'orders',    label: 'Orders' },
  { key: 'supplier',  label: 'Supplier' },
  { key: 'reports',   label: 'Reports' },
  { key: 'settings',  label: 'Settings' },
];

const ACTIONS: { key: keyof GranularPerm; label: string }[] = [
  { key: 'can_view',    label: 'View' },
  { key: 'can_create',  label: 'Create' },
  { key: 'can_edit',    label: 'Edit' },
  { key: 'can_archive', label: 'Archive' },
  { key: 'can_export',  label: 'Export' },
];

const DEFAULT_PERM: GranularPerm = {
  can_view: false, can_create: false, can_edit: false,
  can_archive: false, can_export: false,
};

// ── Business Rules ────────────────────────────────────────────────────────────
// Cell-level: defines whether each action is applicable per module.
// 'hidden'          → not applicable; show dash (—), always false in payload
// 'allowed'         → normal interactive checkbox
// 'admin_only'      → enabled only when currentUserRole is Admin or Super Admin
// 'superadmin_only' → enabled only when currentUserRole is Super Admin
type CellRule = 'hidden' | 'allowed' | 'admin_only' | 'superadmin_only';

const MODULE_RULES: Record<string, Record<keyof GranularPerm, CellRule>> = {
  dashboard: {
    can_view: 'allowed', can_create: 'hidden',         can_edit: 'allowed',
    can_archive: 'hidden', can_export: 'hidden',
  },
  sales: {
    can_view: 'allowed', can_create: 'hidden',         can_edit: 'allowed',
    can_archive: 'allowed', can_export: 'allowed',
  },
  inventory: {
    can_view: 'allowed', can_create: 'allowed',        can_edit: 'allowed',
    can_archive: 'allowed', can_export: 'allowed',
  },
  orders: {
    can_view: 'allowed', can_create: 'allowed',        can_edit: 'allowed',
    can_archive: 'allowed', can_export: 'allowed',
  },
  supplier: {
    can_view: 'allowed', can_create: 'allowed',        can_edit: 'allowed',
    can_archive: 'allowed', can_export: 'allowed',
  },
  reports: {
    can_view: 'allowed', can_create: 'hidden',         can_edit: 'hidden',
    can_archive: 'hidden', can_export: 'admin_only',
  },
  settings: {
    can_view: 'allowed', can_create: 'admin_only',     can_edit: 'allowed',
    can_archive: 'superadmin_only', can_export: 'superadmin_only',
  },
};

/**
 * Row-level visibility.
 * 'visible'  → render normally
 * 'hidden'   → skip rendering the row entirely
 *
 * Reports is a system-restricted module — only Admin / Super Admin can
 * configure it. All other modules respect the optional moduleAccessFlags map;
 * if a key is explicitly false the row is hidden.
 */
function getRowState(
  module: string,
  moduleAccessFlags: Record<string, boolean>,
): 'visible' | 'hidden' {
  if (moduleAccessFlags[module] === false) return 'hidden';
  // Reports is strictly an Admin / Super Admin privilege —
  // custom roles configured through this UI should never have Reports access.
  if (module === 'reports') return 'hidden';
  return 'visible';
}

/**
 * Cell-level state for a specific module × action pair.
 * 'hidden'     → show dash (—), excluded from payload
 * 'restricted' → checkbox visible but disabled (role requirement not met)
 * 'active'     → normal interactive checkbox
 */
function getCellState(
  module: string,
  action: keyof GranularPerm,
  currentUserRole: string,
): 'hidden' | 'restricted' | 'active' {
  const rule = MODULE_RULES[module]?.[action] ?? 'allowed';
  if (rule === 'hidden') return 'hidden';
  if (rule === 'admin_only')
    return ['Admin', 'Super Admin'].includes(currentUserRole) ? 'active' : 'restricted';
  if (rule === 'superadmin_only')
    return currentUserRole === 'Super Admin' ? 'active' : 'restricted';
  return 'active';
}

function initPerms(): Record<string, GranularPerm> {
  const p: Record<string, GranularPerm> = {};
  MODULES.forEach(m => { p[m.key] = { ...DEFAULT_PERM }; });
  return p;
}

export default function AddRoleModal({
  onClose,
  onSave,
  onError,
  currentUserRole = 'Admin',
  moduleAccessFlags = {},
}: {
  onClose: () => void;
  onSave: () => void;
  onError: (message: string) => void;
  currentUserRole?: string;
  moduleAccessFlags?: Record<string, boolean>;
}) {
  const [roleName, setRoleName]       = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms]             = useState<Record<string, GranularPerm>>(initPerms());
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const togglePerm = (module: string, action: keyof GranularPerm, value: boolean) => {
    setPerms(prev => {
      const cur = { ...prev[module] };
      if (action === 'can_view' && !value) {
        // Unchecking View clears all non-hidden actions for this module
        ACTIONS.forEach(a => {
          if (getCellState(module, a.key, currentUserRole) !== 'hidden') cur[a.key] = false;
        });
        return { ...prev, [module]: cur };
      }
      if (action !== 'can_view' && value) cur.can_view = true;
      cur[action] = value;
      return { ...prev, [module]: cur };
    });
  };

  // 'All' only toggles cells that are currently 'active' (not hidden or restricted)
  const toggleRow = (module: string) => {
    const activeActions = ACTIONS.filter(
      a => getCellState(module, a.key, currentUserRole) === 'active',
    );
    const allOn = activeActions.length > 0 && activeActions.every(a => perms[module]?.[a.key]);
    setPerms(prev => {
      const cur = { ...prev[module] };
      activeActions.forEach(a => { cur[a.key] = !allOn; });
      return { ...prev, [module]: cur };
    });
  };

  const handleCreate = async () => {
    if (!roleName.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    setError('');

    // Build cleaned payload: zero-out hidden rows and hidden cells
    const cleanedPerms: Record<string, GranularPerm> = {};
    MODULES.forEach(m => {
      if (getRowState(m.key, moduleAccessFlags) === 'hidden') {
        cleanedPerms[m.key] = { ...DEFAULT_PERM };
      } else {
        cleanedPerms[m.key] = { ...perms[m.key] };
        ACTIONS.forEach(a => {
          if (getCellState(m.key, a.key, currentUserRole) === 'hidden')
            cleanedPerms[m.key][a.key] = false;
        });
      }
    });

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_name: roleName, description,
          is_active: true, 
          granular_permissions: cleanedPerms,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSave();
        onClose();
      } else {
        const msg = data.error || 'Failed to create role.';
        setError(msg);
        onError(msg);
      }
    } catch {
      const msg = 'Failed to create role.';
      setError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div>
            <p className={styles.headerSub}>Access Control</p>
            <h2 className={styles.headerTitle}>Create New Role</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><LuX size={20} /></button>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>
          {error && <p className={styles.errorMsg}>{error}</p>}

          {/* 1. General Info */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionNum}>1</span> General Role Information
            </h3>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label>Role Name</label>
                <input
                  type="text"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  className={styles.textInput}
                  placeholder="e.g. Sales Manager"
                />
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  placeholder="Describe what this role can do..."
                />
              </div>
            </div>
          </section>

          {/* 2. Permission Matrix */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionNum}>2</span> Module Permissions
            </h3>
            <div className={styles.permMatrix}>
              <div className={styles.matrixHeader}>
                <span className={styles.moduleCol}>Module</span>
                {ACTIONS.map(a => <span key={a.key}>{a.label}</span>)}
                <span>All</span>
              </div>

              {MODULES.map(m => {
                if (getRowState(m.key, moduleAccessFlags) === 'hidden')
                  return null;

                const mp = perms[m.key] ?? { ...DEFAULT_PERM };
                const viewOff = !mp.can_view;
                const activeActions = ACTIONS.filter(
                  a => getCellState(m.key, a.key, currentUserRole) === 'active',
                );
                const allOn = activeActions.length > 0 && activeActions.every(a => mp[a.key]);

                return (
                  <div key={m.key} className={styles.matrixRow}>
                    <span className={styles.moduleCol}>{m.label}</span>

                    {ACTIONS.map(a => {
                      const cellState = getCellState(m.key, a.key, currentUserRole);

                      if (cellState === 'hidden' || cellState === 'restricted') {
                        return (
                          <span
                            key={a.key}
                            className={styles.checkCell}
                            style={{ color: '#bbb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            —
                          </span>
                        );
                      }

                      const isDisabled = a.key !== 'can_view' && viewOff;

                      return (
                        <span key={a.key} className={styles.checkCell}>
                          <input
                            type="checkbox"
                            className={styles.permCheck}
                            checked={mp[a.key]}
                            disabled={isDisabled}
                            onChange={e => togglePerm(m.key, a.key, e.target.checked)}
                            style={isDisabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                          />
                        </span>
                      );
                    })}

                    {/* All column */}
                    <span className={styles.checkCell}>
                      <input
                        type="checkbox"
                        className={styles.permCheck}
                        checked={allOn}
                        onChange={() => toggleRow(m.key)}
                        title="Toggle all available permissions"
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Role'}
          </button>
        </div>

      </div>
    </div>
  );
}
