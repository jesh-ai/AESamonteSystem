'use client';

import React from 'react';
import { LuArrowLeft } from "react-icons/lu";
import styles from "@/css/settings.module.css";

interface SettingsHeaderProps {
  title: string;
  icon: React.ReactNode;
  onBack: () => void;
}

export default function SettingsHeader({ title, icon, onBack }: SettingsHeaderProps) {
  return (
    <div className={styles.settingsHeaderWrapper}>
      {/* Separate Back Button */}
      <button onClick={onBack} className={styles.backButton}>
        <LuArrowLeft size={20} />
        <span>Back</span>
      </button>

      {/* Icon and Title Group */}
      <div className={styles.titleGroup}>
        <div className={styles.iconWrapper}>
          {icon}
        </div>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
    </div>
  );
}