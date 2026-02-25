/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import OrderEditModal from './editOrderModal';
import AddOrderModal from './addOrderModal';
import {
  LuSearch,
  LuEllipsisVertical,
  LuArchive,
  LuChevronUp,
  LuChevronDown,
  LuChevronRight,
  LuPencil,
  LuX,
  LuPlus
} from 'react-icons/lu';

/* ===================== CONSTANTS (Moved Outside to Fix Lint Errors) ===================== */
const STATUS_PRIORITY: Record<string, number> = {
  'TO SHIP': 1,
  'RECEIVED': 2,
  'CANCELLED': 3
};

const STATUS_ORDER: string[] = ['TO SHIP', 'RECEIVED', 'CANCELLED'];

const ITEM_STATUS_MAP: Record<number, string> = {
  1: 'AVAILABLE',
  2: 'PARTIALLY_AVAILABLE',
  3: 'OUT_OF_STOCK'
};

const ROWS_PER_PAGE = 10;

/* ===================== TYPES ===================== */
type OrderItemBackend = {
  inventory_id: number;
  order_quantity: number;
  available_quantity: number;
  item_status_id: number;
  item_status?: string;
  item_name?: string;
};

type Order = {
  id: number;
  customer: string;
  contact?: string;
  address: string;
  date: string;
  status: string;
  paymentMethod: string;
  totalQty: number;
  totalAmount: number;
  items?: OrderItemBackend[];
};

type Summary = {
  shippedToday: { current: number; total: number; yesterday: number };
  cancelled: { current: number; yesterday: number };
  totalOrders: { count: number; growth: number };
};

interface OrderFormItem {
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
  items: OrderFormItem[];
}

type SortKey = 'id' | 'customer' | 'date' | 'status' | null;

