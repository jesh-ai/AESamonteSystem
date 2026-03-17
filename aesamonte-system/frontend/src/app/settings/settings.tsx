"use client";

import { useState } from "react";
import TopHeader from "@/components/layout/TopHeader";
import UserManagement from "./user-management";
import styles from "@/css/settings.module.css";
import { AiOutlineUser } from "react-icons/ai";
import { LuShieldCheck, LuLayoutTemplate, LuDatabaseBackup, LuKeyRound } from "react-icons/lu";
import { LuClipboardList } from "react-icons/lu";
import AccessControl from "./access-control";
import GeneralSettings from "./general-settings";
import BackupRestore from "./backup-restore";
import AuditLog from "./audit-log";
import ChangePasswordModal from "./ChangePasswordModal";

interface SettingsPageProps {
  role?: string;
  employeeId?: number;
  onLogout: () => void;
}

export default function SettingsPage({ role = "Admin", employeeId, onLogout }: SettingsPageProps) {
  const [activeView, setActiveView] = useState<"main" | "users" | "access" | "appPreferences" | "backupRestore" | "auditlog">("main");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const isAdmin = role === "Admin";
  const isManagerOrHead = role === "Manager" || role === "Head";

  const allConfigItems = [
    {
      title: "User Management",
      icon: <AiOutlineUser />,
      action: () => setActiveView("users"),
      show: isAdmin,
    },
    {
      title: "Access Control",
      icon: <LuShieldCheck />,
      action: () => setActiveView("access"),
      show: isAdmin,
    },
    {
      title: "App Preferences",
      icon: <LuLayoutTemplate />,
      action: () => setActiveView("appPreferences"),
      show: true,  // all roles with settings access can see this
    },
    {
      title: "Back Up and Restore Data",
      icon: <LuDatabaseBackup />,
      action: () => setActiveView("backupRestore"),
      show: isAdmin || isManagerOrHead,
    },
    {
      title: "Audit Log",
      icon: <LuClipboardList />,
      action: () => setActiveView("auditlog"),
      show: isAdmin,
    },
    {
      title: "Change Password",
      icon: <LuKeyRound />,
      action: () => setShowChangePassword(true),
      show: true,
    },
  ];

  const configItems = allConfigItems.filter(item => item.show);

  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />
      <main className={styles.mainContent}>
        {activeView === "main" && (
          <div className={styles.settingsCard}>
            <h3 className={styles.pageTitle}>Controls & Configurations</h3>
            <div className={styles.configList}>
              {configItems.map((item) => (
                <button
                  key={item.title}
                  className={styles.configItem}
                  onClick={item.action}
                >
                  <div className={styles.iconBox}>{item.icon}</div>
                  <span className={styles.itemTitle}>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeView === "users" && (
          <UserManagement onBack={() => setActiveView("main")} />
        )}

        {activeView === "access" && (
          <AccessControl onBack={() => setActiveView("main")} />
        )}

        {activeView === "appPreferences" && (
          <GeneralSettings onBack={() => setActiveView("main")} />
        )}

        {activeView === "backupRestore" && (
          <BackupRestore onBack={() => setActiveView("main")} />
        )}

        {activeView === "auditlog" && (
          <AuditLog onBack={() => setActiveView("main")} onLogout={onLogout} />
        )}
      </main>
    </div>
  );
}
