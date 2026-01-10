'use client';

import { useState } from "react";
import Login from "@/app/auth/auth";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleLogin = (role: string) => {
    setIsLoggedIn(true);
    setSelectedRole(role);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedRole(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A2A43] to-[#1a5887]">
      {!isLoggedIn ? (
        <div className="flex justify-center items-center h-screen">
          <Login onLogin={handleLogin} />
        </div>
      ) : (
        <div className="p-8 text-white text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome, {selectedRole}!</h1>
          <p className="mb-6">You have successfully logged into the AE Samonte System.</p>
          <button 
            onClick={handleLogout} 
            className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-lg font-bold transition"
          >
            Logout
          </button>
        </div>
      )} 
    </main>
  );
}