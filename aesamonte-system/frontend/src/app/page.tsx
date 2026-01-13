'use client';

import { useState } from "react";
import Login from "@/app/auth/auth";
import Dashboard from "@/app/dashboard/dashboard";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Simplified: directly set logged in to true
  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-[#0A2A43] to-[#1a5887]">
      {!isLoggedIn ? (
        /* Show Login Screen */
        <div className="flex justify-center items-center h-screen">
          <Login onLogin={handleLogin} />
        </div>
      ) : (
        /* Show Dashboard directly after login */
        <Dashboard onLogout={handleLogout} />
      )} 
    </main>
  );
}