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

interface SidebarProps {
  roleOrName: string;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ 
  roleOrName, 
  onLogout, 
  collapsed, 
  setCollapsed, 
  activeTab, 
  onTabChange 
}: SidebarProps) {
  
  const menuItems = [
    { name: "Dashboard", icon: <GoHome /> },
    { name: "Sales", icon: <GrLineChart /> },
    { name: "Inventory", icon: <MdOutlineInventory2 /> },
    { name: "Orders", icon: <PiShoppingBag /> },
    { name: "Reports", icon: <RiBarChart2Line /> },
    { name: "Settings", icon: <AiOutlineSetting /> },
  ];

  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.topSection}>
        <div className={styles.menuHeader}>
          {!collapsed ? (
            <>
              <span className={styles.menuTitle}></span>
              <button onClick={() => setCollapsed(true)} className={styles.toggleButton}>
                <IoArrowUndoCircleOutline size={24} />
              </button>
            </>
          ) : (
            <button onClick={() => setCollapsed(false)} className={styles.toggleButtonCollapsed}>
              <AiOutlineMenu size={24} />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className={styles.userInfo}>
            <div className={styles.avatar}><AiOutlineUser size={24} /></div>
            <span className={styles.roleName}>{roleOrName}</span>
          </div>
        )}

        <nav className={styles.navMenu}>
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => onTabChange(item.name)} // Switch the view
              className={`${styles.navItem} ${collapsed ? styles.collapsedItem : ""} ${
                activeTab === item.name ? styles.activeNavItem : ""
              }`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navText}>{item.name}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className={styles.bottomMenu}>
        <hr className={styles.divider} />
        <div className={styles.bottomNav}>
          <button className={styles.bottomButton} onClick={() => onTabChange("Help")}>
            <span className={styles.navIcon}><AiOutlineQuestionCircle size={20} /></span>
            {!collapsed && <span className={styles.navText}>Help</span>}
          </button>
          <button className={styles.bottomButton} onClick={onLogout}>
            <span className={styles.navIcon}><RiLogoutBoxRLine size={20} /></span>
            {!collapsed && <span className={styles.navText}>Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
}