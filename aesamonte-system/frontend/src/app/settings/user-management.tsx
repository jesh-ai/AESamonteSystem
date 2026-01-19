'use client';

import styles from "@/css/settings.module.css";
import { AiOutlineUser } from "react-icons/ai";
import { FiEdit3 } from "react-icons/fi";
import { LuArrowLeft, LuTrash2, LuUserPlus } from "react-icons/lu";
import SettingsHeader from "@/components/layout/BackSettingsHeader";

interface User {
  name: string;
  role: string;
  contact: string;
  email: string;
  status: 'Active' | 'Inactive';
}

export default function UserManagement({ onBack }: { onBack: () => void }) {
    //Placeholder for table
  const placeholderUsers = [
    { name: "Alain Samonte", role: "Admin", email: "allain.s@gmail.com", status: "Active" },
    { name: "Kristine Samonte", role: "Manager", email: "Krstn.S@gmail.com", status: "Active" },
    { name: "Heidi Legazpi", role: "Staff", email: "HeidiLez@gmail.com", status: "Inactive" },
  ];

  return (
    <div className={styles.settingsCard}>
      {/* Reusable Header Component */}
      <SettingsHeader 
        title="User Management" 
        icon={<AiOutlineUser />} 
        onBack={onBack} 
      />

      <div className={styles.placeholderContainer}>
        {/* Simplified Header for the list */}
        <div className={styles.listHeader}>
          <span>Name</span>
          <span>Role</span>
          <span>Email</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {/* Mapped Placeholder Rows */}
        {placeholderUsers.map((user, index) => (
          <div key={index} className={styles.userPlaceholderRow}>
            <span className={styles.userName}>{user.name}</span>
            <span>{user.role}</span>
            <span className={styles.userEmail}>{user.email}</span>
            <span className={user.status === 'Active' ? styles.statusActive : styles.statusInactive}>
              {user.status}
            </span>
            <div className={styles.actionGroup}>
              <button className={styles.iconBtn}><FiEdit3 /></button>
              <button className={`${styles.iconBtn} ${styles.delete}`}><LuTrash2 /></button>
            </div>
          </div>
        ))}
      </div>

      <button className={styles.createBtn}>
        <LuUserPlus /> <span>Create New Account</span>
      </button>
    </div>
  );
}