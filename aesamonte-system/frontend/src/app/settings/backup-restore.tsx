'use client';

import React from 'react';
import styles from "@/css/settings.module.css";
import BackSettingsHeader from "@/components/layout/BackSettingsHeader";
import { LuDatabaseBackup } from "react-icons/lu";

export default function BackupRestore({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.settingsCard}>
      <BackSettingsHeader 
        title="Backup and Restore" 
        icon={<LuDatabaseBackup />} 
        onBack={onBack} 
      />

      <div className={styles.backupContainer}>
        <h3 className={styles.sectionLabel}>Create Backup</h3>
        
        <div className={styles.backupOptions}>
          {/* Daily Backup Row */}
          <div className={styles.backupRow}>
            <div className={styles.checkInfo}>
              <input type="checkbox" id="daily" />
              <label htmlFor="daily">
                <strong>Enable daily backups</strong>
                <p>Backup runs automatically every day at:</p>
              </label>
            </div>
            <div className={styles.timeSelect}>
              <div className={styles.timeGroup}>
                <span>Time:</span>
                <input type="number" defaultValue="12" /> : <input type="number" defaultValue="00" />
                <select className={styles.ampmSelect}><option>PM</option></select>
              </div>
            </div>
          </div>

          {/* Weekly Backup Row */}
          <div className={styles.backupRow}>
            <div className={styles.checkInfo}>
              <input type="checkbox" id="weekly" />
              <label htmlFor="weekly">
                <strong>Enable Weekly backups</strong>
                <p>Backup runs automatically every week at:</p>
              </label>
            </div>
            <div className={styles.timeSelect}>
              <div className={styles.timeGroup}>
                <span>Time:</span>
                <input type="number" defaultValue="12" /> : <input type="number" defaultValue="00" />
                <select className={styles.ampmSelect}><option>PM</option></select>
              </div>
              <div className={styles.dayGroup}>
                <span>Day:</span>
                <select className={styles.daySelect}><option>Select</option></select>
              </div>
            </div>
          </div>
        </div>

        {/* Restore Section */}
        <div className={styles.restoreSection}>
          <h3 className={styles.sectionLabel}>Restore Data</h3>
          <div className={styles.restoreActions}>
            <div className={styles.browseInput}>
              <input type="text" readOnly />
              <button className={styles.browseBtn}>Browse</button>
            </div>
            <button className={styles.mainRestoreBtn}>Restore</button>
          </div>
        </div>
      </div>
    </div>
  );
}