/* ===================== COMPONENT ===================== */
export default function OrderPage({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: Exclude<SortKey, null> | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusCycleIndex, setStatusCycleIndex] = useState(0);
  const [showAddModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [orderStatuses, setOrderStatuses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  const [formData, setFormData] = useState<OrderFormData>({
    name: '',
    contact: '',
    address: '',
    items: [{ item: '', itemDescription: '', quantity: '', amount: '', orderStatus: '', paymentMethod: '' }]
  });

  const s = styles;

  /* ===================== FETCH DATA ===================== */
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/orders/list')
      .then(res => res.json())
      .then((data: Order[]) => {
        const mappedOrders = data.map(order => {
          const items = order.items?.map(item => ({
            ...item,
            item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
          }));

          return { ...order, items };
        });
        setOrders(mappedOrders);
      })
      .catch(err => console.error('Error fetching orders:', err));

    fetch('http://127.0.0.1:5000/api/orders/summary')
      .then(res => res.json())
      .then(setSummary)
      .catch(err => console.error('Error fetching summary:', err));
  }, []);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        // Corrected URL: /api/orders/status
        const statusRes = await fetch("http://127.0.0.1:5000/api/orders/status?scope=ORDER_STATUS");
        if (statusRes.ok) setOrderStatuses(await statusRes.json());

        // Corrected URL: /api/orders/status
        const paymentRes = await fetch("http://127.0.0.1:5000/api/orders/status?scope=PAYMENT_METHOD");
        if (paymentRes.ok) setPaymentMethods(await paymentRes.json());

      } catch (err) {
        console.error("Failed to fetch dropdowns", err);
      }
    };
    fetchDropdowns();
  }, []);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const statusRes = await fetch("http://127.0.0.1:5000/api/orders/status?scope=ORDER_STATUS");
        if (statusRes.ok) setOrderStatuses(await statusRes.json());

        const paymentRes = await fetch("http://127.0.0.1:5000/api/orders/status?scope=PAYMENT_METHOD");
        if (paymentRes.ok) setPaymentMethods(await paymentRes.json());

        // ---> NEW: Fetch Inventory Items for the Dropdowns
        const invRes = await fetch("http://127.0.0.1:5000/api/inventory");
        if (invRes.ok) setInventoryItems(await invRes.json());

      } catch (err) {
        console.error("Failed to fetch dropdowns", err);
      }
    };
    fetchDropdowns();
  }, []);

  /* ===================== HANDLERS ===================== */
  
  // FIX: Reset page here instead of using useEffect
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); 
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [name]: value };
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item: '', itemDescription: '', quantity: '', amount: '', orderStatus: '', paymentMethod: '' }]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, items: newItems }));
    }
  };

  const handleSave = async (newOrderData: any) => {
    try {
      // 1. Send the newly created order data to Python
      const response = await fetch(`http://127.0.0.1:5000/api/orders/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrderData),
      });

      if (response.ok) {
        // 2. Re-fetch instantly to update table visually
        const listRes = await fetch('http://127.0.0.1:5000/api/orders/list');
        const data: Order[] = await listRes.json();
        const mappedOrders = data.map(order => {
          const items = order.items?.map(item => ({
            ...item,
            item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
          }));
          return { ...order, items };
        });
        setOrders(mappedOrders);
        
        // 3. Close the modal
        setShowModal(false);
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          alert(`Failed to save: ${errorData.error}`);
        } else {
          alert("Server error. Check your Python terminal!");
        }
      }
    } catch (err) {
      console.error("Error adding order:", err);
      alert("Network Error: Is Flask running?");
    }
  };

  const handleOpenEdit = (order: Order) => {
    setSelectedOrderForEdit({
      id: order.id,
      name: order.customer,
      contact: order.contact || '', // <--- FIXED mapping
      address: order.address, 
      status: order.status,
      paymentMethod: order.paymentMethod,
      items: order.items 
    });
    setOpenMenuId(null);
    setShowEditModal(true);
  };
  
  const handleUpdateSave = async (updatedOrder: any) => {
    try {
      // 1. Send the edited data to Python
      const response = await fetch(`http://127.0.0.1:5000/api/orders/update/${updatedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedOrder),
      });

      if (response.ok) {
        // 2. If successful, instantly re-fetch the table list so the screen updates!
        fetch('http://127.0.0.1:5000/api/orders/list')
          .then(res => res.json())
          .then((data: Order[]) => {
            const mappedOrders = data.map(order => {
              const items = order.items?.map(item => ({
                ...item,
                item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
              }));
              return { ...order, items };
            });
            setOrders(mappedOrders);
          });
          
        // 3. Close the modal
        setShowEditModal(false);
      } else {
        const errorData = await response.json();
        alert(`Failed to save: ${errorData.error}`);
      }
    } catch (err) {
      console.error("Error updating order:", err);
      alert("Something went wrong while saving.");
    }
  };

  const handleSort = (key: Exclude<SortKey, null>) => {
    if (key === 'status') {
      setStatusCycleIndex(prev => (prev + 1) % STATUS_ORDER.length);
      setSortConfig({ key: 'status', direction: 'asc' });
    } else {
      setSortConfig(prev => {
        if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        return { key, direction: 'asc' };
      });
    }
  };

  /* ===================== FILTER & SORT ===================== */
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
    if (sortConfig.key === 'status') {
      const activeStatus = STATUS_ORDER[statusCycleIndex];
      return arr.sort((a, b) => {
        if (a.status === activeStatus && b.status !== activeStatus) return -1;
        if (b.status === activeStatus && a.status !== activeStatus) return 1;
        return (STATUS_PRIORITY[a.status.toUpperCase()] || 0) - (STATUS_PRIORITY[b.status.toUpperCase()] || 0) || a.id - b.id;
      });
    }
    if (!sortConfig.key) {
      return arr.sort((a, b) => (STATUS_PRIORITY[a.status.toUpperCase()] || 0) - (STATUS_PRIORITY[b.status.toUpperCase()] || 0) || a.id - b.id);
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

  const changePage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const getStatusStyle = (status: string | undefined) => {
    const baseClass = s.statusBadge;
    if (!status || status.trim() === '' || status.toLowerCase() === 'select') return baseClass;

    switch (status.toUpperCase()) {
      case 'PREPARING': return `${baseClass} ${s.pillBlue}`;
      case 'TO SHIP': return `${baseClass} ${s.pillYellow}`;
      case 'RECEIVED': return `${baseClass} ${s.pillGreen}`;
      case 'CANCELLED': return `${baseClass} ${s.pillRed}`;
      default: return baseClass;
    }
  };

  const renderPageNumbers = () => Array.from({ length: totalPages }, (_, i) => (
    <div
      key={i + 1}
      className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
      onClick={() => changePage(i + 1)}
    >{i + 1}</div>
  ));

  /* ===================== RENDER ===================== */
  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />
      <div className={s.mainContent}>
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Shipped Today</p>
            <h2 className={s.bigNumber}>{summary ? `${summary.shippedToday.current}/${summary.shippedToday.total}` : '—'}</h2>
          </section>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Orders Cancelled</p>
            <h2 className={s.bigNumber}>{summary ? summary.cancelled.current : '—'}</h2>
          </section>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Orders</p>
            <h2 className={s.bigNumber}>{summary ? summary.totalOrders.count.toLocaleString() : '—'}</h2>
          </section>
        </div>

        <div className={s.tableContainer}>
          <div className={s.header}>
            <h2 className={s.title}>Orders</h2>
            <div className={s.controls}>
              <button className={s.archiveIconBtn}><LuArchive size={20} /></button>
              <div className={s.searchWrapper}>
                <input
                  className={s.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                <LuSearch size={18} />
              </div>
              <button className={s.addButton} onClick={() => setShowModal(true)}>ADD</button>
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                {/* ID: Center */}
                <th onClick={() => handleSort('id')} className={s.sortableHeader} style={{ textAlign: 'center' }}>
                  <div className={s.sortHeaderInner} style={{ justifyContent: 'center' }}>
                    <span>ID</span>
                    <div className={s.sortIconsStack}>
                      <LuChevronUp className={sortConfig.key === 'id' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                      <LuChevronDown className={sortConfig.key === 'id' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>

                {/* CUSTOMER: Left */}
                <th onClick={() => handleSort('customer')} className={s.sortableHeader} style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                  <div className={s.sortHeaderInner} style={{ justifyContent: 'flex-start' }}>
                    <span>CUSTOMER</span>
                    <div className={s.sortIconsStack}>
                       <LuChevronUp className={sortConfig.key === 'customer' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                       <LuChevronDown className={sortConfig.key === 'customer' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>

                {/* ADDRESS: Left (Matches data) */}
                <th className={s.headerText} style={{ textAlign: 'left' }}>ADDRESS</th>

                {/* QTY: Center */}
                <th className={s.headerText} style={{ textAlign: 'center' }}>QTY</th>

                {/* TOTAL: Right (Standard for currency) */}
                <th className={s.headerText} style={{ textAlign: 'right' }}>TOTAL</th>

                {/* PAYMENT: Center */}
                <th className={s.headerText} style={{ textAlign: 'center' }}>PAYMENT</th>

                {/* DATE: Center */}
                <th onClick={() => handleSort('date')} className={s.sortableHeader} style={{ textAlign: 'center' }}>
                   <div className={s.sortHeaderInner} style={{ justifyContent: 'center' }}>
                    <span>DATE</span>
                    <div className={s.sortIconsStack}>
                       <LuChevronUp className={sortConfig.key === 'date' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                       <LuChevronDown className={sortConfig.key === 'date' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>

                {/* STATUS: Center */}
                <th onClick={() => handleSort('status')} className={s.sortableHeader} style={{ textAlign: 'center' }}>
                  <div className={s.sortHeaderInner} style={{ justifyContent: 'center' }}>
                    <span>STATUS</span>
                    <div className={s.sortIconsStack}>
                       <LuChevronUp className={sortConfig.key === 'status' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                       <LuChevronDown className={sortConfig.key === 'status' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>

                <th className={`${s.actionHeader} text-center`}>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((o, i) => (
                <tr key={o.id} className={i % 2 ? s.altRow : ''}>
                  
                  {/* ID */}
                  <td style={{ textAlign: 'center' }}>{o.id}</td>

                  {/* Customer */}
                  <td style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                    <div className="font-bold">{o.customer}</div>
                  </td>

                  {/* Address */}
                  <td style={{ 
                    textAlign: 'left', 
                    maxWidth: '200px', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}>
                    {o.address}
                  </td>

                  {/* Qty */}
                  <td style={{ textAlign: 'center' }}>{o.totalQty}</td>

                  {/* Total */}
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₱{o.totalAmount?.toLocaleString()}</td>

                  {/* Payment */}
                  <td style={{ textAlign: 'center' }}>{o.paymentMethod}</td>

                  {/* Date */}
                  <td style={{ textAlign: 'center' }}>{o.date}</td>

                  {/* Status */}
                  <td style={{ textAlign: 'center' }}><span className={getStatusStyle(o.status)}>{o.status}</span></td>

                  {/* Action */}
                  <td className={`${s.actionCell} text-center`}>
                    <LuEllipsisVertical
                      className={s.moreIcon}
                      onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)}
                    />
                    {openMenuId === o.id && (
                      <div className={s.popupMenu}>
                        <button className={s.popBtnEdit} onClick={() => handleOpenEdit(o)}>
                          <LuPencil size={14} /> Edit
                        </button>
                        <button className={s.popBtnArchive}><LuArchive size={14} /> Archive</button>
                        <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.footer}>
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}
            </div>
            <div className={s.pagination}>
              {renderPageNumbers()}
              <button className={s.nextBtn} onClick={() => changePage(currentPage + 1)} disabled={currentPage >= totalPages}>
                <LuChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}
      
      <AddOrderModal 
        isOpen={showAddModal} 
        onClose={() => setShowModal(false)} 
        onSave={handleSave}
        statuses={orderStatuses} 
        paymentMethods={paymentMethods} 
        inventoryItems={inventoryItems} /* <--- ADD THIS LINE */
      />

      <OrderEditModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        orderData={selectedOrderForEdit}
        onSave={handleUpdateSave}
        statuses={orderStatuses} 
        paymentMethods={paymentMethods} 
        inventoryItems={inventoryItems}
      />
    </div>
  );
}