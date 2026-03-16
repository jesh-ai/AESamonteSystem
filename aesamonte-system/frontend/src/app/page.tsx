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

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [pendingSearch, setPendingSearch] = useState<{ tab: string; term: string } | null>(null);

  useEffect(() => {
    function handleNavigate(e: Event) {
      const { tab, search } = (e as CustomEvent<{ tab: string; search: string }>).detail;
      setActiveTab(tab);
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
    setIsLoggedIn(false);
    setUserInfo(null);
    setActiveTab("Dashboard");
  };

 return (
    <main className="min-h-screen bg-linear-to-b from-[#0A2A43] to-[#1a5887]">
      {!isLoggedIn || !userInfo ? (
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
            onTabChange={setActiveTab}
          />

          <div
            className={`flex-1 transition-all duration-300 overflow-y-auto bg-[#F8F3D9] p-0
              ${isCollapsed ? "ml-*" : "ml-*"}`}
          >
            {activeTab === "Dashboard" ? (
              <Dashboard role={userInfo.roleName} onLogout={handleLogout} onNavigate={setActiveTab} />
            ) : activeTab === "Inventory" ? (
              <Inventory role={userInfo.roleName} department={userInfo.department} employeeId={userInfo.employeeId} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'Inventory' ? pendingSearch.term : ''} />
            ) : activeTab === "Sales" ? (
              <Sales role={userInfo.roleName} department={userInfo.department} employeeId={userInfo.employeeId} onLogout={handleLogout} />
            ) : activeTab === "Orders" ? (
              <Orders role={userInfo.roleName} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'Orders' ? pendingSearch.term : ''} />
            ) : activeTab === "Reports" ? (
              <Reports role={userInfo.roleName} onLogout={handleLogout} />
            ) : activeTab === "Settings" ? (
              <Settings role={userInfo.roleName} onLogout={handleLogout} />
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
