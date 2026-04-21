'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from "@/css/settings.module.css";
import s from "@/css/backup-restore.module.css";
import BackSettingsHeader from "@/components/layout/BackSettingsHeader";
import { LuDatabaseBackup } from "react-icons/lu";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ── Minute Picker dropdown ─────────────────────────────────────────────────────
function MinutePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div ref={ref} className={s.minutePicker}>
      <button
        type="button"
        className={`${s.timeInput} ${s.minuteBtn}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        {value} <span className={s.dropArrow}>▾</span>
      </button>
      {open && (
        <div className={s.minuteDropdown}>
          {minutes.map(m => (
            <div
              key={m}
              className={`${s.minuteOption} ${m === value ? s.minuteOptionActive : ''}`}
              onClick={() => { onChange(m); setOpen(false); }}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal types ────────────────────────────────────────────────────────────────
type ModalType = 'success-backup' | 'success-restore' | 'no-changes-backup' | 'no-file-restore' | 'error' | null;

// ── Component ─────────────────────────────────────────────────────────────────
export default function BackupRestore({ onBack }: { onBack: () => void }) {
  // Schedule state
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [dailyHour, setDailyHour] = useState('12');
  const [dailyMin, setDailyMin] = useState('00');
  const [dailyAmPm, setDailyAmPm] = useState('PM');
  const [weeklyHour, setWeeklyHour] = useState('12');
  const [weeklyMin, setWeeklyMin] = useState('00');
  const [weeklyAmPm, setWeeklyAmPm] = useState('PM');
  const [weeklyDay, setWeeklyDay] = useState('monday');

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading states
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Modal
  const [modal, setModal] = useState<ModalType>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Snapshot of saved state to detect changes
  const savedRef = useRef({ dailyEnabled, weeklyEnabled, dailyHour, dailyMin, dailyAmPm, weeklyHour, weeklyMin, weeklyAmPm, weeklyDay });

  // Load settings on mount
  useEffect(() => {
    fetch(`${API}/api/backup/settings`)
      .then(r => r.json())
      .then(data => {
        const d = data.daily || {};
        const w = data.weekly || {};

        const to12h = (h: number) => {
          if (h === 0) return '12';
          if (h > 12) return String(h - 12).padStart(2, '0');
          return String(h).padStart(2, '0');
        };

        const dH = d.ampm ? String(d.hour ?? 12).padStart(2, '0') : to12h(d.hour ?? 12);
        const dM = String(d.minute ?? 0).padStart(2, '0');
        const dA = d.ampm ?? (d.hour >= 12 ? 'PM' : 'AM');
        const wH = w.ampm ? String(w.hour ?? 12).padStart(2, '0') : to12h(w.hour ?? 12);
        const wM = String(w.minute ?? 0).padStart(2, '0');
        const wA = w.ampm ?? (w.hour >= 12 ? 'PM' : 'AM');
        const wD = w.day ?? 'monday';

        setDailyEnabled(!!d.enabled); setDailyHour(dH); setDailyMin(dM); setDailyAmPm(dA);
        setWeeklyEnabled(!!w.enabled); setWeeklyHour(wH); setWeeklyMin(wM); setWeeklyAmPm(wA); setWeeklyDay(wD);
        savedRef.current = { dailyEnabled: !!d.enabled, weeklyEnabled: !!w.enabled, dailyHour: dH, dailyMin: dM, dailyAmPm: dA, weeklyHour: wH, weeklyMin: wM, weeklyAmPm: wA, weeklyDay: wD };
      })
      .catch(() => {});
  }, []);

  const hasChanges = () => {
    const p = savedRef.current;
    return dailyEnabled !== p.dailyEnabled || weeklyEnabled !== p.weeklyEnabled ||
      dailyHour !== p.dailyHour || dailyMin !== p.dailyMin || dailyAmPm !== p.dailyAmPm ||
      weeklyHour !== p.weeklyHour || weeklyMin !== p.weeklyMin || weeklyAmPm !== p.weeklyAmPm ||
      weeklyDay !== p.weeklyDay;
  };

  const toApiHour = (h: string, ampm: string) => {
    let n = parseInt(h, 10);
    if (ampm === 'PM' && n !== 12) n += 12;
    if (ampm === 'AM' && n === 12) n = 0;
    return n;
  };

  const handleSaveBackup = async () => {
    if (!hasChanges()) { setModal('no-changes-backup'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/backup/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily: { enabled: dailyEnabled, hour: toApiHour(dailyHour, dailyAmPm), minute: parseInt(dailyMin, 10), ampm: dailyAmPm },
          weekly: { enabled: weeklyEnabled, hour: toApiHour(weeklyHour, weeklyAmPm), minute: parseInt(weeklyMin, 10), ampm: weeklyAmPm, day: weeklyDay },
        }),
      });
      if (res.ok) {
        savedRef.current = { dailyEnabled, weeklyEnabled, dailyHour, dailyMin, dailyAmPm, weeklyHour, weeklyMin, weeklyAmPm, weeklyDay };
        setModal('success-backup');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to save settings.');
        setModal('error');
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
      setModal('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API}/api/backup/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') || '';
      a.download = disposition.split('filename=')[1] || 'Backup.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg('Download failed. Please try again.');
      setModal('error');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) { setModal('no-file-restore'); return; }
    setRestoring(true);
    const formData = new FormData();
    formData.append('file', restoreFile);
    try {
      const res = await fetch(`${API}/api/backup/restore`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setRestoreFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setModal('success-restore');
      } else {
        setErrorMsg(data.error || 'Restore failed.');
        setModal('error');
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
      setModal('error');
    } finally {
      setRestoring(false);
    }
  };

  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const val = String(i + 1).padStart(2, '0');
    return <option key={val} value={val}>{val}</option>;
  });

  const isWarning = modal === 'no-changes-backup' || modal === 'no-file-restore' || modal === 'error';
  const modalTitle = isWarning ? (modal === 'error' ? 'Error' : 'No Changes!') : 'Success!';
  const modalMessage =
    modal === 'success-backup'    ? 'Backup schedule saved successfully!'                        :
    modal === 'success-restore'   ? 'Data restored successfully!'                                :
    modal === 'no-changes-backup' ? 'You have not made any changes to the backup schedule.'      :
    modal === 'no-file-restore'   ? 'Please select a CSV file before restoring.'                 :
    modal === 'error'             ? errorMsg                                                     : '';

  return (
    <div className={styles.settingsCard}>
      <BackSettingsHeader
        title="Backup and Restore"
        icon={<LuDatabaseBackup />}
        onBack={onBack}
      />

      <div className={s.formContainer}>

        {/* ── CREATE BACKUP ── */}
        <h3 className={s.sectionLabel}>Create Backup</h3>
        <div className={s.backupCard}>

          {/* Daily */}
          <div className={s.backupRow}>
            <div className={s.checkInfo}>
              <input type="checkbox" id="daily" checked={dailyEnabled}
                onChange={e => setDailyEnabled(e.target.checked)} className={s.checkbox} />
              <label htmlFor="daily" className={s.checkLabel}>
                <span className={s.checkTitle}>Enable daily backups</span>
                <span className={s.checkDesc}>Backup runs automatically every day at:</span>
              </label>
            </div>
            <div className={s.timeBlock}>
              <div className={s.timeGroup}>
                <span className={s.timeLabel}>Time:</span>
                <select className={s.timeInput} value={dailyHour}
                  onChange={e => setDailyHour(e.target.value)} disabled={!dailyEnabled}>
                  {hourOptions}
                </select>
                <span className={s.timeSep}>:</span>
                <MinutePicker value={dailyMin} onChange={setDailyMin} disabled={!dailyEnabled} />
                <select className={s.ampmSelect} value={dailyAmPm}
                  onChange={e => setDailyAmPm(e.target.value)} disabled={!dailyEnabled}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div className={s.divider} />

          {/* Weekly */}
          <div className={s.backupRow}>
            <div className={s.checkInfo}>
              <input type="checkbox" id="weekly" checked={weeklyEnabled}
                onChange={e => setWeeklyEnabled(e.target.checked)} className={s.checkbox} />
              <label htmlFor="weekly" className={s.checkLabel}>
                <span className={s.checkTitle}>Enable weekly backups</span>
                <span className={s.checkDesc}>Backup runs automatically every week at:</span>
              </label>
            </div>
            <div className={s.timeBlock}>
              <div className={s.timeGroup}>
                <span className={s.timeLabel}>Time:</span>
                <select className={s.timeInput} value={weeklyHour}
                  onChange={e => setWeeklyHour(e.target.value)} disabled={!weeklyEnabled}>
                  {hourOptions}
                </select>
                <span className={s.timeSep}>:</span>
                <MinutePicker value={weeklyMin} onChange={setWeeklyMin} disabled={!weeklyEnabled} />
                <select className={s.ampmSelect} value={weeklyAmPm}
                  onChange={e => setWeeklyAmPm(e.target.value)} disabled={!weeklyEnabled}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
              <div className={s.dayGroup}>
                <span className={s.timeLabel}>Day:</span>
                <select className={s.daySelect} value={weeklyDay}
                  onChange={e => setWeeklyDay(e.target.value)} disabled={!weeklyEnabled}>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Centered action buttons */}
        <div className={s.backupActions}>
          <button className={s.saveBackupBtn} onClick={handleSaveBackup} disabled={saving}>
            {saving ? 'Saving...' : 'Save Backup Schedule'}
          </button>
          <button className={s.downloadBtn} onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Preparing...' : 'Download Backup Now'}
          </button>
        </div>

        {/* ── RESTORE DATA ── */}
        <h3 className={s.sectionLabel} style={{ marginTop: '36px' }}>Restore Data</h3>
        <p className={s.restoreHint}>
          Upload a backup file to restore data. You can upload the full backup <em>.zip</em> to restore
          all modules at once, or a single CSV (e.g. <em>Inventory_03-15-26.csv</em>, <em>Supplier_...</em>,{' '}
          <em>Orders_...</em>, <em>Sales_...</em>) to restore one module.
        </p>
        <div className={s.restoreCard}>
          <div className={s.browseRow}>
            <span className={s.fileName}>
              {restoreFile ? restoreFile.name : 'No file selected'}
            </span>
            <label className={s.browseBtn}>
              Browse
              <input ref={fileInputRef} type="file" accept=".csv,.zip" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) setRestoreFile(e.target.files[0]); }} />
            </label>
          </div>
          {restoreFile && (
            <button className={s.clearFileBtn} type="button"
              onClick={() => { setRestoreFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
              ✕ Remove file
            </button>
          )}
          <button className={s.restoreBtn} onClick={handleRestore} disabled={restoring || !restoreFile}>
            {restoring ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <div className={isWarning ? s.modalHeaderWarning : s.modalHeader}>
              <div className={isWarning ? s.modalCheckCircleWarning : s.modalCheckCircle}>
                {isWarning ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className={s.modalBody}>
              <h3 className={isWarning ? s.modalTitleWarning : s.modalTitle}>{modalTitle}</h3>
              <p className={s.modalMessage}>{modalMessage}</p>
              <button className={isWarning ? s.modalOkBtnWarning : s.modalOkBtn} onClick={() => setModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
