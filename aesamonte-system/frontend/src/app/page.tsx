'use client';

import { useState, useEffect } from "react";
import Login from "@/app/auth/auth";
import CreatePassword from "@/app/auth/CreatePassword";
import Dashboard from "@/app/dashboard/dashboard";
import Sidebar from "@/components/layout/SideNavBar";
import Reports from "@/app/reports/reports";
import Settings from "@/app/settings/settings";
import Help from "@/app/help/help";
import Inventory from "@/app/inventory/inventory";
import Sales from "@/app/sales/sales";
import Orders from "@/app/order/order";
import Suppliers from "@/app/suppliers/suppliers";
import Purchases from "@/app/purchases/purchases";
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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [reorderItem, setReorderItem] = useState<{
    inventory_brand_id: number; item_name: string; brand_name: string;
    uom_name: string; quantity_ordered: number; unit_cost: number;
  } | null>(null);

  const setActiveTabPersisted = (tab: string) => {
    localStorage.setItem("activeTab", tab);
    setActiveTab(tab);
  };
  const [pendingSearch, setPendingSearch] = useState<{ tab: string; term: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<{ tab: string; id: string } | null>(null);

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
      const detail = (e as CustomEvent).detail ?? {};
      const { tab, search, view_inventory_id, view_po_id } = detail;
      setActiveTabPersisted(tab);
      setPendingSearch({ tab, term: search ?? '' });
      if (view_inventory_id != null) setViewTarget({ tab: 'Inventory', id: String(view_inventory_id) });
      else if (view_po_id != null)   setViewTarget({ tab: 'Purchases', id: String(view_po_id) });
      else                           setViewTarget(null);
    }
    window.addEventListener('app:navigate', handleNavigate);
    return () => window.removeEventListener('app:navigate', handleNavigate);
  }, []);

  const handleLogin = (data: UserInfo, mustChange = false) => {
    setUserInfo(data);
    if (mustChange) {
      // Show Create Password screen — don't enter the dashboard yet
      setMustChangePassword(true);
    } else {
      setIsLoggedIn(true);
    }
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
      {!authReady ? null : mustChangePassword && userInfo ? (
        /* Show Create Password screen after logging in with a temp password */
        <CreatePassword
          userInfo={userInfo}
          onLoginAgain={() => {
            setMustChangePassword(false);
            setUserInfo(null);
          }}
        />
      ) : !isLoggedIn || !userInfo ? (
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
              <Inventory role={userInfo.roleName} employeeId={userInfo.employeeId} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'Inventory' ? pendingSearch.term : ''} permissions={userInfo.permissions?.inventory} initialViewId={viewTarget?.tab === 'Inventory' ? viewTarget.id : undefined} onViewOpened={() => setViewTarget(null)} />
            ) : activeTab === "Sales" ? (
              <Sales role={userInfo.roleName} employeeId={userInfo.employeeId} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'Sales' ? pendingSearch.term : ''} permissions={userInfo.permissions?.sales} />
            ) : activeTab === "Orders" ? (
              // ✅ Fix — add permissions
              <Orders role={userInfo.roleName} onLogout={handleLogout} initialSearch={pendingSearch?.tab === 'Orders' ? pendingSearch.term : ''} permissions={userInfo.permissions?.orders} />
            ) : activeTab === "Reports" ? (
              <Reports role={userInfo.roleName} onLogout={handleLogout} permissions={userInfo.permissions?.reports} onNavigate={(tab, item?) => { setActiveTabPersisted(tab); if (item) setReorderItem(item); }} />
            ) : activeTab === "Settings" ? (
              <Settings role={userInfo.roleName} roleId={userInfo.roleId} employeeId={userInfo.employeeId} onLogout={handleLogout} />
            ) : activeTab === "Help" ? (
              <Help role={userInfo.roleName} onLogout={handleLogout} />
            ) : activeTab === "Suppliers" ? (
              <Suppliers role={userInfo.roleName} onLogout={handleLogout} />
            ) : activeTab === "Purchases" ? (
              <Purchases role={userInfo.roleName} onLogout={handleLogout} permissions={userInfo.permissions?.purchases} initialViewId={viewTarget?.tab === 'Purchases' ? viewTarget.id : undefined} onViewOpened={() => setViewTarget(null)} reorderItem={reorderItem} />
            ) : null

            }

          </div>
        </div>
      )}
    </main>
  );
}
