/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import sharedStyles from "@/css/settings.module.css";
import prefStyles from "@/css/app-preferences.module.css";
import SettingsHeader from "@/components/layout/BackSettingsHeader";
import { LuLayoutTemplate } from "react-icons/lu";

const TOGGLE_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  width: '44px',
  height: '24px',
  flexShrink: 0,
  cursor: 'pointer',
};

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div style={TOGGLE_STYLE} onClick={onToggle}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '999px',
        backgroundColor: enabled ? '#1a4263' : '#d1d5db',
        transition: 'background-color 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: '3px',
          left: enabled ? '23px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          backgroundColor: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  );
}

const DEFAULT_STATE = {
  timezone: 'PHT',
  date: new Date().toISOString().split('T')[0],
  language: 'English',
  notifs: {
    lowStock:        true,
    outOfStock:      true,
    itemAdded:       false,
    itemArchived:    true,
    supplierAdded:   false,
    exportRequested: false,
  },
};

export default function GeneralSettings({ onBack }: { onBack: () => void }) {
  const s = prefStyles as Record<string, string>;

  const [timezone, setTimezone] = useState(DEFAULT_STATE.timezone);
  const [date, setDate] = useState(DEFAULT_STATE.date);
  const [language, setLanguage] = useState(DEFAULT_STATE.language);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [noChanges, setNoChanges] = useState(false);

  const savedState = useRef({ ...DEFAULT_STATE, logoFile: null as File | null });

  const [notifs, setNotifs] = useState({ ...DEFAULT_STATE.notifs });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('notifPreferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        setNotifs(parsed);
        savedState.current = { ...savedState.current, notifs: parsed };
      }
    } catch { /* ignore */ }
  }, []);

  const toggleNotif = (key: keyof typeof notifs) =>
    setNotifs(prev => ({ ...prev, [key]: !prev[key] }));

  const handleLogoImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
  };

  const hasChanges = () => {
    const prev = savedState.current;
    if (timezone !== prev.timezone) return true;
    if (date !== prev.date) return true;
    if (language !== prev.language) return true;
    if (logoFile !== prev.logoFile) return true;
    const prevNotifs = prev.notifs as typeof notifs;
    return (Object.keys(notifs) as (keyof typeof notifs)[])
      .some(key => notifs[key] !== prevNotifs[key]);
  };

  const handleSave = () => {
    if (!hasChanges()) {
      setNoChanges(true);
      setShowModal(true);
      return;
    }
    localStorage.setItem('notifPreferences', JSON.stringify(notifs));
    savedState.current = { timezone, date, language, notifs: { ...notifs }, logoFile };
    setNoChanges(false);
    setShowModal(true);
  };

  const notifRows: { key: keyof typeof notifs; label: string; description: string }[] = [
    { key: 'lowStock',        label: 'Low Stock Alert',          description: 'Notify when an item reaches its reorder point' },
    { key: 'outOfStock',      label: 'Out of Stock Alert',       description: 'Notify when an item quantity reaches zero' },
    { key: 'itemAdded',       label: 'New Item Added',           description: 'Notify when a new inventory item is created' },
    { key: 'itemArchived',    label: 'Item Archived / Restored', description: 'Notify when an item is archived or restored' },
    { key: 'supplierAdded',   label: 'New Supplier Added',       description: 'Notify when a new supplier is registered' },
    { key: 'exportRequested', label: 'Export Requested',         description: 'Notify when an export request is submitted' },
  ];

  return (
    <div className={sharedStyles.settingsCard}>
      <SettingsHeader
        title="General Settings"
        icon={<LuLayoutTemplate />}
        onBack={onBack}
      />

      <div className={s.formContainer}>

        {/* ── GENERAL SETTINGS ── */}
        <h3 className={s.sectionLabel}>General Settings</h3>
        <div className={s.settingsForm}>

          <div className={s.formRow}>
            <label>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {logoFile && (
                <span style={{ fontSize: '0.78rem', color: '#6b7280', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {logoFile.name}
                </span>
              )}
              <label className={s.importBtn} style={{ cursor: 'pointer', display: 'inline-block' }}>
                {logoFile ? 'CHANGE' : 'IMPORT'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoImport} />
              </label>
            </div>
          </div>

          <div className={s.formRow}>
            <label>Timezone</label>
            <select className={s.formSelect} value={timezone} onChange={e => setTimezone(e.target.value)}>
              <optgroup label="Asia / Pacific">
                <option value="PHT">PHT — Manila (UTC+8)</option>
                <option value="SGT">SGT — Singapore (UTC+8)</option>
                <option value="JST">JST — Tokyo (UTC+9)</option>
                <option value="AEST">AEST — Sydney (UTC+10)</option>
                <option value="ICT">ICT — Bangkok (UTC+7)</option>
              </optgroup>
              <optgroup label="Universal">
                <option value="UTC">UTC — Coordinated Universal Time</option>
              </optgroup>
              <optgroup label="Europe">
                <option value="CET">CET — Central European (UTC+1)</option>
                <option value="GMT">GMT — London (UTC+0)</option>
              </optgroup>
              <optgroup label="Americas">
                <option value="EST">EST — New York (UTC−5)</option>
                <option value="PST">PST — Los Angeles (UTC−8)</option>
              </optgroup>
            </select>
          </div>

          <div className={s.formRow}>
            <label>Date</label>
            <input type="date" className={s.formInput} value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className={s.formRow}>
            <label>Default Language</label>
            <select className={s.formSelect} value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="English">English</option>
              <option value="Filipino">Filipino</option>
            </select>
          </div>
        </div>

        {/* ── NOTIFICATION SETTINGS ── */}
        <h3 className={s.sectionLabel} style={{ marginTop: '36px' }}>Notification Settings</h3>
        <div className={s.notifForm}>
          {notifRows.map(({ key, label, description }) => (
            <div key={key} className={s.notifRow}>
              <div>
                <div className={s.notifLabel}>{label}</div>
                <div className={s.notifDescription}>{description}</div>
              </div>
              <div className={s.notifToggleWrapper}>
                <span className={s.notifStatus} style={{ color: notifs[key] ? '#1a4263' : '#9ca3af' }}>
                  {notifs[key] ? 'ON' : 'OFF'}
                </span>
                <Toggle enabled={notifs[key]} onToggle={() => toggleNotif(key)} />
              </div>
            </div>
          ))}
        </div>

        {/* ── SAVE ── */}
        <div className={s.formActions}>
          <button className={s.saveBtn} onClick={handleSave}>SAVE</button>
        </div>

      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <div className={noChanges ? s.modalHeaderWarning : s.modalHeader}>
              <div className={noChanges ? s.modalCheckCircleWarning : s.modalCheckCircle}>
                {noChanges ? (
                  <svg width="75" height="75" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className={s.modalBody}>
              <h3 className={noChanges ? s.modalTitleWarning : s.modalTitle}>
                {noChanges ? 'No Changes!' : 'Success!'}
              </h3>
              <p className={s.modalMessage}>
                {noChanges ? 'You have not made any changes.' : 'Settings saved successfully!'}
              </p>
              <button className={noChanges ? s.modalOkBtnWarning : s.modalOkBtn} onClick={() => setShowModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}