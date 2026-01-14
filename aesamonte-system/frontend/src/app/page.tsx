'use client';

import { useState } from "react";
import Login from "@/app/auth/auth";
import Dashboard from "@/app/dashboard/dashboard";
import Sidebar from "@/components/layout/SideNavBar";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Simplified: directly set logged in to true
  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserInfo("");
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-[#0A2A43] to-[#1a5887]">
      {!isLoggedIn ? (
        /* Show Login Screen */
        <div className="flex justify-center items-center h-screen">
          <Login onLogin={handleLogin} />
        </div>
      ) : (
          <div className="flex h-screen overflow-hidden">
          <Sidebar 
            roleOrName={userInfo} 
            onLogout={handleLogout} 
            collapsed={isCollapsed} 
            setCollapsed={setIsCollapsed} 
          />
          
          <div 
            className={`flex-1 transition-all duration-300 overflow-y-auto bg-[#fefcf6] p-0 
              ${isCollapsed ? "ml-*" : "ml-*"}`} 
          >
            <Dashboard onLogout={handleLogout} />
          </div>
          </div>
      )} 
    </main>
  );
}