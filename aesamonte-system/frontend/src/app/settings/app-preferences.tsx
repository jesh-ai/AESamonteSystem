'use client';

import React from 'react';
import sharedStyles from "@/css/settings.module.css";
import prefStyles from "@/css/app-preferences.module.css";
import SettingsHeader from "@/components/layout/BackSettingsHeader";
import { LuLayoutTemplate } from "react-icons/lu";

export default function AppPreferences({ onBack }: { onBack: () => void }) {
  return (
    <div className={sharedStyles.settingsCard}>
      <SettingsHeader 
        title="App Preferences" 
        icon={<LuLayoutTemplate />} 
        onBack={onBack} 
      />

      <div className={prefStyles.formContainer}>
        <h3 className={prefStyles.sectionLabel}>General Settings</h3>
        
        <div className={prefStyles.settingsForm}>
          {/* Logo Row */}
          <div className={prefStyles.formRow}>
            <label>Logo</label>
            <button className={prefStyles.importBtn}>IMPORT</button>
          </div>

          {/* Timezone Row */}
          <div className={prefStyles.formRow}>
            <label>Timezone</label>
            <select className={prefStyles.formSelect}>
              <option>UTC</option>
              <option>PHT (Manila)</option>
            </select>
          </div>

          {/* Date Row */}
          <div className={prefStyles.formRow}>
            <label>Date</label>
            <input type="date" className={prefStyles.formInput} defaultValue="2025-05-10" />
          </div>

          {/* Language Row */}
          <div className={prefStyles.formRow}>
            <label>Default Language</label>
            <select className={prefStyles.formSelect}>
              <option>English</option>
              <option>Tagalog</option>
            </select>
          </div>

          {/* Footer Save Button */}
          <div className={prefStyles.formActions}>
            <button className={prefStyles.saveBtn}>SAVE</button>
          </div>
        </div>
      </div>
    </div>
  );
}