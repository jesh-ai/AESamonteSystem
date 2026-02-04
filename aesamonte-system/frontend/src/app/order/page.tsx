'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import {
  LuSearch,
  LuEllipsisVertical,
  LuArchive,
  LuChevronUp,
  LuChevronDown,
  LuChevronRight,
  LuPencil
} from 'react-icons/lu';

/* TYPES */
type Order = {
  id: number;
  customer: string;
  date: string;
  status: string;
};

type Summary = {
  shippedToday: { current: number; total: number; yesterday: number };
  cancelled: { current: number; yesterday: number };
  totalOrders: { count: number; growth: number };
};

type SortKey = 'id' | 'customer' | 'date' | 'status' | null;
const ROWS_PER_PAGE = 10;

/* COMPONENTS */
export default function OrderPage({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: Exclude<SortKey, null> | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusCycleIndex, setStatusCycleIndex] = useState(0);

  const statusPriority: Record<string, number> = {
    'TO SHIP': 1,
    'RECEIVED': 2,
    'CANCELLED': 3
  };

  const statusOrder: string[] = ['TO SHIP', 'RECEIVED', 'CANCELLED'];

/* DATABASE FETCH */
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/orders/list').then(res => res.json()).then(setOrders);
    fetch('http://127.0.0.1:5000/api/orders/summary').then(res => res.json()).then(setSummary);
  }, []);

/* FILTER SORT */
  const handleSort = (key: Exclude<SortKey, null>) => {
    if (key === 'status') {
      setStatusCycleIndex((prev) => (prev + 1) % statusOrder.length);
      setSortConfig({ key: 'status', direction: 'asc' });
    } else {
      setSortConfig(prev => {
        if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        return { key, direction: 'asc' };
      });
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter(o =>
      o.id.toString().includes(term) ||
      o.customer.toLowerCase().includes(term) ||
      o.date.toLowerCase().includes(term) ||
      o.status.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const sorted = useMemo(() => {
    const arr = [...filtered];

    if (!sortConfig.key) {
      return arr.sort((a, b) => statusPriority[a.status.toUpperCase()] - statusPriority[b.status.toUpperCase()] || a.id - b.id);
    }

    if (sortConfig.key === 'status') {
      const activeStatus = statusOrder[statusCycleIndex];
      return arr.sort((a, b) => {
        if (a.status === activeStatus && b.status !== activeStatus) return -1;
        if (b.status === activeStatus && a.status !== activeStatus) return 1;
        const priA = statusPriority[a.status.toUpperCase()] ?? 99;
        const priB = statusPriority[b.status.toUpperCase()] ?? 99;
        if (priA !== priB) return priA - priB;
        return a.id - b.id;
      });
    }

    const { key, direction } = sortConfig;
    return arr.sort((a, b) => {
      const priA = statusPriority[a.status.toUpperCase()] ?? 99;
      const priB = statusPriority[b.status.toUpperCase()] ?? 99;
      if (priA !== priB) return priA - priB;
      const A = a[key!];
      const B = b[key!];
      if (A === B) return 0;
      return direction === 'asc' ? (A > B ? 1 : -1) : (A < B ? 1 : -1);
    });
  }, [filtered, sortConfig, statusCycleIndex]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [searchTerm]);
  const changePage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const getStatusStyle = (status: string) => {
    const normalized = status.toUpperCase();
    if (normalized === 'RECEIVED') return styles.pillGreen;
    if (normalized === 'CANCELLED') return styles.pillRed;
    if (normalized === 'TO SHIP') return styles.pillYellow;
    return styles.pillGreen;
  };

  const renderPageNumbers = () => Array.from({ length: totalPages }, (_, i) => (
    <div
      key={i + 1}
      className={`${styles.pageCircle} ${currentPage === i + 1 ? styles.pageCircleActive : ''}`}
      onClick={() => changePage(i + 1)}
    >{i + 1}</div>
  ));

  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />
      <div className={styles.mainContent}>
        <div className={styles.topGrid}>
          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Shipped Today</p>
            <h2 className={styles.bigNumber}>{summary ? `${summary.shippedToday.current}/${summary.shippedToday.total}` : '—'}</h2>
          </section>
          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Orders Cancelled</p>
            <h2 className={styles.bigNumber}>{summary ? summary.cancelled.current : '—'}</h2>
          </section>
          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Total Orders</p>
            <h2 className={styles.bigNumber}>{summary ? summary.totalOrders.count.toLocaleString() : '—'}</h2>
          </section>
        </div>

        <div className={styles.tableContainer}>
          <div className={styles.header}>
            <h2 className={styles.title}>Orders</h2>
            <div className={styles.controls}>
              <button className={styles.archiveIconBtn}><LuArchive size={20} /></button>
              <div className={styles.searchWrapper}>
                <input
                  className={styles.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <LuSearch size={18} />
              </div>
              <button className={styles.addButton}>ADD</button>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                {(['id','customer','date','status'] as const).map(k => (
                  <th key={k} onClick={() => handleSort(k)} className={styles.sortableHeader}>
                    <div className={styles.sortHeaderInner}>
                      <span>{k.toUpperCase()}</span>
                      <div className={styles.sortIconsStack}>
                        <LuChevronUp className={sortConfig.key===k && sortConfig.direction==='asc'?styles.activeSort:''}/>
                        <LuChevronDown className={sortConfig.key===k && sortConfig.direction==='desc'?styles.activeSort:''}/>
                      </div>
                    </div>
                  </th>
                ))}
                <th className={styles.actionHeader}>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((o, i) => (
                <tr key={o.id} className={i%2 ? styles.altRow : ''}>
                  <td>{o.id}</td>
                  <td>{o.customer}</td>
                  <td>{o.date}</td>
                  <td><span className={getStatusStyle(o.status)}>{o.status}</span></td>
                  <td className={styles.actionCell}>
                    <LuEllipsisVertical
                      className={styles.moreIcon}
                      onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)}
                    />
                    {openMenuId === o.id && (
                      <div className={styles.popupMenu}>
                        <button className={styles.popBtnEdit}><LuPencil size={14}/> Edit</button>
                        <button className={styles.popBtnArchive}><LuArchive size={14}/> Archive</button>
                        <button className={styles.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FOOTER */}    
          <div className={styles.footer}>
            <div className={styles.showDataText}>
              Showing <span className={styles.countBadge}>{paginated.length}</span> of {sorted.length}
            </div>
            <div className={styles.pagination}>
              {renderPageNumbers()}
              <button className={styles.nextBtn} onClick={() => changePage(currentPage+1)} disabled={currentPage>=totalPages}>
                <LuChevronRight />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
