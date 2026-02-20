/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import OrderEditModal from './editOrderModal';
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

/* ===================== CONSTANTS ===================== */
const STATUS_PRIORITY: Record<string, number> = {
  'PENDING': 1,
  'PROCESSING': 2,
  'COMPLETED': 3,
  'CANCELLED': 4
};

const STATUS_ORDER: string[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'];

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

export default function OrderPage({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: Exclude<SortKey, null> | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusCycleIndex, setStatusCycleIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastTitle, setToastTitle] = useState('');
  const [isError, setIsError] = useState(false);
  
  /* Holds the data specifically for the Success Alert */
  const [submittedData, setSubmittedData] = useState<any>(null);

  const [formData, setFormData] = useState<OrderFormData>({
    name: '',
    contact: '',
    address: '',
    items: [{ item: '', itemDescription: '', quantity: '', amount: '', orderStatus: '', paymentMethod: '' }]
  });

  const s = styles;

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.items[0].item === '') {
      setToastTitle("Oops!");
      setToastMessage("Please provide the customer name and item details.");
      setIsError(true);
      setShowToast(true);
      return;
    }

    setSubmittedData({
      customer: formData.name,
      total: formData.items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      method: formData.items[0]?.paymentMethod || '—',
      dateTime: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    setShowModal(false);
    setToastTitle("Order Submitted!");
    setToastMessage("Your new order has been successfully added.");
    setIsError(false);
    setShowToast(true);
    
    setFormData({
      name: '', contact: '', address: '',
      items: [{ item: '', itemDescription: '', quantity: '', amount: '', orderStatus: '', paymentMethod: '' }]
    });
  };

  const handleOpenEdit = (order: Order) => {
    setSelectedOrderForEdit({
      id: order.id,
      Customer: order.customer,
      contact: '', 
      Delivery: order.address, 
      item: order.items?.[0]?.item_name || '', 
      quantity: order.totalQty,
      amount: order.totalAmount, 
      status: order.status,
      paymentMethod: order.paymentMethod
    });
    setOpenMenuId(null);
    setShowEditModal(true);
  };

  /* UPDATED EDIT HANDLER WITH ERROR CHECKING */
  const handleUpdateSave = (updatedOrder: any) => {
    // 1. Check for Empty Inputs
    if (!updatedOrder.customerName || !updatedOrder.status) {
        setToastTitle("Oops!");
        setToastMessage("No changes to save.");
        setIsError(true);
        setShowToast(true);
        return;
    }

    // 2. Check for No Changes
    const original = orders.find(o => o.id === updatedOrder.id);
    if (original?.customer === updatedOrder.customerName && original?.status === updatedOrder.status) {
        setToastTitle("No Changes Detected");
        setToastMessage("No updates were made to the order.");
        setIsError(true);
        setShowToast(true);
        setShowEditModal(false);
        return;
    }

    // 3. Successful Update Logic
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, customer: updatedOrder.customerName, status: updatedOrder.status } : o));
    setShowEditModal(false);
    setToastTitle("Updated Successfully!");
    setToastMessage("Order details updated successfully.");
    setIsError(false);
    setShowToast(true);
    setSubmittedData(null); // Ensure summary table doesn't show for edits
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
      case 'PENDING': return `${baseClass} ${s.pillBlue}`;
      case 'PROCESSING': return `${baseClass} ${s.pillYellow}`;
      case 'COMPLETED': return `${baseClass} ${s.pillGreen}`;
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

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {/* SUCCESS/ERROR ALERT MODAL */}
      {showToast && (
        <div className={s.toastOverlay}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
                {isError ? '!' : '✓'}
              </div>
            </div>
            
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{toastTitle}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>

              {!isError && submittedData && (
                <div className={s.alertDataTable}>
                  <div className={s.alertDataRow}>
                    <span>Customer:</span>
                    <strong>{submittedData.customer}</strong>
                  </div>
                  <div className={s.alertDataRow}>
                    <span>Total Amount:</span>
                    <strong>₱{submittedData.total.toLocaleString()}</strong>
                  </div>
                  <div className={s.alertDataRow}>
                    <span>Payment Method:</span>
                    <strong>{submittedData.method}</strong>
                  </div>
                  <div className={s.alertDataRow}>
                    <span>Date & Time:</span>
                    <strong>{submittedData.dateTime}</strong>
                  </div>
                </div>
              )}

              <button 
                className={`${s.okButton} ${isError ? s.okButtonError : ''}`} 
                onClick={() => {
                  setShowToast(false);
                  setSubmittedData(null);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th onClick={() => handleSort('id')} className={s.sortableHeader}>ID</th>
                <th onClick={() => handleSort('customer')} className={s.sortableHeader}>CUSTOMER</th>
                <th className={s.headerText}>ADDRESS</th>
                <th className={s.headerText}>QTY</th>
                <th className={s.headerText}>TOTAL</th>
                <th className={s.headerText}>PAYMENT</th>
                <th onClick={() => handleSort('date')} className={s.sortableHeader}>DATE</th>
                <th onClick={() => handleSort('status')} className={s.sortableHeader}>STATUS</th>
                <th className={`${s.actionHeader} text-center`}>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((o, i) => (
                <tr key={o.id} className={i % 2 ? s.altRow : ''}>
                  <td>{o.id}</td>
                  <td><strong>{o.customer}</strong></td>
                  <td>{o.address}</td>
                  <td>{o.totalQty}</td>
                  <td>₱{o.totalAmount?.toLocaleString()}</td>
                  <td>{o.paymentMethod}</td>
                  <td>{o.date}</td>
                  <td><span className={getStatusStyle(o.status)}>{o.status}</span></td>
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

      {showModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h3 className={s.headerTitle}>General Information</h3>
              <div className={s.headerActions}>
                <span className={getStatusStyle(formData.items[0]?.orderStatus)}>
                  {formData.items[0]?.orderStatus ? formData.items[0].orderStatus.toUpperCase() : 'STATUS'}
                </span>
                <LuX onClick={() => setShowModal(false)} className={s.closeIcon} />
              </div>
            </div>

            <form onSubmit={handleSave} className={s.modalForm}>
              <div className={s.formGridTwo}>
                <div className={s.formGroup}><label>Customer Name</label><input name="name" value={formData.name} onChange={handleInputChange} /></div>
                <div className={s.formGroup}><label>Contact Number</label><input name="contact" value={formData.contact} onChange={handleInputChange} /></div>
              </div>
              <div className={s.formGroupFull}><label>Delivery Address</label><input name="address" value={formData.address} className={s.addressInput} onChange={handleInputChange} /></div>
              <hr className={s.divider} />
              <div className={s.sectionHeader}>
                <h4 className={s.sectionTitle}>Order</h4>
                <button type="button" onClick={addItem} className={s.addLinkBtn}><LuPlus size={14} /> Add Item</button>
              </div>

              {formData.items.map((itemRow, index) => (
                <div key={index} className={s.itemRowContainer}>
                  {index > 0 && <hr className={s.itemDivider} />}
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
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className={s.formGroup}>
                      <label>Payment Method</label>
                      <select name="paymentMethod" value={itemRow.paymentMethod} onChange={(e) => handleItemChange(index, e)}>
                        <option value=""></option>
                        <option value="cash">Cash</option>
                        <option value="gcash">G-Cash</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                  {formData.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className={s.removeItemBtn}>Remove Item</button>
                  )}
                </div>
              ))}
              <button type="submit" className={s.saveBtn}>Save</button>
            </form>
          </div>
        </div>
      )}

      <OrderEditModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        orderData={selectedOrderForEdit}
        onSave={handleUpdateSave}
      />
    </div>
  );
}