'use client';

import { useState } from "react";
import Login from "@/app/auth/auth";
import Dashboard from "@/app/dashboard/dashboard";
import Sidebar from "@/components/layout/SideNavBar";
import Reports from "@/app/reports/reports";
import Settings from "@/app/settings/settings";
import Help from "@/app/help/help";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Simplified: directly set logged in to true
  const handleLogin = (data: string) => {
    setUserInfo(data);     
    setIsLoggedIn(true);   // This switches the view to the Dashboard
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserInfo("");
    setActiveTab("Dashboard");
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-[#0A2A43] to-[#1a5887]">
      {!isLoggedIn ? (
        /* Show Login Screen */
        <div className="flex justify-center items-center h-screen">
          <Login onLogin={handleLogin} />
        </div>
      ) : (
        <div className="flex h-screen overflow-hidden bg-[#fefcf6]">
          <Sidebar 
            roleOrName={userInfo} 
            onLogout={handleLogout} 
            collapsed={isCollapsed} 
            setCollapsed={setIsCollapsed}
            activeTab={activeTab}
            onTabChange={setActiveTab} // New prop to manage active tab 
          />
          
          <div 
            className={`flex-1 transition-all duration-300 overflow-y-auto bg-[#F8F3D9] p-0 
              ${isCollapsed ? "ml-*" : "ml-*"}`} 
          >
            {activeTab === "Dashboard" ? (
              <Dashboard role={userInfo} onLogout={handleLogout} />
            ) : activeTab === "Reports" ? (
              <Reports role={userInfo} onLogout={handleLogout} />
            ) : activeTab === "Settings" ? (
              <Settings role={userInfo} onLogout={handleLogout} />
            ) : activeTab === "Help" ? (
              <Help role={userInfo} onLogout={handleLogout} />
            ) : null}
            
          </div>
          </div>
      )} 
    </main>
  );
}