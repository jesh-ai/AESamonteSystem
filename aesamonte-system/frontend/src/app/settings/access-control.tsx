/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from "react";
import styles from "@/css/settings.module.css";
import { MdTune } from "react-icons/md";
import { FiEdit3 } from "react-icons/fi";
import { LuArchive, LuArchiveRestore, LuPlus } from "react-icons/lu";
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

export default function AccessControl({
  onBack,
  currentUserRole = 'Admin',
}: {
  onBack: () => void;
  currentUserRole?: string;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [archivedRoles, setArchivedRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiveRoleId, setArchiveRoleId] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

const fetchRoles = async () => {
  try {
    const [activeRes, archivedRes] = await Promise.all([
      fetch('/api/roles'),
      fetch('/api/roles/archived')
    ]);

    const activeText = await activeRes.text();
    const archivedText = await archivedRes.text();

    let activeJson = [];
    let archivedJson = [];

    try { activeJson = JSON.parse(activeText); } catch { console.error("Bad JSON from /api/roles:", activeText); }
    try { archivedJson = JSON.parse(archivedText); } catch { console.error("Bad JSON from /api/roles/archived:", archivedText); }

    setRoles(Array.isArray(activeJson) ? activeJson : []);
    setArchivedRoles(Array.isArray(archivedJson) ? archivedJson : []);
  } catch (err) {
    console.error("Failed to fetch roles", err);
  }
};

  useEffect(() => { fetchRoles(); }, []);

  const handleArchive = async () => {
    if (!archiveRoleId) return;
    setArchiveRoleId(null);
    try {
      const res = await fetch(`/api/roles/${archiveRoleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to archive role.', 'error');
        return;
      }
      await fetchRoles();
      showToast('Role archived successfully.', 'success');
    } catch {
      showToast('Failed to archive role.', 'error');
    }
  };
// ADD after handleArchive function:
const restoreRole = async (id: number) => {
  try {
    const res = await fetch(`/api/roles/${id}/restore`, { method: "PUT" });
    if (res.ok) {
      await fetchRoles();
      showToast('Role restored successfully.', 'success');
    }
  } catch {
    showToast('Failed to restore role.', 'error');
  }
};
  return (
    <div className={styles.settingsCard}>
      <SettingsHeader title="Access Control" icon={<MdTune />} onBack={onBack} />

      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: toast.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white', padding: '12px 20px', borderRadius: '8px',
          fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999,
        }}>
          {toast.message}
        </div>
      )}

      {/* Tab Toggle */}
      <div className={styles.tabToggle}>
        <button
          className={`${styles.tabBtn} ${activeTab === "active" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("active")}
        >
          Roles
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "archived" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("archived")}
        >
          Archived Roles
        </button>
      </div>

      <div className={styles.placeholderContainer}>
        <h3 className={styles.sectionLabel} style={{ marginBottom: '1rem' }}>User Roles</h3>

        <div className={styles.accessHeader}>
          <span>Role Name</span>
          <span>Description</span>
          <span>User Assigned</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {activeTab === "active" ? (
          roles.length === 0 ? (
            <div className={styles.loadingState}>No active roles found.</div>
          ) : (
            roles.map(role => (
              <div key={role.role_id} className={styles.accessRow}>
                <span className={styles.roleName}>{role.role_name}</span>
                <span>{getDescription(role)}</span>
                <span>{role.user_count}</span>
                <span className={role.is_active && role.user_count > 0 ? styles.statusActive : styles.statusInactive}>
                  {role.is_active && role.user_count > 0 ? 'Active' : 'Inactive'}
                </span>
                <div className={styles.actionGroup}>
                  <button
                    className={styles.editBtn}
                    onClick={() => setEditRoleId(role.role_id)}
                    disabled={role.role_id === 1 || role.role_id === 2}
                    title={role.role_id === 1 ? 'Super Admin cannot be edited' : role.role_id === 2 ? 'Admin cannot be edited' : undefined}
                    style={role.role_id === 1 || role.role_id === 2 ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                  >
                    <FiEdit3 size={13} /> Edit
                  </button>
                  <button
                  className={styles.deleteBtn}
                  onClick={() => setArchiveRoleId(role.role_id)}
                  disabled={role.role_id === 1 || role.role_id === 2 || role.user_count > 0}
                  title={
                    role.role_id === 1 ? 'Super Admin cannot be archived' :
                    role.role_id === 2 ? 'Admin cannot be archived' :
                    role.user_count > 0 ? 'Cannot archive: role has active employees' :
                    undefined
                  }
                  style={role.role_id === 1 || role.role_id === 2 || role.user_count > 0 ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                >
                  <LuArchive size={13} /> Archive
                </button>
                </div>
              </div>
            ))
          )
        ) : (
          archivedRoles.length === 0 ? (
            <div className={styles.loadingState}>No archived roles found.</div>
          ) : (
            archivedRoles.map(role => (
            <div key={role.role_id} className={styles.accessRow}>
              <span className={styles.roleName}>{role.role_name}</span>
              <span>{getDescription(role)}</span>
              <span>{role.user_count}</span>
              <span className={styles.statusInactive}>Archived</span>
              <div className={styles.actionGroup}>
                <button
                  className={styles.editBtn}
                  onClick={() => restoreRole(role.role_id)}
                  title="Restore role"
                >
                  <LuArchiveRestore size={13} /> Restore
                </button>
              </div>
            </div>
          ))
          )
        )}

        {activeTab === "active" && (
          <button className={styles.createBtn} onClick={() => setShowAddModal(true)}>
            <LuPlus size={16} /> Create New Role
          </button>
        )}
      </div>

      {editRoleId !== null && (
        <EditRoleModal
          roleId={editRoleId}
          currentUserRole={currentUserRole}
          onClose={() => setEditRoleId(null)}
          onSave={() => { fetchRoles(); showToast('Role updated successfully.', 'success'); }}
        />
      )}

      {showAddModal && (
        <AddRoleModal
          currentUserRole={currentUserRole}
          onClose={() => setShowAddModal(false)}
          onSave={() => { fetchRoles(); showToast('Role created successfully.', 'success'); }}
          onError={(msg: string) => showToast(msg, 'error')}
        />
      )}

      <ConfirmModal
        isOpen={archiveRoleId !== null}
        onClose={() => setArchiveRoleId(null)}
        onConfirm={handleArchive}
        title="Archive Role?"
        message="Are you sure you want to archive this role? This action cannot be undone."
        icon={<LuArchive style={{ fontSize: '2rem', color: '#ffffff' }} />}
        headerColor="#475569"
        confirmBtnColor="#475569"
      />
    </div>
  );
}