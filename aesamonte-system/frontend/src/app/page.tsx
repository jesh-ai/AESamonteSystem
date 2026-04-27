'use client';

import { useState, useEffect } from "react";
import Login from "@/app/auth/auth";
import Dashboard from "@/app/dashboard/dashboard";
import Sidebar from "@/components/layout/SideNavBar";
import Reports from "@/app/reports/reports";
import Settings from "@/app/settings/settings";
import Help from "@/app/help/help";
import Inventory from "@/app/inventory/inventory";
import Sales from "@/app/sales/sales";
import Orders from "@/app/order/order";
import Suppliers from "@/app/suppliers/suppliers";
import type { UserInfo } from "@/types/user";

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");

  const setActiveTabPersisted = (tab: string) => {
    localStorage.setItem("activeTab", tab);
    setActiveTab(tab);
  };
  const [pendingSearch, setPendingSearch] = useState<{ tab: string; term: string } | null>(null);

  // Restore session from localStorage token on page load / browser refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const payload = decodeJwt(token);
      const expired = !payload || (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp);
      if (!expired && payload) {
        setUserInfo({
          employeeId:       payload.employee_id as number,
          employeeName:     payload.employee_name as string,
          employeeUsername: "",
          roleName:         payload.role_name as string,
          roleId:           payload.role_id as number,
          permissions:      payload.permissions as UserInfo["permissions"],
          token,
        });
        setIsLoggedIn(true);
        const savedTab = localStorage.getItem("activeTab");
        if (savedTab) setActiveTab(savedTab);
      } else {
        localStorage.removeItem("token");
      }
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    function handleNavigate(e: Event) {
      const { tab, search } = (e as CustomEvent<{ tab: string; search: string }>).detail;
      setActiveTabPersisted(tab);
      setPendingSearch({ tab, term: search ?? '' });
    }
    window.addEventListener('app:navigate', handleNavigate);
    return () => window.removeEventListener('app:navigate', handleNavigate);
  }, []);

  const handleLogin = (data: UserInfo) => {
    setUserInfo(data);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("activeTab");
    setIsLoggedIn(false);
    setUserInfo(null);
    setActiveTab("Dashboard");
  };

 return (
    <main className="min-h-screen bg-linear-to-b from-[#0A2A43] to-[#1a5887]">
      {!authReady ? null : !isLoggedIn || !userInfo ? (
        /* Show Login Screen */
        <div className="flex justify-center items-center h-screen">
          <Login onLogin={handleLogin} />
        </div>
      ) : (
        <div className="flex h-screen overflow-hidden bg-[#fefcf6]">
          <Sidebar
            userInfo={userInfo}
            onLogout={handleLogout}
            collapsed={isCollapsed}
            setCollapsed={setIsCollapsed}
            activeTab={activeTab}
            onTabChange={setActiveTabPersisted}
          />

          <div
            className={`flex-1 transition-all duration-300 overflow-y-auto bg-[#F8F3D9] p-0
              ${isCollapsed ? "ml-*" : "ml-*"}`}
          >
            {activeTab === "Dashboard" ? (
              <Dashboard role={userInfo.roleName} onLogout={handleLogout} onNavigate={setActiveTabPersisted} />
            ) : activeTab === "Inventory" ? (
              <Inventory role={userInfo.roleName} employeeId={userInfo.employeeId} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'inventory' ? pendingSearch.term : ''} permissions={userInfo.permissions?.inventory} />
            ) : activeTab === "Sales" ? (
              <Sales role={userInfo.roleName} employeeId={userInfo.employeeId} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'sales' ? pendingSearch.term : ''} permissions={userInfo.permissions?.sales} />
            ) : activeTab === "Orders" ? (
              // ✅ Fix — add permissions
              <Orders role={userInfo.roleName} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'orders' ? pendingSearch.term : ''} permissions={userInfo.permissions?.orders} />
            ) : activeTab === "Reports" ? (
              <Reports role={userInfo.roleName} onLogout={handleLogout} />
            ) : activeTab === "Settings" ? (
              <Settings role={userInfo.roleName} roleId={userInfo.roleId} employeeId={userInfo.employeeId} onLogout={handleLogout} />
            ) : activeTab === "Help" ? (
              <Help role={userInfo.roleName} onLogout={handleLogout} />
            ) : activeTab === "Suppliers" ? (
              <Suppliers role={userInfo.roleName} onLogout={handleLogout} />
            ) : null

            }

          </div>
        </div>
      )}
    </main>
  );
}
