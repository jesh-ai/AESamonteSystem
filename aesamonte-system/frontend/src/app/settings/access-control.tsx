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
  const placeholderRoles = [
    { name: "Admin", description: "Full Access", assigned: "1", status: "Active", },
    { name: "Manager", description: "Full Access", assigned: "1", status: "Active" },
    { name: "Head", description: "Full Access", assigned: "3", status: "Inactive" },
    { name: "Staff", description: "Full Access", assigned: "3", status: "Inactive" },
  ];

  return (
    <div className={styles.settingsCard}>
      {/* Reusable Header Component */}
      <SettingsHeader 
        title="Access Control" 
        icon={<AiOutlineUser />} 
        onBack={onBack} 
      />

      <div className={styles.placeholderContainer}>
        <h3 className={styles.sectionLabel}>User Roles</h3>
        
        {/* Table Header */}
        <div className={styles.listHeader}>
          <span>Role Name</span>
          <span>Description</span>
          <span>User Assigned</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {/* Placeholder List Rows */}
        {placeholderRoles.map((role, index) => (
          <div key={index} className={styles.userPlaceholderRow}>
            <span className={styles.roleName}>{role.name}</span>
            <span>{role.description}</span>
            <span>{role.assigned}</span>
            <span className={role.status === 'Active' ? styles.statusActive : styles.statusInactive}>
              {role.status}
            </span>
            <div className={styles.actionGroup}>
              <button className={styles.iconBtn}><FiEdit3 /></button>
              <button className={`${styles.iconBtn} ${styles.delete}`}><LuTrash2 /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions Section Placeholder */}
      <div className={styles.permissionsContainer}>
        <div className={styles.flexHeader}>
          <h3 className={styles.sectionLabel}>Permissions</h3>
          <button className={styles.compactSaveBtn}>SAVE</button>
        </div>
        <div className={styles.permissionPlaceholder}>
          [ Interactive Permission Checkbox Grid Placeholder ]
        </div>
      </div>
    </div>
  );
}