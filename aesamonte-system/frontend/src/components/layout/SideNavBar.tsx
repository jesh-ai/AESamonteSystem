'use client';

import React, { useState, useEffect } from "react";
import {
  AiOutlineUser,
  AiOutlineSetting,
  AiOutlineQuestionCircle,
  AiOutlineMenu,
} from "react-icons/ai";
import { GoHome } from "react-icons/go";
import { GrLineChart } from "react-icons/gr";
import { MdOutlineInventory } from "react-icons/md";
import { PiShoppingBag } from "react-icons/pi";
import { BsPeople } from "react-icons/bs";
import { RiBarChart2Line, RiLogoutBoxRLine } from "react-icons/ri";
import { IoCloseCircleOutline } from "react-icons/io5";
import styles from "@/css/sidenavbar.module.css";
import type { UserInfo } from "@/types/user";

import LogoutModal from "@/components/logout/logout";

interface SidebarProps {
  userInfo: UserInfo;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({
  userInfo,
  onLogout,
  collapsed,
  setCollapsed,
  activeTab,
  onTabChange
}: SidebarProps) {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const { permissions } = userInfo;

  useEffect(() => {
    const key = `profilePicture_${userInfo.employeeId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) setProfilePic(stored);
    } catch { /* ignore */ }

    const handlePfpUpdate = () => {
      try { setProfilePic(localStorage.getItem(key) ?? null); } catch { /* ignore */ }
    };
    window.addEventListener('pfp:updated', handlePfpUpdate);
    return () => window.removeEventListener('pfp:updated', handlePfpUpdate);
  }, [userInfo.employeeId]);

  const allMenuItems = [
    { name: "Dashboard",  icon: <GoHome />,             show: true },
    { name: "Sales",      icon: <GrLineChart />,        show: !!permissions.sales?.can_view },
    { name: "Inventory",  icon: <MdOutlineInventory />, show: !!permissions.inventory?.can_view },
    { name: "Orders",     icon: <PiShoppingBag />,      show: !!permissions.orders?.can_view },
    { name: "Suppliers",  icon: <BsPeople />,           show: !!permissions.supplier?.can_view },
    { name: "Reports",    icon: <RiBarChart2Line />,    show: !!permissions.reports?.can_view },
    { name: "Settings",   icon: <AiOutlineSetting />,   show: !!permissions.settings?.can_view },
  ];

  const menuItems = allMenuItems.filter(item => item.show);

  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.topSection}>
        <div className={styles.menuHeader}>
          {!collapsed ? (
            <>
              <span className={styles.menuTitle}></span>
              <button onClick={() => setCollapsed(true)} className={styles.toggleButton}>
                <IoCloseCircleOutline size={24} />
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
            <div className={styles.avatar}>
              {profilePic
                ? <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <AiOutlineUser size={24} />}
            </div>
            <span className={styles.roleName}>{userInfo.employeeName.split(' ')[0]}</span>
          </div>
        )}

        <nav className={styles.navMenu}>
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => onTabChange(item.name)}
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

          <button className={styles.bottomButton} onClick={() => setIsModalOpen(true)}>
            <span className={styles.navIcon}><RiLogoutBoxRLine size={20} /></span>
            {!collapsed && <span className={styles.navText}>Logout</span>}
          </button>
        </div>
      </div>

      <LogoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={onLogout}
      />
    </div>
  );
}
