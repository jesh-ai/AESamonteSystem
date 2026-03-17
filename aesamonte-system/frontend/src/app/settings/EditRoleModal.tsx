/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from "react";
import styles from "@/css/editRoleModal.module.css";
import { LuX, LuUserMinus, LuSearch } from "react-icons/lu";

interface GranularPerm {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_archive: boolean;
  can_export: boolean;
}

interface AssignedUser {
  employee_id: number;
  employee_name: string;
  employee_email: string;
}

interface RoleDetail {
  role_id: number;
  role_name: string;
  description: string;
  is_active: boolean;
  granular_permissions: Record<string, GranularPerm>;
  assigned_users: AssignedUser[];
}

interface Employee {
  id: number;
  name: string;
  email: string;
  role_id: number;
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

export default function EditRoleModal({
  roleId,
  onClose,
  onSave,
}: {
  roleId: number;
  onClose: () => void;
  onSave: () => void;
}) {
  const [loading, setLoading]         = useState(true);
  const [roleName, setRoleName]       = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive]       = useState(true);
  const [perms, setPerms]             = useState<Record<string, GranularPerm>>({});
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [allEmployees, setAllEmployees]   = useState<Employee[]>([]);
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [roleRes, empRes] = await Promise.all([
          fetch(`https://ae-samonte-system.onrender.com/api/roles/${roleId}`),
          fetch('https://ae-samonte-system.onrender.com/api/employees'),
        ]);
        const roleData: RoleDetail = await roleRes.json();
        const empData: Employee[]  = await empRes.json();

        setRoleName(roleData.role_name);
        setDescription(roleData.description || '');
        setIsActive(roleData.is_active ?? true);
        setAssignedUsers(roleData.assigned_users || []);
        setAllEmployees(empData);

        const init: Record<string, GranularPerm> = {};
        MODULES.forEach(m => {
          init[m.key] = roleData.granular_permissions?.[m.key] ?? { ...DEFAULT_PERM };
        });
        setPerms(init);
      } catch {
        setError('Failed to load role data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [roleId]);

  const togglePerm = (module: string, action: keyof GranularPerm, value: boolean) => {
    setPerms(prev => ({ ...prev, [module]: { ...prev[module], [action]: value } }));
  };

  const toggleRow = (module: string) => {
    const allOn = ACTIONS.every(a => perms[module]?.[a.key]);
    const next: GranularPerm = { can_view: !allOn, can_create: !allOn, can_edit: !allOn, can_archive: !allOn, can_export: !allOn };
    setPerms(prev => ({ ...prev, [module]: next }));
  };

  const handleAssign = async (emp: Employee) => {
    try {
      const res = await fetch(`https://ae-samonte-system.onrender.com/api/roles/${roleId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: emp.id }),
      });
      if (res.ok) {
        setAssignedUsers(prev => [...prev, { employee_id: emp.id, employee_name: emp.name, employee_email: emp.email }]);
        setSearch('');
      }
    } catch {
      setError('Failed to assign user.');
    }
  };

  const handleUnassign = async (empId: number) => {
    try {
      const res = await fetch(`https://ae-samonte-system.onrender.com/api/roles/${roleId}/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empId }),
      });
      
      // If Flask returns a 404 or 500 HTML page, this stops it from trying to parse it as JSON
      if (!res.ok) {
        const text = await res.text();
        // If it's an HTML error page, show a generic error. If it's our JSON error, parse it.
        const errMsg = text.startsWith('<') ? 'Route not found or server error' : JSON.parse(text).error;
        setError(`Backend Error: ${errMsg}`);
        return;
      }

      // If it IS ok, safely parse the JSON
      const data = await res.json();
      setAssignedUsers(prev => prev.filter(u => u.employee_id !== empId));
      
    } catch (err: any) {
      setError(`Network Error: ${err.message || 'Check if Flask is running'}`);
    }
  };

  const handleSave = async () => {
    if (!roleName.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`https://ae-samonte-system.onrender.com/api/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_name: roleName, description, is_active: isActive, granular_permissions: perms }),
      });
      const data = await res.json();
      if (res.ok) { onSave(); onClose(); }
      else setError(data.error || 'Failed to save.');
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const assignedIds = new Set(assignedUsers.map(u => u.employee_id));
  const searchResults = search.length >= 2
    ? allEmployees.filter(e => !assignedIds.has(e.id) && e.name?.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div>
            <p className={styles.headerSub}>Access Control</p>
            <h2 className={styles.headerTitle}>Role Configuration</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><LuX size={20} /></button>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>
          {loading ? (
            <p className={styles.loadingMsg}>Loading role data...</p>
          ) : (
            <>
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

              {/* 3. Assignment */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionNum}>3</span> User Assignments
                </h3>

                {/* Search */}
                <div className={styles.searchWrapper}>
                  <LuSearch className={styles.searchIcon} size={15} />
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search employees to assign (type at least 2 chars)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className={styles.searchDropdown}>
                    {searchResults.map(emp => (
                      <div key={emp.id} className={styles.searchItem} onClick={() => handleAssign(emp)}>
                        <div className={styles.empAvatar}>{emp.name?.charAt(0).toUpperCase()}</div>
                        <div className={styles.empInfo}>
                          <span className={styles.empName}>{emp.name}</span>
                          <span className={styles.empEmail}>{emp.email}</span>
                        </div>
                        <span className={styles.assignTag}>+ Assign</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assigned list */}
                <div className={styles.userList}>
                  {assignedUsers.length === 0 ? (
                    <p className={styles.emptyMsg}>No users currently assigned to this role.</p>
                  ) : (
                    assignedUsers.map(u => (
                      <div key={u.employee_id} className={styles.userItem}>
                        <div className={styles.userAvatar}>{u.employee_name?.charAt(0).toUpperCase()}</div>
                        <div className={styles.userInfo}>
                          <span className={styles.userName}>{u.employee_name}</span>
                          <span className={styles.userEmail}>{u.employee_email}</span>
                        </div>
                        <div 
                          className={styles.removeTip} 
                          title="Remove user from this role"
                          onClick={() => handleUnassign(u.employee_id)}
                          style={{ cursor: 'pointer', color: '#dc2626' }}
                        >
                          <LuUserMinus size={16} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
