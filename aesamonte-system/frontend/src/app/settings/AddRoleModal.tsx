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

const DEFAULT_PERM: GranularPerm = { can_view: false, can_create: false, can_edit: false, can_archive: false, can_export: false };

function initPerms(): Record<string, GranularPerm> {
  const p: Record<string, GranularPerm> = {};
  MODULES.forEach(m => { p[m.key] = { ...DEFAULT_PERM }; });
  return p;
}

export default function AddRoleModal({
  onClose,
  onSave,
  onError,
}: {
  onClose: () => void;
  onSave: () => void;
  onError: (message: string) => void;
}) {
  const [roleName, setRoleName]       = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive]       = useState(true);
  const [perms, setPerms]             = useState<Record<string, GranularPerm>>(initPerms());
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const togglePerm = (module: string, action: keyof GranularPerm, value: boolean) => {
    setPerms(prev => ({ ...prev, [module]: { ...prev[module], [action]: value } }));
  };

  const toggleRow = (module: string) => {
    const allOn = ACTIONS.every(a => perms[module]?.[a.key]);
    const next: GranularPerm = { can_view: !allOn, can_create: !allOn, can_edit: !allOn, can_archive: !allOn };
    setPerms(prev => ({ ...prev, [module]: next }));
  };

  const handleCreate = async () => {
    if (!roleName.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_name: roleName, description, is_active: isActive, granular_permissions: perms }),
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
              <div className={styles.field}>
                <label>Status</label>
                <div className={styles.toggleRow}>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                    <span className={styles.slider} />
                  </label>
                  <span className={isActive ? styles.statusOn : styles.statusOff}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
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
                const mp = perms[m.key] ?? { ...DEFAULT_PERM };
                const allOn = ACTIONS.every(a => mp[a.key]);
                return (
                  <div key={m.key} className={styles.matrixRow}>
                    <span className={styles.moduleCol}>{m.label}</span>
                    {ACTIONS.map(a => (
                      <span key={a.key} className={styles.checkCell}>
                        <input
                          type="checkbox"
                          className={styles.permCheck}
                          checked={mp[a.key]}
                          onChange={e => togglePerm(m.key, a.key, e.target.checked)}
                        />
                      </span>
                    ))}
                    <span className={styles.checkCell}>
                      <input
                        type="checkbox"
                        className={styles.permCheck}
                        checked={allOn}
                        onChange={() => toggleRow(m.key)}
                        title="Toggle all"
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
