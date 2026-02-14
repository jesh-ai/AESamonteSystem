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
  LuPencil,
  LuX,
  LuPlus // Added for the Add Item button
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

// Updated Type to handle multiple items
interface OrderItem {
  item: string;
  itemDescription: string;
  quantity: string;
  amount: string;
  orderStatus: string;
  paymentMethod: string;
}

interface OrderFormData {
  name?: string;
  contact?: string;
  address?: string;
  items: OrderItem[]; // Now an array
}

type SortKey = 'id' | 'customer' | 'date' | 'status' | null;
const ROWS_PER_PAGE = 10;

export default function OrderPage({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: Exclude<SortKey, null> | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusCycleIndex, setStatusCycleIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  
  // Initial state now includes one empty item row
  const [formData, setFormData] = useState<OrderFormData>({
    name: '',
    contact: '',
    address: '',
    items: [{ item: '', itemDescription: '', quantity: '', amount: '', orderStatus: '', paymentMethod: '' }]
  });

  const s = styles; 

  const statusPriority: Record<string, number> = {
    'TO SHIP': 1,
    'RECEIVED': 2,
    'CANCELLED': 3
  };
  const statusOrder: string[] = ['TO SHIP', 'RECEIVED', 'CANCELLED'];

  /* FETCH DATA */
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/orders/list').then(res => res.json()).then(setOrders);
    fetch('http://127.0.0.1:5000/api/orders/summary').then(res => res.json()).then(setSummary);
  }, []);

  /* HANDLERS */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // New handler for item-specific fields
  const handleItemChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [name]: value };
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  // Logic to add a new item row
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item: '', itemDescription: '', quantity: '', amount: '', orderStatus: '', paymentMethod: '' }]
    }));
  };

  // Logic to remove an item row
  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, items: newItems }));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Saving order data:", formData);
    setShowModal(false);
  };

  /* SORT HANDLER */
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

  /* FILTER */
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter(o =>
      o.id.toString().includes(term) ||
      o.customer.toLowerCase().includes(term) ||
      o.date.toLowerCase().includes(term) ||
      o.status.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  /* SORT */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortConfig.key === 'status') {
      const activeStatus = statusOrder[statusCycleIndex];
      return arr.sort((a, b) => {
        if (a.status === activeStatus && b.status !== activeStatus) return -1;
        if (b.status === activeStatus && a.status !== activeStatus) return 1;
        return statusPriority[a.status.toUpperCase()] - statusPriority[b.status.toUpperCase()] || a.id - b.id;
      });
    }
    if (!sortConfig.key) {
      return arr.sort((a, b) => (statusPriority[a.status.toUpperCase()] || 0) - (statusPriority[b.status.toUpperCase()] || 0) || a.id - b.id);
    }
    const { key, direction } = sortConfig;
    return arr.sort((a, b) => {
      const A = a[key as keyof Order];
      const B = b[key as keyof Order];
      if (key === 'id') return direction === 'asc' ? (A as number) - (B as number) : (B as number) - (A as number);
      if (key === 'date') return direction === 'asc' ? new Date(A as string).getTime() - new Date(B as string).getTime() : new Date(B as string).getTime() - new Date(A as string).getTime();
      const strA = (A as string).toLowerCase();
      const strB = (B as string).toLowerCase();
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig, statusCycleIndex]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE) || 1;
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [searchTerm]);
  const changePage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const getStatusStyle = (status: string | undefined) => {
    const baseClass = styles.statusBadge; 
    if (!status || status === "" || status === "Select") return baseClass;

    const normalized = status.toUpperCase();

    if (normalized === 'RECEIVED') {
      return `${baseClass} ${styles.pillGreen}`;
    }
    if (normalized === 'CANCELLED') {
      return `${baseClass} ${styles.pillRed}`;
    }
    if (normalized === 'TO SHIP' || normalized === 'PENDING') {
      return `${baseClass} ${styles.pillYellow}`;
    }

    return baseClass;
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
              <button className={styles.addButton} onClick={() => setShowModal(true)}>ADD</button>
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
                <th className={`${styles.actionHeader} text-center`}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((o, i) => (
                <tr key={o.id} className={i%2 ? styles.altRow : ''}>
                  <td>{o.id}</td>
                  <td>{o.customer}</td>
                  <td>{o.date}</td>
                  <td><span className={getStatusStyle(o.status)}>{o.status}</span></td>
                  <td className={`${styles.actionCell} text-center`}>
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

      {/* ================= MODAL ================= */}
      {showModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.headerTitle}>General Information</h3>
              <div className={s.headerActions}>
                {/* Fixed reference to first item status for the badge */}
                <span className={getStatusStyle(formData.items[0]?.orderStatus)}>
                  {formData.items[0]?.orderStatus ? formData.items[0].orderStatus.toUpperCase() : 'STATUS'}
                </span>
                <LuX onClick={() => setShowModal(false)} className={s.closeIcon} />
              </div>
            </div>

            <form onSubmit={handleSave} className={s.modalForm}>
              <div className={s.formGridTwo}>
                <div className={s.formGroup}>
                  <label>Name</label>
                  <input name="name" value={formData.name} onChange={handleInputChange} />
                </div>
                <div className={s.formGroup}>
                  <label>Contact</label>
                  <input name="contact" value={formData.contact} onChange={handleInputChange} />
                </div>
              </div>
              
              <div className={s.formGroupFull}>
                <label>Address</label>
                <input name="address" value={formData.address} className={s.addressInput} onChange={handleInputChange} />
              </div>

              <hr className={s.divider} />

              <div className={s.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className={s.sectionTitle}>Order</h4>
                <button type="button" onClick={addItem} className={s.addLinkBtn} style={{ color: '#2563eb', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <LuPlus size={14} /> Add Item
                </button>
              </div>
              
              {formData.items.map((itemRow, index) => (
                <div key={index} className={s.itemRowContainer} style={{ marginBottom: '20px', position: 'relative' }}>
                  {index > 0 && <hr className={s.itemDivider} style={{ borderTop: '1px dashed #ccc', margin: '15px 0' }} />}
                  
                  <div className={s.formGridThree}>
                    <div className={s.formGroup}><label>Item</label><input name="item" value={itemRow.item} onChange={(e) => handleItemChange(index, e)} /></div>
                    <div className={s.formGroup}><label>Item Description</label><input name="itemDescription" value={itemRow.itemDescription} onChange={(e) => handleItemChange(index, e)} /></div>
                    <div className={s.formGroup}><label>Quantity</label><input type="number" name="quantity" value={itemRow.quantity} onChange={(e) => handleItemChange(index, e)} /></div>
                  </div>

                  <div className={s.formGridThree}>
                    <div className={s.formGroup}><label>Amount</label><input name="amount" value={itemRow.amount} onChange={(e) => handleItemChange(index, e)} /></div>
                    <div className={s.formGroup}>
                      <label>Status</label>
                      <select name="orderStatus" value={itemRow.orderStatus} onChange={(e) => handleItemChange(index, e)}>
                        <option value="">Select</option>
                        <option value="To Ship">To Ship</option>
                        <option value="Received">Received</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className={s.formGroup}>
                      <label>Payment Method</label>
                      <select name="paymentMethod" value={itemRow.paymentMethod} onChange={(e) => handleItemChange(index, e)}>
                        <option value=""></option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  {formData.items.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeItem(index)} 
                      style={{ color: 'red', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', marginTop: '5px' }}
                    >
                      Remove Item
                    </button>
                  )}
                </div>
              ))}

              <div className={s.modalFooter}>
                <button type="button" onClick={() => setShowModal(false)} className={s.cancelBtn}>Cancel</button>
                <button type="submit" className={s.saveBtn}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}