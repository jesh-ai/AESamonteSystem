'use client';

import { useState, useRef, useEffect } from 'react';
import styles from "@/css/topheader.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const PREF_TYPE_MAP: Record<string, string[]> = {
  lowStock:   ['low_stock'],
  outOfStock: ['out_of_stock'],
  itemAdded:  ['item_added'],
};

const TYPE_NAV_MAP: Record<string, string> = {
  out_of_stock: 'Inventory',
  low_stock:    'Inventory',
  item_added:   'Inventory',
  pending:      'Orders',
  preparing:    'Orders',
  cancelled:    'Orders',
  received:     'Orders',
  paid:         'Sales',
};

type NotifType = 'out_of_stock' | 'low_stock' | 'item_added' | 'paid' | 'pending' | 'preparing' | 'cancelled' | 'received';

interface Notification {
  id: number;
  key: string;
  type: NotifType;
  label: string;
  reference: string;
  name?: string;
  sku?: string;
  sales_id?: string;
  date: string;
  time: string;
}

const TYPE_COLORS: Record<string, string> = {
  out_of_stock: '#e53e3e',
  low_stock:    '#dd6b20',
  item_added:   '#6b46c1',
  paid:         '#38a169',
  pending:      '#d69e2e',
  preparing:    '#3182ce',
  cancelled:    '#718096',
  received:     '#319795',
};

interface TopHeaderProps {
  role?: string;
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

export default function TopHeader({ role }: TopHeaderProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => loadSet('notifDismissed'));
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>(role ?? '');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getKey = () => {
      try {
        const token = localStorage.getItem('token') ?? '';
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.employee_name) setEmployeeName(payload.employee_name);
        return `profilePicture_${payload.employee_id}`;
      } catch { return null; }
    };

    const key = getKey();
    if (key) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) setProfilePic(stored);
      } catch { /* ignore */ }
    }

    const handlePfpUpdate = () => {
      const k = getKey();
      if (!k) return;
      try { setProfilePic(localStorage.getItem(k) ?? null); } catch { /* ignore */ }
    };
    window.addEventListener('pfp:updated', handlePfpUpdate);
    return () => window.removeEventListener('pfp:updated', handlePfpUpdate);
  }, []);

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

  // All visible = non-dismissed + pref-enabled (always read latest from localStorage)
  const visibleNotifications = notifications.filter((n) => {
    if (dismissedKeys.has(n.key)) return false;
    let prefs = notifPrefs;
    try {
      const saved = localStorage.getItem('notifPreferences');
      if (saved) prefs = JSON.parse(saved);
    } catch { /* ignore */ }
    for (const [prefKey, types] of Object.entries(PREF_TYPE_MAP)) {
      if (types.includes(n.type) && prefs[prefKey] === false) return false;
    }
    return true;
  });

  // Badge = every visible notification is unread until dismissed
  const unreadCount = visibleNotifications.length;

  function getSearchTerm(notif: Notification): string {
    // For inventory alerts, search by item name so the table text-filter matches
    if (['low_stock', 'out_of_stock', 'item_added'].includes(notif.type)) return notif.name ?? notif.reference;
    if (notif.type === 'paid') return notif.sales_id ?? notif.reference;
    return notif.reference;
  }

  function handleNotifClick(notif: Notification) {
    const next = new Set([...dismissedKeys, notif.key]);
    setDismissedKeys(next);
    saveSet('notifDismissed', next);
    setOpen(false);
    const tab = TYPE_NAV_MAP[notif.type];
    if (!tab) return;

    const detail: Record<string, unknown> = { tab, search: getSearchTerm(notif) };

    if (['low_stock', 'out_of_stock', 'item_added'].includes(notif.type)) {
      // reference is inventory_id — destination page will auto-open the view modal
      detail.view_inventory_id = notif.reference;
    }

    window.dispatchEvent(new CustomEvent('app:navigate', { detail }));
  }

  return (
    <header className={styles.header}>
      <div className={styles.welcomeText}>
        Welcome, <strong>{employeeName.split(' ')[0]}!</strong>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.notificationWrapper} ref={panelRef}>
          <div className={styles.bellButton} onClick={() => setOpen((p) => !p)}
           style={{ color: open ? '#c79518' : undefined }}>

            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
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
                      {notif.name && (
                          <span className={styles.notifName}>{notif.name}</span>
                        )}
                        <span className={styles.notifRef}>
                          {['out_of_stock', 'low_stock', 'item_added'].includes(notif.type)
                            ? `Item ID: ${notif.reference}`
                            : notif.type === 'paid' && notif.sales_id
                              ? `Sales ID: ${notif.sales_id}`
                              : `Order ID: ${notif.reference}`}
                        </span>
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

        <div className={styles.avatarContainer} onClick={() => {
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { tab: 'Settings' } }));
          window.dispatchEvent(new CustomEvent('settings:openView', { detail: { view: 'appPreferences' } }));
        }}>
          {profilePic
            ? <img src={profilePic} alt="Profile" className={styles.avatarImage} style={{ objectFit: 'cover' }} />
            : <img src="/ae-logo.png" alt="AE Logo" className={styles.avatarImage} />}
        </div>
      </div>
    </header>
  );
}