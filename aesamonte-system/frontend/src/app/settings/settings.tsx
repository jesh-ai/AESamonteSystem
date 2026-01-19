"use client";

import { useState } from "react";
import TopHeader from "@/components/layout/TopHeader";
import SettingsHeader from "@/components/layout/BackSettingsHeader";
import UserManagement from "./user-management"; // Create this file next
import styles from "@/css/settings.module.css";
import { AiOutlineUser } from "react-icons/ai";
import { LuShieldCheck, LuLayoutTemplate, LuDatabaseBackup } from "react-icons/lu";
import AccessControl from "./access-control"
import AppPreferences from "./app-preferences";
import BackupRestore from "./backup-restore";

interface SettingsPageProps {
  role?: string;
  onLogout: () => void;
}

export default function SettingsPage({ role = "Admin", onLogout }: SettingsPageProps) {
  const [activeView, setActiveView] = useState<"main" | "users"| "access"| "appPreferences" | "backupRestore">("main");

  const configItems = [
    { 
      title: "User Management", 
      icon: <AiOutlineUser />, 
      action: () => setActiveView("users"),
    },
    { title: "Access Control", icon: <LuShieldCheck />, 
      action: () => setActiveView("access"),
    },
    { title: "App Preferences", icon: <LuLayoutTemplate />, 
      action: () => setActiveView("appPreferences"),
    },
    { title: "Back Up and Restore Data", icon: <LuDatabaseBackup />, 
      action: () => setActiveView("backupRestore"),
    },
  ];

  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <main className={styles.mainContent}>
        {activeView === "main" ? (
          <div className={styles.settingsCard}>
            <h3 className={styles.pageTitle}>Controls & Configurations</h3>
            <div className={styles.configList}>
              {configItems.map((item) => (
                <button 
                  key={item.title} 
                  className={styles.configItem} 
                  onClick={item.action}
                >
                  <div className={styles.iconBox}>
                    {item.icon}
                  </div>
                  <span className={styles.itemTitle}>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : activeView === "users" ? (
          <UserManagement onBack={() => setActiveView("main")} />
        ) : activeView === "access" ? (
          <AccessControl onBack={() => setActiveView("main")} />
        ) : activeView === "appPreferences"? (
          <AppPreferences onBack={() => setActiveView("main")} />
        ) : (
          <BackupRestore onBack={() => setActiveView("main")} />
        )}
      </main>
    </div>
  );
}