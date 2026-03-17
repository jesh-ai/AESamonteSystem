/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from "react";
import styles from "@/css/settings.module.css";
import { MdTune } from "react-icons/md";
import { FiEdit3 } from "react-icons/fi";
import { LuTrash2, LuPlus } from "react-icons/lu";
import SettingsHeader from "@/components/layout/BackSettingsHeader";
import ConfirmModal from "./confirmModal";
import EditRoleModal from "./EditRoleModal";
import AddRoleModal from "./AddRoleModal";

interface Role {
  role_id: number;
  role_name: string;
  is_active: boolean;
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

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function AccessControl({ onBack }: { onBack: () => void }) {
  const [roles, setRoles] = useState<Role[]>([]);

  // Modals
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Delete confirmation
  const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null);

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const json = await res.json();
      setRoles(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("Failed to fetch roles", err);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleDelete = async () => {
    if (!deleteRoleId) return;
    setDeleteRoleId(null);
    try {
      const res = await fetch(`/api/roles/${deleteRoleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to delete role.', 'error');
        return;
      }
      fetchRoles();
      showToast('Role deleted successfully.', 'success');
    } catch {
      showToast('Failed to delete role.', 'error');
    }
  };

  // Exclude Admin role (role_id === 1)
  const visibleRoles = roles.filter(r => r.role_id !== 1);

  return (
    <div className={styles.settingsCard}>
      <SettingsHeader title="Access Control" icon={<MdTune />} onBack={onBack} />

      {/* ── Toast Notification ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          background: toast.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.9rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 9999,
          transition: 'opacity 0.3s',
        }}>
          {toast.message}
        </div>
      )}

      {/* ── User Roles Table ── */}
      <div className={styles.placeholderContainer}>
        <h3 className={styles.sectionLabel} style={{ marginBottom: '1rem' }}>User Roles</h3>

        <div className={styles.accessHeader}>
          <span>Role Name</span>
          <span>Description</span>
          <span>User Assigned</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {visibleRoles.map(role => (
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
                onClick={() => setDeleteRoleId(role.role_id)}
              >
                <LuTrash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}

        <button
          className={styles.createBtn}
          onClick={() => setShowAddModal(true)}
        >
          <LuPlus size={16} /> Create New Role
        </button>
      </div>

      {/* ── Edit Role Modal ── */}
      {editRoleId !== null && (
        <EditRoleModal
          roleId={editRoleId}
          onClose={() => setEditRoleId(null)}
          onSave={() => {
            fetchRoles();
            showToast('Role updated successfully.', 'success');
          }}
        />
      )}

      {/* ── Add Role Modal ── */}
      {showAddModal && (
        <AddRoleModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            fetchRoles();
            showToast('Role created successfully.', 'success');
          }}
          onError={(msg: string) => showToast(msg, 'error')}
        />
      )}

      {/* ── Delete Confirmation ── */}
      <ConfirmModal
        isOpen={deleteRoleId !== null}
        onClose={() => setDeleteRoleId(null)}
        onConfirm={handleDelete}
        title="Delete Role"
        message="Are you sure you want to delete this role? This cannot be undone."
      />
    </div>
  );
}
