'use client';

import { useEffect, useState } from "react";
import styles from "@/css/settings.module.css";
import { MdTune } from "react-icons/md";
import { FiEdit3 } from "react-icons/fi";
import { LuTrash2 } from "react-icons/lu";
import SettingsHeader from "@/components/layout/BackSettingsHeader";
import ConfirmModal from "./confirmModal";
import EditRoleModal from "./EditRoleModal";

interface Role {
  role_id: number;
  role_name: string;
  sales_permissions: boolean;
  inventory_permissions: boolean;
  order_permissions: boolean;
  supplier_permissions: boolean;
  reports_permissions: boolean;
  settings_permissions: boolean;
  user_count: number;
}

type PermKey = 'sales_permissions' | 'inventory_permissions' | 'order_permissions'
             | 'supplier_permissions' | 'reports_permissions' | 'settings_permissions';

const PERM_COLUMNS: { key: PermKey; label: string }[] = [
  { key: 'sales_permissions',      label: 'Sales' },
  { key: 'inventory_permissions',  label: 'Inventory' },
  { key: 'order_permissions',      label: 'Orders' },
  { key: 'supplier_permissions',   label: 'Supplier' },
  { key: 'reports_permissions',    label: 'Reports' },
  { key: 'settings_permissions',   label: 'Settings' },
];

function getDescription(role: Role): string {
  const count = PERM_COLUMNS.filter(c => role[c.key]).length;
  if (count === PERM_COLUMNS.length) return "Full Access";
  if (count === 0) return "No Access";
  return "Partial Access";
}

export default function AccessControl({ onBack }: { onBack: () => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Record<number, Record<PermKey, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Edit role modal state
  const [editRoleId, setEditRoleId] = useState<number | null>(null);

  // Delete confirmation state
  const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const json = await res.json();
      const data: Role[] = Array.isArray(json) ? json : [];
      setRoles(data);
      const perms: Record<number, Record<PermKey, boolean>> = {};
      data.forEach(r => {
        perms[r.role_id] = {
          sales_permissions:     r.sales_permissions,
          inventory_permissions: r.inventory_permissions,
          order_permissions:     r.order_permissions,
          supplier_permissions:  r.supplier_permissions,
          reports_permissions:   r.reports_permissions,
          settings_permissions:  r.settings_permissions,
        };
      });
      setPermissions(perms);
    } catch (err) {
      console.error("Failed to fetch roles", err);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handlePermChange = (roleId: number, key: PermKey, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [roleId]: { ...prev[roleId], [key]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Only save non-Admin roles (role_id !== 1)
      const toSave = roles.filter(r => r.role_id !== 1);
      await Promise.all(toSave.map(r =>
        fetch(`/api/roles/${r.role_id}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(permissions[r.role_id]),
        })
      ));
      setSaveMsg('Permissions saved!');
      fetchRoles();
    } catch (err) {
      setSaveMsg('Failed to save.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteRoleId) return;
    setDeleteError('');
    try {
      const res = await fetch(`/api/roles/${deleteRoleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Delete failed');
        return;
      }
      setDeleteRoleId(null);
      fetchRoles();
    } catch (err) {
      setDeleteError('Delete failed');
    }
  };

  // Roles shown in permissions grid (exclude Admin)
  const editableRoles = roles.filter(r => r.role_id !== 1);

  return (
    <div className={styles.settingsCard}>
      <SettingsHeader title="Access Control" icon={<MdTune />} onBack={onBack} />

      {/* ── User Roles Table ── */}
      <div className={styles.placeholderContainer}>
        <h3 className={styles.sectionLabel}>User Roles</h3>

        <div className={styles.accessHeader} style={{ marginTop: '1rem' }}>
          <span>Role Name</span>
          <span>Description</span>
          <span>User Assigned</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {roles.map(role => (
          <div key={role.role_id} className={styles.accessRow}>
            <span className={styles.roleName}>{role.role_name}</span>
            <span>{getDescription(role)}</span>
            <span>{role.user_count}</span>
            <span className={role.user_count > 0 ? styles.statusActive : styles.statusInactive}>
              {role.user_count > 0 ? 'Active' : 'Inactive'}
            </span>
            <div className={styles.actionGroup}>
              <button
                className={styles.editBtn}
                onClick={() => setEditRoleId(role.role_id)}
              >
                <FiEdit3 size={13} /> Edit
              </button>
              <button
                className={styles.deleteBtn}
                onClick={() => { setDeleteError(''); setDeleteRoleId(role.role_id); }}
                disabled={role.role_id === 1}
              >
                <LuTrash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Permissions Grid ── */}
      <div className={styles.permissionsSection}>
        <div className={styles.flexHeader}>
          <h3 className={styles.sectionLabel}>Permissions</h3>
          <button className={styles.compactSaveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
        {saveMsg && <p className={styles.saveMsg}>{saveMsg}</p>}

        <div className={styles.permGrid}>
          {/* Header row */}
          <div className={styles.permGridHeader}>
            <span></span>
            {PERM_COLUMNS.map(c => <span key={c.key}>{c.label}</span>)}
          </div>

          {/* Role rows */}
          {editableRoles.map(role => (
            <div key={role.role_id} className={styles.permGridRow}>
              <span className={styles.permRoleLabel}>{role.role_name}</span>
              {PERM_COLUMNS.map(c => (
                <span key={c.key} className={styles.permCell}>
                  <input
                    type="checkbox"
                    className={styles.permCheckbox}
                    checked={permissions[role.role_id]?.[c.key] ?? false}
                    onChange={e => handlePermChange(role.role_id, c.key, e.target.checked)}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Edit Role Modal ── */}
      {editRoleId !== null && (
        <EditRoleModal
          roleId={editRoleId}
          onClose={() => setEditRoleId(null)}
          onSave={fetchRoles}
        />
      )}

      {/* ── Delete Confirmation ── */}
      <ConfirmModal
        isOpen={deleteRoleId !== null}
        onClose={() => { setDeleteRoleId(null); setDeleteError(''); }}
        onConfirm={handleDelete}
        title="Delete Role"
        message={
          deleteError
            ? deleteError
            : "Are you sure you want to delete this role? This cannot be undone."
        }
      />
    </div>
  );
}
