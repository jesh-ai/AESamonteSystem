/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from "react";
import styles from "@/css/settings.module.css";
import { AiOutlineUser } from "react-icons/ai";
import { FiEdit3 } from "react-icons/fi";
import { LuTrash2, LuUserPlus, LuChevronLeft } from "react-icons/lu";
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
}

export default function UserManagement({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [roleMap, setRoleMap] = useState<Record<number, string>>({});

  const fetchUsers = async (map: Record<number, string> = roleMap) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/employees`);
      const data = await response.json();
      const formattedUsers = data
        .filter((emp: any) => emp.status_id !== 10)
        .map((emp: any) => ({
          ...emp,
          role: map[emp.role_id] ?? `Role ${emp.role_id}`,
          status: emp.status_id === 9 ? "Active" : "Inactive"
        }));
      setUsers(formattedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/roles')
      .then(r => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const map: Record<number, string> = {};
        data.forEach(r => { map[r.role_id] = r.role_name; });
        setRoleMap(map);
        fetchUsers(map);
      })
      .catch(() => fetchUsers({}));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initiateDelete = (id: number) => {
    setUserToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      // Calls the Soft Delete backend
      const response = await fetch(`/api/employees/${userToDelete}`, {
        method: "DELETE" 
      });

      if (response.ok) {
        // Manually filter local state for instant removal
        setUsers(prev => prev.filter(user => user.id !== userToDelete));
      }
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  return (
    <div className={styles.settingsCard}>
      <div className={styles.settingsHeaderWrapper}>
        <button className={styles.backButton} onClick={onBack}>
          <LuChevronLeft /> Back
        </button>
        <div className={styles.titleGroup}>
          <div className={styles.iconWrapper}><AiOutlineUser /></div>
          <h2 className={styles.sectionLabel}>User Management</h2>
        </div>
      </div>

      <div className={styles.placeholderContainer}>
        <div className={styles.listHeader}>
          <span>Employee ID</span><span>Name</span><span>Role</span><span>Email</span><span>Status</span><span style={{ textAlign: 'center' }}>Actions</span>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Loading users...</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className={styles.userPlaceholderRow}>
              <span className={styles.userId}>{user.id}</span>
              <span className={styles.userName}>{user.name}</span>
              <span>{user.role}</span>
              <span>{user.email}</span>
              <span className={user.status === 'Active' ? styles.statusActive : styles.statusInactive}>
                {user.status}
              </span>
              <div className={styles.actionGroup}>
                <button className={styles.iconBtn} onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}><FiEdit3 /></button>
                <button className={`${styles.iconBtn} ${styles.delete}`} onClick={() => initiateDelete(user.id)}><LuTrash2 /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <button className={styles.createBtn} onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}>
        <LuUserPlus /> Create New Account
      </button>

      {isModalOpen && <AddEmployeeModal onClose={() => setIsModalOpen(false)} onAdd={fetchUsers} employee={selectedUser} />}
      
      <ConfirmModal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={confirmDelete} 
        title="Warning!" 
        message="Are you sure you want to delete this employee? This action cannot be undone." 
      />
    </div>
  );
}