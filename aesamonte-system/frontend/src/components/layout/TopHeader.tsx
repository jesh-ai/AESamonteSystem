'use client';

import React from 'react';
import styles from "@/css/topheader.module.css";

interface TopHeaderProps {
  role: string;
  onLogout?: () => void;
}

export default function TopHeader({role, onLogout }: TopHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.welcomeText}>
        Welcome, <strong>{role}!</strong>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.notificationWrapper}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <div className={styles.avatarContainer} onClick={onLogout}>
          <img src="/ae-logo.png" alt="AE Logo" className={styles.avatarImage} />
        </div>
      </div>
    </header>
  );
}