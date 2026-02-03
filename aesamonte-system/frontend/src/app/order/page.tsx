'use client';

import { useEffect, useState } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import {
  LuSearch,
  LuEllipsisVertical,
  LuChevronUp,
  LuChevronDown,
  LuArchive,
  LuTruck
} from 'react-icons/lu';

/* ================= TYPES ================= */
type Order = {
  id: number;
  customer: string;
  date: string;
  status: string;
};

type Summary = {
  shippedToday: {
    current: number;
    total: number;
    yesterday: number;
  };
  cancelled: {
    current: number;
    yesterday: number;
  };
  totalOrders: {
    count: number;
    growth: number;
  };
};

type SortKey = 'id' | 'customer' | 'date' | 'status' | null;

/* ================= COMPONENT ================= */
const OrderPage = ({ role, onLogout }: { role: string; onLogout: () => void }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  /* ================= FETCH ================= */
  useEffect(() => {
    fetchOrders();
    fetchSummary();
  }, []);

  const fetchOrders = async () => {
    const res = await fetch('http://127.0.0.1:5000/api/orders/list');
    const data = await res.json();
    setOrders(data);
  };

  const fetchSummary = async () => {
    const res = await fetch('http://127.0.0.1:5000/api/orders/summary');
    const data = await res.json();
    setSummary(data);
  };

  /* ================= DERIVED ================= */
  const filteredOrders = orders.filter(o =>
    `${o.id} ${o.customer} ${o.date} ${o.status}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: SortKey, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  };

  /* ================= UI ================= */
  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={styles.mainContent}>
        {/* ================= SUMMARY ================= */}
        <div className={styles.topGrid}>
          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Shipped Today</p>
            <div className={styles.cardMainRow}>
              <LuTruck size={34} />
              <h2 className={`${styles.bigNumber} ${styles.greenText}`}>
                {summary
                  ? `${summary.shippedToday.current}/${summary.shippedToday.total}`
                  : '—'}
              </h2>
            </div>
            <div className={styles.cardFooter}>
              <span>Shipped Yesterday</span>
              <span className={styles.greenText}>
                {summary ? summary.shippedToday.yesterday : '—'}
              </span>
            </div>
          </section>

          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Orders Cancelled</p>
            <h2 className={`${styles.bigNumber} ${styles.redText} ${styles.textCenter}`}>
              {summary ? summary.cancelled.current : '—'}
            </h2>
          </section>

          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Total Orders</p>
            <h2 className={`${styles.bigNumber} ${styles.yellowText} ${styles.textCenter}`}>
              {summary ? summary.totalOrders.count.toLocaleString() : '—'}
            </h2>
          </section>
        </div>

        {/* ================= TABLE ================= */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h1 className={styles.title}>Orders</h1>

            <div className={styles.headerControls}>
              <button className={styles.archiveIconBtn}>
                <LuArchive size={18} />
              </button>

              <div className={styles.searchWrapper}>
                <input
                  className={styles.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <LuSearch className={styles.searchIcon} />
              </div>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  { label: 'ID', key: 'id' },
                  { label: 'CUSTOMER', key: 'customer' },
                  { label: 'DATE', key: 'date' },
                  { label: 'STATUS', key: 'status' }
                ].map(col => (
                  <th key={col.key}>
                    {col.label}
                    <LuChevronUp onClick={() => requestSort(col.key as SortKey, 'asc')} />
                    <LuChevronDown onClick={() => requestSort(col.key as SortKey, 'desc')} />
                  </th>
                ))}
                <th className={styles.actionHeader}>Action</th>
              </tr>
            </thead>

            <tbody>
              {sortedOrders.length ? (
                sortedOrders.map((order, i) => (
                  <tr
                    key={order.id}
                    className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}
                  >
                    <td>{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.date}</td>
                    <td
                      className={
                        order.status === 'RECEIVED'
                          ? styles.statusReceived
                          : styles.statusToShip
                      }
                    >
                      {order.status}
                    </td>
                    <td className={styles.actionCell}>
                      <LuEllipsisVertical
                        className={styles.moreIcon}
                        onClick={() =>
                          setOpenMenuId(openMenuId === order.id ? null : order.id)
                        }
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className={styles.footer}>
            Showing {sortedOrders.length} of {orders.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPage;
