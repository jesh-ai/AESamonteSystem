'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from "@/css/settings.module.css";
import backupStyles from "@/css/backup-restore.module.css";
import BackSettingsHeader from "@/components/layout/BackSettingsHeader";
import { LuDatabaseBackup } from "react-icons/lu";

function MinutePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const s = backupStyles as Record<string, string>;
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

const DEFAULT_BACKUP = {
  dailyEnabled: false,
  weeklyEnabled: false,
  dailyHour: '12', dailyMin: '00', dailyAmPm: 'PM',
  weeklyHour: '12', weeklyMin: '00', weeklyAmPm: 'PM',
  weeklyDay: '',
};

type ModalType = 'success-backup' | 'success-restore' | 'no-changes-backup' | 'no-changes-restore' | null;

export default function BackupRestore({ onBack }: { onBack: () => void }) {
  const s = backupStyles as Record<string, string>;

  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [dailyHour, setDailyHour] = useState('12');
  const [dailyMin, setDailyMin] = useState('00');
  const [dailyAmPm, setDailyAmPm] = useState('PM');
  const [weeklyHour, setWeeklyHour] = useState('12');
  const [weeklyMin, setWeeklyMin] = useState('00');
  const [weeklyAmPm, setWeeklyAmPm] = useState('PM');
  const [weeklyDay, setWeeklyDay] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [modal, setModal] = useState<ModalType>(null);

  const savedBackup = useRef({ ...DEFAULT_BACKUP });

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setRestoreFile(e.target.files[0]);
  };

  const hasBackupChanges = () => {
    const prev = savedBackup.current;
    return (
      dailyEnabled !== prev.dailyEnabled ||
      weeklyEnabled !== prev.weeklyEnabled ||
      dailyHour !== prev.dailyHour ||
      dailyMin !== prev.dailyMin ||
      dailyAmPm !== prev.dailyAmPm ||
      weeklyHour !== prev.weeklyHour ||
      weeklyMin !== prev.weeklyMin ||
      weeklyAmPm !== prev.weeklyAmPm ||
      weeklyDay !== prev.weeklyDay
    );
  };

  const handleSaveBackup = () => {
    if (!hasBackupChanges()) {
      setModal('no-changes-backup');
      return;
    }
    savedBackup.current = {
      dailyEnabled, weeklyEnabled,
      dailyHour, dailyMin, dailyAmPm,
      weeklyHour, weeklyMin, weeklyAmPm,
      weeklyDay,
    };
    console.log('Backup schedule saved');
    setModal('success-backup');
  };

  const handleRestore = () => {
    if (!restoreFile) return;
    console.log('Restoring from:', restoreFile.name);
    // wire to API here
    setModal('success-restore');
  };

  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const val = String(i + 1).padStart(2, '0');
    return <option key={val} value={val}>{val}</option>;
  });

  const isWarning = modal === 'no-changes-backup' || modal === 'no-changes-restore';
  const getModalTitle = (): string => {
    switch (modal) {
      case 'success-backup': return 'Success!';
      case 'success-restore': return 'Success!';
      case 'no-changes-backup': return 'No Changes!';
      case 'no-changes-restore': return 'No File Selected!';
      default: return '';
    }
  };

  const getModalMessage = (): string => {
    switch (modal) {
      case 'success-backup': return 'Backup schedule saved successfully!';
      case 'success-restore': return 'Data restored successfully!';
      case 'no-changes-backup': return 'You have not made any changes to the backup schedule.';
      case 'no-changes-restore': return 'Please select a file before restoring.';
      default: return '';
    }
  };
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
              <input
                type="checkbox"
                id="daily"
                checked={dailyEnabled}
                onChange={e => setDailyEnabled(e.target.checked)}
                className={s.checkbox}
              />
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
              <input
                type="checkbox"
                id="weekly"
                checked={weeklyEnabled}
                onChange={e => setWeeklyEnabled(e.target.checked)}
                className={s.checkbox}
              />
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
                  <option value="">Select</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        <div className={s.backupActions}>
          <button className={s.saveBackupBtn} onClick={handleSaveBackup}>
            Save Backup Schedule
          </button>
        </div>

        {/* ── RESTORE DATA ── */}
        <h3 className={s.sectionLabel} style={{ marginTop: '36px' }}>Restore Data</h3>
       <div className={s.restoreCard}>
        <div className={s.browseRow}>
          <span className={s.fileName}>
            {restoreFile ? restoreFile.name : 'No file selected'}
          </span>
          <label className={s.browseBtn}>
            Browse
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleRestoreFile}
            />
          </label>
        </div>
        {restoreFile && (
          <button
            className={s.clearFileBtn}
            onClick={() => setRestoreFile(null)}
            type="button"
          >
            ✕ Remove file
          </button>
        )}
        <button
          className={s.restoreBtn}
          onClick={handleRestore}
          disabled={!restoreFile}
        >
          Restore
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
                  <svg width="75" height="75" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className={s.modalBody}>
              <h3 className={isWarning ? s.modalTitleWarning : s.modalTitle}>
                {getModalTitle()}
              </h3>
              <p className={s.modalMessage}>{getModalMessage()}</p>
              <button className={isWarning ? s.modalOkBtnWarning : s.modalOkBtn}
                onClick={() => setModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}