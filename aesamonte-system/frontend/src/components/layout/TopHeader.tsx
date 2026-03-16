'use client';

import { useState, useRef, useEffect } from 'react';
import styles from "@/css/topheader.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const PREF_TYPE_MAP: Record<string, string[]> = {
  lowStock:   ['low_stock'],
  outOfStock: ['out_of_stock'],
};

const TYPE_NAV_MAP: Record<string, string> = {
  out_of_stock: 'Inventory',
  low_stock:    'Inventory',
  pending:      'Orders',
  preparing:    'Orders',
  cancelled:    'Orders',
  received:     'Orders',
  paid:         'Orders',
};

type NotifType = 'out_of_stock' | 'low_stock' | 'paid' | 'pending' | 'preparing' | 'cancelled' | 'received';

interface Notification {
  id: number;
  key: string;
  type: NotifType;
  label: string;
  reference: string;
  name?: string;
  sku?: string;
  date: string;
  time: string;
}

const TYPE_COLORS: Record<string, string> = {
  out_of_stock: '#e53e3e',
  low_stock:    '#dd6b20',
  paid:         '#38a169',
  pending:      '#d69e2e',
  preparing:    '#3182ce',
  cancelled:    '#718096',
  received:     '#319795',
};

interface TopHeaderProps {
  role: string;
  onLogout?: () => void;
}

function loadSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveSet(storageKey: string, set: Set<string>) {
  try { localStorage.setItem(storageKey, JSON.stringify([...set])); } catch { /* ignore */ }
}

export default function TopHeader({ role, onLogout }: TopHeaderProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => loadSet('notifDismissed'));
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const saved = localStorage.getItem('notifPreferences');
      if (saved) setNotifPrefs(JSON.parse(saved));
    } catch { /* ignore */ }

    try {
      const res = await fetch(`${API}/api/notifications`, { credentials: 'include' });
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);
    } catch { /* silently fail */ }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // All visible = non-dismissed + pref-enabled
  const visibleNotifications = notifications.filter((n) => {
    if (dismissedKeys.has(n.key)) return false;
    for (const [prefKey, types] of Object.entries(PREF_TYPE_MAP)) {
      if (types.includes(n.type) && notifPrefs[prefKey] === false) return false;
    }
    return true;
  });

  // Badge = every visible notification is unread until dismissed
  const unreadCount = visibleNotifications.length;

  function getSearchTerm(notif: Notification): string {
    if (['out_of_stock', 'low_stock'].includes(notif.type)) {
      return notif.name ?? notif.reference;
    }
    return notif.reference;
  }

  function handleNotifClick(notif: Notification) {
    const next = new Set([...dismissedKeys, notif.key]);
    setDismissedKeys(next);
    saveSet('notifDismissed', next);
    setOpen(false);
    const tab = TYPE_NAV_MAP[notif.type];
    if (tab) {
      window.dispatchEvent(new CustomEvent('app:navigate', {
        detail: { tab, search: getSearchTerm(notif) },
      }));
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.welcomeText}>
        Welcome, <strong>{role}!</strong>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.notificationWrapper} ref={panelRef}>
          <div className={styles.bellButton} onClick={() => setOpen((p) => !p)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount}</span>
            )}
          </div>

          {open && (
            <div className={styles.notifPanel}>
              <div className={styles.notifHeader}>NOTIFICATIONS</div>
              <div className={styles.notifList}>
                {visibleNotifications.length === 0 ? (
                  <div className={styles.notifEmpty}>No notifications</div>
                ) : (
                  visibleNotifications.map((notif) => (
                    <div
                      key={notif.key}
                      className={styles.notifItem}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <span className={styles.notifDot} />
                      <div className={styles.notifLeft}>
                        <span
                          className={styles.notifBadge}
                          style={{ backgroundColor: TYPE_COLORS[notif.type] ?? '#718096' }}
                        >
                          {notif.label}
                        </span>
                        <span className={styles.notifRef}>
                          {notif.sku ? `SKU: ${notif.sku}` : notif.reference}
                        </span>
                        {notif.name && (
                          <span className={styles.notifName}>{notif.name}</span>
                        )}
                      </div>
                      <div className={styles.notifRight}>
                        <span className={styles.notifDate}>{notif.date}</span>
                        <span className={styles.notifTime}>{notif.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.avatarContainer} onClick={onLogout}>
          <img src="/ae-logo.png" alt="AE Logo" className={styles.avatarImage} />
        </div>
      </div>
    </header>
  );
}