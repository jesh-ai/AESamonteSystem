'use client';

import React from "react";
import {
  AiOutlineUser,
  AiOutlineSetting,
  AiOutlineQuestionCircle,
  AiOutlineMenu,
} from "react-icons/ai";
import { GoHome } from "react-icons/go";
import { GrLineChart } from "react-icons/gr";
import { MdOutlineInventory2 } from "react-icons/md";
import { PiShoppingBag } from "react-icons/pi";
import { RiBarChart2Line, RiLogoutBoxRLine } from "react-icons/ri";
import { IoArrowUndoCircleOutline } from "react-icons/io5";
import styles from "@/css/sidenavbar.module.css";

// Interface updated to match SidebarProps used in your return structure
interface SidebarProps {
  roleOrName: string; // This will receive the user's name/role from auth.tsx
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
}

export default function Sidebar({ roleOrName, onLogout, collapsed, setCollapsed }: SidebarProps) {
  const menuItems = [
    { name: "Dashboard", icon: <GoHome size={20} /> },
    { name: "Sales", icon: <GrLineChart size={20} /> },
    { name: "Inventory", icon: <MdOutlineInventory2 size={20} /> },
    { name: "Orders", icon: <PiShoppingBag size={20} /> },
    { name: "Reports", icon: <RiBarChart2Line size={20} /> },
    { name: "Settings", icon: <AiOutlineSetting size={20} /> },
  ];

  const bottomItems = [
    { name: "Help", icon: <AiOutlineQuestionCircle size={20} /> },
    { name: "Logout", icon: <RiLogoutBoxRLine size={20} />, onClick: onLogout },
  ];

  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      {/* ===== Top: Menu Toggle + User Info ===== */}
      <div className={styles.topSection}>
        {/* Toggle */}
        <div className={styles.menuHeader}>
          {!collapsed ? (
            <>
              <span className={styles.menuTitle}></span>
              <button
                onClick={() => setCollapsed(true)}
                className={styles.toggleButton}
              >
                <IoArrowUndoCircleOutline size={24} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className={styles.toggleButtonCollapsed}
            >
              <AiOutlineMenu size={24} />
            </button>
          )}
        </div>

        {/* User Info - Populated based on mockUsers in auth.tsx */}
        {!collapsed && (
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              <AiOutlineUser size={24} />
            </div>
            <span className={styles.roleName}>{roleOrName}</span>
          </div>
        )}

        {/* ===== Menu Items ===== */}
        <nav className={styles.navMenu}>
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`${styles.navItem} ${collapsed ? styles.collapsedItem : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navText}>{item.name}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* ===== Bottom Section ===== */}
      <div className={styles.bottomMenu}>
        <hr className={styles.divider} />
        <div className={styles.bottomNav}>
          {bottomItems.map((item) => (
            <button
              key={item.name}
              onClick={item.onClick}
              className={`${styles.bottomButton} ${item.name === "Logout" ? styles.logoutBtn : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navText}>{item.name}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}