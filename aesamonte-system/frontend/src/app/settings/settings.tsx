"use client";

import TopHeader from "@/components/layout/TopHeader";
import styles from "@/css/settings.module.css";
import { AiOutlineUser, AiOutlineSetting } from "react-icons/ai";
import { MdSecurity, MdBackup } from "react-icons/md";
import { HiOutlineAdjustmentsHorizontal } from "react-icons/hi2";

interface SettingsPageProps {
  role?: string;
  onLogout: () => void;
}

export default function SettingsPage({ role = "Admin", onLogout }: SettingsPageProps) {
  const configItems = [
    { title: "User Management", icon: <AiOutlineUser /> },
    { title: "Access Control", icon: <HiOutlineAdjustmentsHorizontal /> },
    { title: "App Preferences", icon: <AiOutlineSetting /> },
    { title: "Back Up and Restore Data", icon: <MdBackup /> },
  ];

  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <main className={styles.mainContent}>
        <div className={styles.settingsCard}>
          <h3 className={styles.pageTitle}>Controls & Configurations</h3>
          
          <div className={styles.configList}>
            {configItems.map((item) => (
              <button key={item.title} className={styles.configItem}>
                <div className={styles.iconWrapper}>
                  {item.icon}
                </div>
                <span className={styles.itemTitle}>{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}