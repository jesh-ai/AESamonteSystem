/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from "react";
import styles from "@/css/settings.module.css";
import { AiOutlineUser } from "react-icons/ai";
import { FiEdit3 } from "react-icons/fi";
import { LuArchiveRestore, LuUserPlus, LuChevronLeft, LuArchive } from "react-icons/lu";
import AddEmployeeModal from "./addEmployeeModal";
import ConfirmModal from "./confirmModal";

interface User {
  id: number;
  name: string;
  role: string;
  role_id: number;
  email: string;
  contact: string;
  status: 'Active' | 'Inactive';
  status_id: number;
  status_code: string;
  is_archived: boolean;
}

export default function UserManagement({ onBack, currentRoleId, currentEmployeeId }: {
  onBack: () => void;
  currentRoleId?: number;
  currentEmployeeId?: number;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToArchive, setUserToArchive] = useState<number | null>(null);
  const [orderedRoleIds, setOrderedRoleIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Inline permission check — uses current prop values directly at render time ──
  const canEdit = (user: User): boolean => {
    const myId      = Number(currentEmployeeId);
    const theirId   = Number(user.id);
    const theirRole = Number(user.role_id);

    if (myId && myId === theirId) return true;   // self-edit: always first, no other checks needed
    if (theirRole === 1) return false;            // Super Admin: untouchable
    const myRole = Number(currentRoleId);
    if (!myRole || orderedRoleIds.length === 0) return false;
    const myIdx    = orderedRoleIds.indexOf(myRole);
    const theirIdx = orderedRoleIds.indexOf(theirRole);
    if (myIdx === -1) return false;
    if (myIdx >= orderedRoleIds.length - 2) return false; // Staff/Cashier: no others
    return myIdx < theirIdx;
  };

  const canArchive = (user: User): boolean => {
    const myId    = Number(currentEmployeeId);
    const theirId = Number(user.id);
    if (myId === theirId) return false;          // can't archive yourself
    return canEdit(user);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let map: Record<number, string> = { 1: 'Super Admin' };
      let ordered: number[] = [1];
      try {
        const rolesRes = await fetch('/api/roles?include_inactive=true');
        const rolesData = await rolesRes.json();
        if (Array.isArray(rolesData)) {
          rolesData.forEach((r: any) => {
            map[r.role_id] = r.role_name;
            ordered.push(r.role_id);
          });
        }
      } catch { /* keep seeds */ }
      setOrderedRoleIds(ordered);

      const response = await fetch(`/api/employees`);
      const data = await response.json();

      const active = data
        .filter((emp: any) => !emp.is_archived)
        .map((emp: any) => ({
          ...emp,
          role:   map[emp.role_id] ?? `Role ${emp.role_id}`,
          status: emp.status_code === 'ACTIVE' ? "Active" : "Inactive",
        }));

      const archived = data
        .filter((emp: any) => emp.is_archived)
        .map((emp: any) => ({
          ...emp,
          role:   map[emp.role_id] ?? `Role ${emp.role_id}`,
          status: "Inactive",
        }));

      setUsers(active);
      setArchivedUsers(archived);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initiateArchive = (id: number) => {
    setUserToArchive(id);
    setIsConfirmOpen(true);
  };

  const confirmArchive = async () => {
    if (!userToArchive) return;
    try {
      const url = `/api/employees/${userToArchive}?requester_role_id=${currentRoleId ?? 0}`;
      const response = await fetch(url, { method: "DELETE" });
      const data = await response.json();
      if (response.ok) {
        await fetchUsers();
        showToast('Employee archived successfully.', 'success');
      } else {
        showToast(data.error || 'Failed to archive employee.', 'error');
      }
    } catch (error) {
      console.error("Archive error:", error);
      showToast('Failed to archive employee.', 'error');
    } finally {
      setIsConfirmOpen(false);
      setUserToArchive(null);
    }
  };

  const restoreUser = async (id: number) => {
    try {
      const response = await fetch(`/api/employees/${id}/restore`, { method: "PUT" });
      if (response.ok) {
        await fetchUsers();
        showToast('Employee restored successfully.', 'success');
      } else {
        showToast('Failed to restore employee.', 'error');
      }
    } catch (error) {
      console.error("Restore error:", error);
      showToast('Failed to restore employee.', 'error');
    }
  };

  return (
    <div className={styles.settingsCard}>
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

      <div className={styles.settingsHeaderWrapper}>
        <button className={styles.backButton} onClick={onBack}>
          <LuChevronLeft /> Back
        </button>
        <div className={styles.titleGroup}>
          <div className={styles.iconWrapper}><AiOutlineUser /></div>
          <h2 className={styles.sectionLabel}>User Management</h2>
        </div>
      </div>

      <div className={styles.tabToggle}>
        <button className={`${styles.tabBtn} ${activeTab === "active" ? styles.tabActive : ""}`} onClick={() => setActiveTab("active")}>
          Users
        </button>
        <button className={`${styles.tabBtn} ${activeTab === "archived" ? styles.tabActive : ""}`} onClick={() => setActiveTab("archived")}>
          Archived Users
        </button>
      </div>

      <div className={styles.placeholderContainer}>
        <div className={styles.listHeader}>
          <span>Employee ID</span><span>Name</span><span>Role</span><span>Email</span><span>Status</span>
          <span style={{ textAlign: 'center' }}>Actions</span>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Loading users...</div>
        ) : activeTab === "active" ? (
          users.length === 0 ? (
            <div className={styles.loadingState}>No active users found.</div>
          ) : (
            users.map((user) => {
              const editable  = canEdit(user);
              const archivable = canArchive(user);
              return (
                <div key={user.id} className={styles.userPlaceholderRow}>
                  <span className={styles.userId}>{user.id}</span>
                  <span className={styles.userName}>{user.name}</span>
                  <span>{user.role}</span>
                  <span>{user.email}</span>
                  <span className={user.status === 'Active' ? styles.statusActive : styles.statusInactive}>
                    {user.status}
                  </span>
                  <div className={styles.actionGroup}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                      disabled={!editable}
                      title={!editable ? (user.role_id === 1 ? 'Super Admin cannot be modified' : 'Insufficient permissions') : 'Edit employee'}
                      style={!editable ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                    >
                      <FiEdit3 />
                    </button>
                    <button
                      className={styles.archBtn}
                      onClick={() => initiateArchive(user.id)}
                      disabled={!archivable}
                      title={!archivable ? 'Insufficient permissions' : user.status_code === 'ACTIVE' ? 'Set to Inactive before archiving' : 'Archive employee'}
                      style={!archivable ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                    >
                      <LuArchive />
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : (
          archivedUsers.length === 0 ? (
            <div className={styles.loadingState}>No archived users found.</div>
          ) : (
            archivedUsers.map((user) => (
              <div key={user.id} className={styles.userPlaceholderRow}>
                <span className={styles.userId}>{user.id}</span>
                <span className={styles.userName}>{user.name}</span>
                <span>{user.role}</span>
                <span>{user.email}</span>
                <span className={styles.statusInactive}>{user.status}</span>
                <div className={styles.actionGroup}>
                  <button className={styles.iconBtn} onClick={() => restoreUser(user.id)} title="Restore employee">
                    <LuArchiveRestore />
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {activeTab === "active" && (
        <button className={styles.createBtn} onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}>
          <LuUserPlus /> Create New Account
        </button>
      )}

      {isModalOpen && (
        <AddEmployeeModal
          onClose={() => setIsModalOpen(false)}
          onAdd={fetchUsers}
          employee={selectedUser}
          requesterRoleId={currentRoleId}
          requesterEmployeeId={currentEmployeeId}
          isSelf={Number(selectedUser?.id) === Number(currentEmployeeId)}
        />
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmArchive}
        title="Archive Employee?"
        message="Are you sure you want to archive this employee? This action cannot be undone."
        icon={<LuArchive style={{ fontSize: '2rem', color: '#ffffff' }} />}
        headerColor="#475569"
        confirmBtnColor="#475569"
      />
    </div>
  );
}
