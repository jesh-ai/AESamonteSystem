/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import sharedStyles from "@/css/settings.module.css";
import prefStyles from "@/css/app-preferences.module.css";
import SettingsHeader from "@/components/layout/BackSettingsHeader";
import { LuLayoutTemplate, LuUser, LuCamera } from "react-icons/lu";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

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

// ── Admin-only notifications ──
const DEFAULT_ADMIN_NOTIFS = {
  lowStock:        true,
  outOfStock:      true,
  itemAdded:       false,
  itemArchived:    true,
  supplierAdded:   false,
  exportRequested: false,
};

// ── All other roles ──
const DEFAULT_STAFF_NOTIFS = {
  orderStatus: true,
  systemNews:  true,
};

const DEFAULT_STATE = {
  twoFA:      false,
  timezone:   'PHT',
  dateFormat: 'MM/DD/YYYY',
  darkMode:   false,
};

export default function GeneralSettings({
  onBack,
  role = 'Staff',
  employeeId,
}: {
  onBack: () => void;
  role?: string;
  employeeId?: number;
}) {
  const s = prefStyles as Record<string, string>;
  const isAdmin = role === 'Admin';

  // Profile data from backend
  const [profileName,  setProfileName]  = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  // Account Profile
  const [pfpFile,    setPfpFile]    = useState<File | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [phone,      setPhone]      = useState('');
  const [twoFA,      setTwoFA]      = useState(DEFAULT_STATE.twoFA);

  // System Settings
  const [timezone,   setTimezone]   = useState(DEFAULT_STATE.timezone);
  const [dateFormat, setDateFormat] = useState(DEFAULT_STATE.dateFormat);
  const [darkMode,   setDarkMode]   = useState(DEFAULT_STATE.darkMode);

  // Notifications
  const [adminNotifs, setAdminNotifs] = useState({ ...DEFAULT_ADMIN_NOTIFS });
  const [staffNotifs, setStaffNotifs] = useState({ ...DEFAULT_STAFF_NOTIFS });

  // Save modal
  const [showModal, setShowModal] = useState(false);
  const [noChanges, setNoChanges] = useState(false);
  const [modalMsg,  setModalMsg]  = useState('');

  // Password modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [pwError,     setPwError]     = useState('');
  const [pwLoading,   setPwLoading]   = useState(false);

  const savedPhone = useRef('');
  const savedState = useRef({
    ...DEFAULT_STATE,
    phone:       '',
    pfpFile:     null as File | null,
    adminNotifs: { ...DEFAULT_ADMIN_NOTIFS },
    staffNotifs: { ...DEFAULT_STAFF_NOTIFS },
  });

  // ── Fetch profile + restore preferences ──
  useEffect(() => {
    // Restore localStorage preferences
    try {
      const saved = localStorage.getItem('generalSettings');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.twoFA      !== undefined) { setTwoFA(p.twoFA);          savedState.current.twoFA      = p.twoFA; }
        if (p.timezone)                 { setTimezone(p.timezone);    savedState.current.timezone    = p.timezone; }
        if (p.dateFormat)               { setDateFormat(p.dateFormat);savedState.current.dateFormat  = p.dateFormat; }
        if (p.darkMode   !== undefined) { setDarkMode(p.darkMode);    savedState.current.darkMode    = p.darkMode; }
        if (p.adminNotifs) { setAdminNotifs(p.adminNotifs); savedState.current.adminNotifs = p.adminNotifs; }
        if (p.staffNotifs) { setStaffNotifs(p.staffNotifs); savedState.current.staffNotifs = p.staffNotifs; }
      }
      const storedPfp = localStorage.getItem(`profilePicture_${employeeId}`);
      if (storedPfp) setPfpPreview(storedPfp);
    } catch { /* ignore */ }

    // Fetch profile from backend
    const token = localStorage.getItem('token') ?? '';
    if (!token) { setProfileLoading(false); return; }

    fetch(`${API}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.name)    setProfileName(data.name);
        if (data.email)   setProfileEmail(data.email);
        if (data.contact) {
          setPhone(data.contact);
          savedPhone.current       = data.contact;
          savedState.current.phone = data.contact;
        }
        if (data.two_fa_enabled !== undefined) {
          setTwoFA(data.two_fa_enabled);
          savedState.current.twoFA = data.two_fa_enabled;
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setProfileLoading(false));
  }, [employeeId]);

  const toggleAdminNotif = (key: keyof typeof adminNotifs) =>
    setAdminNotifs(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleStaffNotif = (key: keyof typeof staffNotifs) =>
    setStaffNotifs(prev => ({ ...prev, [key]: !prev[key] }));

  const handleRemovePfp = () => {
    setPfpFile(null);
    setPfpPreview(null);
    try {
      localStorage.removeItem(`profilePicture_${employeeId}`);
      window.dispatchEvent(new Event('pfp:updated'));
    } catch { /* ignore */ }
  };

  const handlePfpImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPfpFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPfpPreview(base64);
        try {
          localStorage.setItem(`profilePicture_${employeeId}`, base64);
          window.dispatchEvent(new Event('pfp:updated'));
        } catch { /* ignore */ }
      };
      reader.readAsDataURL(file);
    }
  };

  const hasChanges = () => {
    const prev = savedState.current;
    if (phone      !== prev.phone)      return true;
    if (twoFA      !== prev.twoFA)      return true;
    if (timezone   !== prev.timezone)   return true;
    if (dateFormat !== prev.dateFormat) return true;
    if (darkMode   !== prev.darkMode)   return true;
    if (pfpFile    !== prev.pfpFile)    return true;
    if ((Object.keys(adminNotifs) as (keyof typeof adminNotifs)[]).some(k => adminNotifs[k] !== prev.adminNotifs[k])) return true;
    if ((Object.keys(staffNotifs) as (keyof typeof staffNotifs)[]).some(k => staffNotifs[k] !== prev.staffNotifs[k])) return true;
    return false;
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      setNoChanges(true);
      setModalMsg('You have not made any changes.');
      setShowModal(true);
      return;
    }

    // Save phone + 2FA pref to backend
    const token = localStorage.getItem('token') ?? '';
    if (token) {
      try {
        await fetch(`${API}/api/auth/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ contact: phone, two_fa_enabled: twoFA }),
        });
        savedPhone.current = phone;
      } catch { /* ignore */ }
    }

    // Save preferences to localStorage
    const toSave = { twoFA, timezone, dateFormat, darkMode, adminNotifs: { ...adminNotifs }, staffNotifs: { ...staffNotifs } };
    localStorage.setItem('generalSettings', JSON.stringify(toSave));
    savedState.current = { ...toSave, phone, pfpFile };

    setNoChanges(false);
    setModalMsg('Settings saved successfully!');
    setShowModal(true);
  };

  const handlePasswordChange = async () => {
    if (!currentPw || !newPw || !confirmPw) { setPwError('Please fill in all fields.'); return; }
    if (newPw !== confirmPw)                { setPwError('New passwords do not match.'); return; }
    if (newPw.length < 8)                   { setPwError('Password must be at least 8 characters.'); return; }

    setPwLoading(true);
    setPwError('');
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId:      employeeId,
          currentPassword: currentPw,
          newPassword:     newPw,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.message || 'Failed to change password.');
        return;
      }
      closePwModal();
      setNoChanges(false);
      setModalMsg('Password changed successfully!');
      setShowModal(true);
    } catch {
      setPwError('Network error. Please try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const closePwModal = () => {
    setShowPwModal(false); setPwError('');
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  // Admin notification rows
  const adminNotifRows: { key: keyof typeof adminNotifs; label: string; description: string }[] = [
    { key: 'lowStock',        label: 'Low Stock Alert',          description: 'Notify when an item reaches its reorder point' },
    { key: 'outOfStock',      label: 'Out of Stock Alert',       description: 'Notify when an item quantity reaches zero' },
    { key: 'itemAdded',       label: 'New Item Added',           description: 'Notify when a new inventory item is created' },
    { key: 'itemArchived',    label: 'Item Archived / Restored', description: 'Notify when an item is archived or restored' },
    { key: 'supplierAdded',   label: 'New Supplier Added',       description: 'Notify when a new supplier is registered' },
    { key: 'exportRequested', label: 'Export Requested',         description: 'Notify when an export request is submitted' },
  ];

  // Non-admin notification rows
  const staffNotifRows: { key: keyof typeof staffNotifs; label: string; description: string }[] = [
    { key: 'orderStatus', label: 'Order Status Updates', description: 'Get notified when an order status changes' },
    { key: 'systemNews',  label: 'System News',          description: 'Receive updates about new features and announcements' },
  ];

  return (
    <div className={sharedStyles.settingsCard}>
      <SettingsHeader
        title="General Settings"
        icon={<LuLayoutTemplate />}
        onBack={onBack}
      />

      <div className={s.formContainer}>

        {/* ── ACCOUNT PROFILE ── */}
        <h3 className={s.mainSectionLabel}>Account Profile</h3>

        {/* Centered Profile Card */}
        <div className={s.profileCard}>
          <label className={s.pfpCircleWrapper} style={{ cursor: 'pointer' }}>
            <div className={s.pfpCircle}>
              {pfpPreview
                ? <img src={pfpPreview} alt="Profile" className={s.pfpImg} />
                : <LuUser size={36} color="#94a3b8" />}
            </div>
            <div className={s.pfpEditOverlay}>
              <LuCamera size={22} color="#fff" />
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePfpImport} />
          </label>
          <div className={s.pfpDisplayName}>
            {profileLoading ? '—' : (profileName || 'Display Name')}
          </div>
          <div className={s.pfpRoleBadge}>{role}</div>
          {pfpPreview && (
            <button className={s.removePfpBtn} onClick={handleRemovePfp}>
              Remove Photo
            </button>
          )}
        </div>

        {/* Personal Information */}
        <h4 className={s.subSectionLabel}>Personal Information</h4>
        <div className={s.settingsForm}>
          <div className={s.formRow}>
            <label>Full Name</label>
            <input
              type="text"
              className={s.readOnlyInput}
              value={profileLoading ? 'Loading...' : profileName}
              disabled
            />
          </div>
          <div className={s.formRow}>
            <label>Email</label>
            <input
              type="email"
              className={s.readOnlyInput}
              value={profileLoading ? 'Loading...' : profileEmail}
              disabled
            />
          </div>
          <div className={s.formRow}>
            <label>Phone Number</label>
            <input
              type="tel"
              className={s.formInput}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+63 xxx xxx xxxx"
            />
          </div>
        </div>

        {/* Security */}
        <h4 className={s.subSectionLabel}>Security</h4>
        <div className={s.settingsForm} style={{ marginBottom: '1rem' }}>
          <div className={s.formRow}>
            <label>Password</label>
            <button className={s.importBtn} style={{ cursor: 'pointer' }} onClick={() => setShowPwModal(true)}>
              Change Password
            </button>
          </div>
        </div>
        <div className={s.notifForm} style={{ maxWidth: '450px' }}>
          <div className={s.notifRow}>
            <div>
              <div className={s.notifLabel}>Two-Factor Authentication</div>
              <div className={s.notifDescription}>Add an extra layer of security to your account</div>
            </div>
            <div className={s.notifToggleWrapper}>
              <span className={s.notifStatus} style={{ color: twoFA ? '#1a4263' : '#9ca3af' }}>
                {twoFA ? 'ON' : 'OFF'}
              </span>
              <Toggle enabled={twoFA} onToggle={() => setTwoFA(p => !p)} />
            </div>
          </div>
        </div>

        {/* ── SYSTEM SETTINGS ── */}
        <h3 className={s.mainSectionLabel} style={{ marginTop: '2.5rem' }}>System Settings</h3>

        <h4 className={s.subSectionLabel}>Regional Settings</h4>
        <div className={s.settingsForm}>
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
            <label>Date Format</label>
            <select className={s.formSelect} value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            </select>
          </div>
        </div>

        <h4 className={s.subSectionLabel}>Display Preferences</h4>
        <div className={s.notifForm} style={{ maxWidth: '450px' }}>
          <div className={s.notifRow}>
            <div>
              <div className={s.notifLabel}>Dark Mode</div>
              <div className={s.notifDescription}>Switch to a darker color theme</div>
            </div>
            <div className={s.notifToggleWrapper}>
              <span className={s.notifStatus} style={{ color: darkMode ? '#1a4263' : '#9ca3af' }}>
                {darkMode ? 'ON' : 'OFF'}
              </span>
              <Toggle enabled={darkMode} onToggle={() => setDarkMode(p => !p)} />
            </div>
          </div>
        </div>

        {/* ── NOTIFICATION SETTINGS ── */}
        <h3 className={s.mainSectionLabel} style={{ marginTop: '2.5rem' }}>Notification Settings</h3>

        <h4 className={s.subSectionLabel}>General Notification</h4>

        {isAdmin ? (
          <div className={s.notifForm} style={{ maxWidth: '450px' }}>
            {adminNotifRows.map(({ key, label, description }) => (
              <div key={key} className={s.notifRow}>
                <div>
                  <div className={s.notifLabel}>{label}</div>
                  <div className={s.notifDescription}>{description}</div>
                </div>
                <div className={s.notifToggleWrapper}>
                  <span className={s.notifStatus} style={{ color: adminNotifs[key] ? '#1a4263' : '#9ca3af' }}>
                    {adminNotifs[key] ? 'ON' : 'OFF'}
                  </span>
                  <Toggle enabled={adminNotifs[key]} onToggle={() => toggleAdminNotif(key)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={s.notifForm} style={{ maxWidth: '450px' }}>
            {staffNotifRows.map(({ key, label, description }) => (
              <div key={key} className={s.notifRow}>
                <div>
                  <div className={s.notifLabel}>{label}</div>
                  <div className={s.notifDescription}>{description}</div>
                </div>
                <div className={s.notifToggleWrapper}>
                  <span className={s.notifStatus} style={{ color: staffNotifs[key] ? '#1a4263' : '#9ca3af' }}>
                    {staffNotifs[key] ? 'ON' : 'OFF'}
                  </span>
                  <Toggle enabled={staffNotifs[key]} onToggle={() => toggleStaffNotif(key)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SAVE ── */}
        <div className={s.formActions}>
          <button className={s.saveBtn} onClick={handleSave}>SAVE</button>
        </div>

      </div>

      {/* ── SAVE / SUCCESS MODAL ── */}
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
              <p className={s.modalMessage}>{modalMsg}</p>
              <button className={noChanges ? s.modalOkBtnWarning : s.modalOkBtn} onClick={() => setShowModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASSWORD MODAL ── */}
      {showPwModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <div className={s.modalHeader} style={{ backgroundColor: '#1a4263' }}>
              <div className={s.modalCheckCircle} style={{ backgroundColor: '#1a4263' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>
            <div className={s.modalBody}>
              <h3 className={s.modalTitle} style={{ marginBottom: '1.25rem' }}>Change Password</h3>
              <div className={s.pwForm}>
                <div className={s.pwField}>
                  <label>Current Password</label>
                  <input type="password" className={s.pwInput} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />
                </div>
                <div className={s.pwField}>
                  <label>New Password</label>
                  <input type="password" className={s.pwInput} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
                </div>
                <div className={s.pwField}>
                  <label>Confirm New Password</label>
                  <input type="password" className={s.pwInput} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" />
                </div>
                {pwError && <p className={s.pwError}>{pwError}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f8fafc', color: '#333', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}
                  onClick={closePwModal}
                  disabled={pwLoading}
                >
                  Cancel
                </button>
                <button
                  className={s.modalOkBtn}
                  style={{ flex: 1, padding: '10px', opacity: pwLoading ? 0.7 : 1 }}
                  onClick={handlePasswordChange}
                  disabled={pwLoading}
                >
                  {pwLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
