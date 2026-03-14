/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import OrderEditModal from './editOrderModal';
import AddOrderModal from './addOrderModal';
import ArchiveTable from './archiveOrderModal';
import { 
  LuSearch, LuChevronUp, LuChevronDown, LuEllipsisVertical, 
  LuArchive, LuChevronRight, LuPencil, LuX, LuPrinter
} from 'react-icons/lu';

const STATUS_PRIORITY: Record<string, number> = { 'TO SHIP': 1, 'RECEIVED': 2, 'CANCELLED': 3 };
const STATUS_ORDER: string[] = ['TO SHIP', 'RECEIVED', 'CANCELLED'];
const ITEM_STATUS_MAP: Record<number, string> = { 1: 'AVAILABLE', 2: 'PARTIALLY_AVAILABLE', 3: 'OUT_OF_STOCK' };
const ROWS_PER_PAGE = 10;

type OrderItemBackend = {
  inventory_id: number; order_quantity: number; available_quantity: number;
  item_status_id: number; item_status?: string; item_name?: string;
};

export type Order = {
  id: number; customer: string; contact?: string; address: string;
  date: string; status: string; paymentMethod: string;
  totalQty: number; totalAmount: number; items?: OrderItemBackend[]; is_archived?: boolean;
};

type Summary = {
  shippedToday: { current: number; total: number; yesterday: number };
  cancelled: { current: number; yesterday: number };
  totalOrders: { count: number; growth: number };
};

type SortKey = 'id' | 'customer' | 'address' | 'qty' | 'total' | 'payment' | 'date' | 'status' | null;

const getViewStatusClass = (status: string, s: Record<string, string>) => {
  switch (status?.toUpperCase()) {
    case 'PREPARING': return s.viewStatusPreparing;
    case 'TO SHIP':   return s.viewStatusToShip;
    case 'RECEIVED':  return s.viewStatusReceived;
    case 'CANCELLED': return s.viewStatusCancelled;
    default:          return s.viewStatusDefault;
  }
};

export default function OrderPage({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: Exclude<SortKey, null> | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusCycleIndex, setStatusCycleIndex] = useState(0);
  const [isArchiveView, setIsArchiveView] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [orderStatuses, setOrderStatuses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const s = styles;

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/orders/list');
      const data: Order[] = await res.json();
      setOrders(data.map(order => ({
        ...order,
        items: order.items?.map(item => ({
          ...item,
          item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
        }))
      })));
    } catch (err) { console.error('Error fetching orders:', err); }
  };

  useEffect(() => {
    fetchOrders();
    fetch('http://127.0.0.1:5000/api/orders/summary').then(r => r.json()).then(setSummary);
    const fetchDropdowns = async () => {
      try {
        const [sR, pR, iR] = await Promise.all([
          fetch("http://127.0.0.1:5000/api/orders/status?scope=ORDER_STATUS"),
          fetch("http://127.0.0.1:5000/api/orders/status?scope=PAYMENT_METHOD"),
          fetch("http://127.0.0.1:5000/api/inventory")
        ]);
        if (sR.ok) setOrderStatuses(await sR.json());
        if (pR.ok) setPaymentMethods(await pR.json());
        if (iR.ok) setInventoryItems(await iR.json());
      } catch (err) { console.error("Dropdown fetch error", err); }
    };
    fetchDropdowns();
  }, []);

  const handleSave = async (newOrderData: any) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newOrderData),
      });
      if (response.ok) {
        setSubmittedData({
          customer: newOrderData.customer,
          total: newOrderData.items?.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) || 0,
          method: newOrderData.payment_method || newOrderData.paymentMethod || newOrderData.items[0]?.paymentMethod || '—',
          dateTime: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        setToastTitle("Order Submitted!"); setToastMessage("Your new order has been successfully added.");
        setIsError(false); setShowToast(true); setShowAddModal(false); fetchOrders();
      } else {
        const errData = await response.json();
        setToastTitle("Oops!"); setToastMessage(errData.error || "Failed to save order.");
        setIsError(true); setShowToast(true);
      }
    } catch { setToastTitle("Network Error"); setToastMessage("Could not connect to the server."); setIsError(true); setShowToast(true); }
  };

  const handleUpdateSave = async (updatedOrder: any) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/update/${updatedOrder.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedOrder),
      });
      if (response.ok) {
        setToastTitle("Updated!"); setToastMessage("The order record has been successfully updated.");
        setIsError(false); setSubmittedData(null); setShowToast(true); setShowEditModal(false); fetchOrders();
      } else { setToastTitle("Update Failed"); setToastMessage("Failed to update order."); setIsError(true); setShowToast(true); }
    } catch (err) { console.error(err); }
  };

  const handleToggleArchive = async (id: number) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/archive/${id}`, { method: 'PUT' });
      if (response.ok) {
        const apiData = await response.json();
        setOrders(prev => prev.map(o => o.id === id ? { ...o, is_archived: apiData.is_archived } : o));
        setSubmittedData(null);
        setToastTitle(apiData.is_archived ? "Archived!" : "Restored!");
        setToastMessage(apiData.is_archived ? "Order moved to Archive" : "Order restored from Archive");
        setIsError(false); setShowToast(true); setOpenMenuId(null); fetchOrders();
      } else {
        const errorData = await response.json();
        setSubmittedData(null); setToastTitle("Failed"); setToastMessage(`Failed: ${errorData.error}`); setIsError(true); setShowToast(true);
      }
    } catch { setSubmittedData(null); setToastTitle("Network Error"); setToastMessage("Could not connect to the server."); setIsError(true); setShowToast(true); }
  };

  const handleOpenEdit = (order: Order) => {
    setSelectedOrderForEdit({ id: order.id, name: order.customer, contact: order.contact || '', address: order.address, status: order.status, paymentMethod: order.paymentMethod, items: order.items });
    setOpenMenuId(null); setShowEditModal(true);
  };

  const handleOpenView = (order: Order) => { setSelectedOrderForView(order); setShowViewModal(true); };
  const closeViewModal = () => { setShowViewModal(false); setSelectedOrderForView(null); };

  // ===== HANDLE PRINT — DELIVERY RECEIPT FORMAT =====
  const handlePrint = () => {
    if (!selectedOrderForView) return;
    const pw = window.open('', '_blank');
    if (!pw) {
      alert('Pop-up blocked. Please allow pop-ups for this site in your browser settings, then try again.');
      return;
    }

    const items = selectedOrderForView.items || [];
    const totalRows = Math.max(25, items.length);
    const rows = Array.from({ length: totalRows }, (_, i) => {
      const item = items[i];
      return item
        ? `<tr>
            <td>${i + 1}</td>
            <td>${item.order_quantity}</td>
            <td>PCS</td>
            <td class="part">${item.item_name || `Item #${item.inventory_id}`}</td>
           </tr>`
        : `<tr><td>${i + 1}</td><td></td><td></td><td></td></tr>`;
    }).join('');

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Delivery Receipt - No. ${String(selectedOrderForView.id).padStart(4, '0')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 24px 28px; }

    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .company h1 { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .company p  { font-size: 10px; line-height: 1.65; }

    .receipt-block { text-align: right; }
    .receipt-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
    .receipt-no    { font-size: 24px; font-weight: 900; color: #c0392b; letter-spacing: 2px; }
    .receipt-no span { font-size: 13px; font-weight: 700; color: #000; }

    .meta-row { display: flex; justify-content: flex-end; align-items: flex-end; gap: 4px; margin-top: 4px; font-size: 10px; }
    .meta-label { font-weight: 600; white-space: nowrap; }
    .meta-value { border-bottom: 1px solid #000; min-width: 120px; padding: 0 4px; font-size: 10px; }

    .deliver-section { font-size: 10px; margin-bottom: 6px; }
    .deliver-row   { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 4px; }
    .deliver-label { font-weight: 700; font-size: 11px; white-space: nowrap; }
    .deliver-line  { border-bottom: 1px solid #000; flex: 1; min-height: 14px; padding: 0 4px; font-size: 11px; }

    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    thead th { border: 1px solid #000; padding: 5px 6px; font-weight: 700; text-align: center; font-size: 11px; }
    thead th.art { font-size: 12px; letter-spacing: 1px; }
    tbody td { border: 1px solid #000; padding: 2px 6px; text-align: center; height: 19px; font-size: 10px; }
    tbody td.part { text-align: left; }

    .print-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12px; }
    .footer-left  { max-width: 46%; font-size: 9px; line-height: 1.65; color: #333; }
    .footer-right { font-size: 10px; text-align: right; }
    .received-text { margin-bottom: 30px; }
    .by-line { display: flex; align-items: flex-end; justify-content: flex-end; gap: 6px; margin-bottom: 4px; }
    .by-underline { border-bottom: 1px solid #000; width: 160px; height: 16px; }
    .sig-line { border-top: 1px solid #000; width: 180px; margin-left: auto; text-align: center; padding-top: 2px; font-size: 9px; }
    .not-valid { font-style: italic; font-weight: 700; font-size: 9px; text-decoration: underline; text-align: center; margin-top: 8px; }

    @media print { body { padding: 10px 14px; } @page { margin: 0.4in; size: letter; } }
  </style>
</head>
<body>
  <div class="top">
    <div class="company">
      <h1>AE Samonte Merchandise</h1>
      <p>ALAIN E. SAMONTE - Prop.</p>
      <p>VAT Reg. TIN : 263-884-036-00000</p>
      <p>1457 A. Leon Guinto St., Zone 73 Barangay 676,</p>
      <p>1000 Ermita NCR, City of Manila, First District, Philippines</p>
    </div>
    <div class="receipt-block">
      <div class="receipt-title">DELIVERY RECEIPT</div>
      <div class="receipt-no"><span>N<sup>o</sup></span> ${String(selectedOrderForView.id).padStart(4, '0')}</div>
      <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${selectedOrderForView.date}</span><span>, 20</span></div>
      <div class="meta-row"><span class="meta-label">P.O. No.:</span><span class="meta-value">&nbsp;</span></div>
      <div class="meta-row"><span class="meta-label">RFQ No.:</span><span class="meta-value">&nbsp;</span></div>
      <div class="meta-row"><span class="meta-label">TIN No.:</span><span class="meta-value">&nbsp;</span></div>
    </div>
  </div>

  <div class="deliver-section">
    <div class="deliver-row">
      <span class="deliver-label">DELIVERED TO:</span>
      <span class="deliver-line">${selectedOrderForView.customer}</span>
    </div>
    <div class="deliver-row">
      <span class="deliver-label">Address:</span>
      <span class="deliver-line">${selectedOrderForView.address}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:6%">ITEM</th>
        <th style="width:8%">QTY</th>
        <th style="width:10%">UNIT</th>
        <th class="art">ARTICLES / PARTICULARS</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="print-footer">
    <div class="footer-left">
      <div>20 Bkts. (50x3) 4251 - 5250</div>
      <div>BIR Authority to Print No.: OCN033AU20250000004322</div>
      <div>Date of ATP: OCTOBER 10, 2025</div>
      <div>REGENCIA PRINTING SERVICES | Ramil P. Egencia - Prop.</div>
      <div>Lot 3 to 7, Raq's Hope Ville, Navarro 4107 City of General</div>
      <div>Trias, Cavite, Philippines • VAT Reg. TIN: 245-821-996-00000</div>
      <div>Printer's Accreditation No.: 54BMP20250000000023</div>
      <div>Date of ATP: OCT. 09, 2025 • Expiry Date: OCT. 08, 2030</div>
    </div>
    <div class="footer-right">
      <div class="received-text">Received the above goods in good order and condition.</div>
      <div class="by-line"><span>By:</span><div class="by-underline"></div></div>
      <div class="sig-line">Authorized Signature</div>
      <div class="not-valid">"THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX"</div>
    </div>
  </div>
</body>
</html>`);

    pw.document.close();
    pw.focus();
    pw.print();
  };
  // ===== END HANDLE PRINT =====

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setCurrentPage(1); };

  const handleSort = (key: Exclude<SortKey, null>) => {
    if (key === 'status') { setStatusCycleIndex(prev => (prev + 1) % STATUS_ORDER.length); setSortConfig({ key: 'status', direction: 'asc' }); }
    else setSortConfig(prev => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter(o => {
      const matchesArchiveView = isArchiveView ? Boolean(o.is_archived) : !o.is_archived;
      return matchesArchiveView && (o.id.toString().includes(term) || o.customer.toLowerCase().includes(term) || o.date.toLowerCase().includes(term) || o.status.toLowerCase().includes(term));
    });
  }, [orders, searchTerm, isArchiveView]);

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
    if (!sortConfig.key) return arr.sort((a, b) => (STATUS_PRIORITY[a.status.toUpperCase()] || 0) - (STATUS_PRIORITY[b.status.toUpperCase()] || 0) || a.id - b.id);
    const { key, direction } = sortConfig;
    return arr.sort((a, b) => {
      const A = a[key as keyof Order], B = b[key as keyof Order];
      if (key === 'id') return direction === 'asc' ? (A as number) - (B as number) : (B as number) - (A as number);
      if (key === 'date') return direction === 'asc' ? new Date(A as string).getTime() - new Date(B as string).getTime() : new Date(B as string).getTime() - new Date(A as string).getTime();
      const sA = (A as string).toLowerCase(), sB = (B as string).toLowerCase();
      return direction === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA);
    });
  }, [filtered, sortConfig, statusCycleIndex]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE) || 1;
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const getStatusStyle = (status: string | undefined) => {
    const base = s.statusBadge;
    if (!status) return base;
    switch (status.toUpperCase()) {
      case 'PREPARING': return `${base} ${s.pillBlue}`;
      case 'TO SHIP':   return `${base} ${s.pillYellow}`;
      case 'RECEIVED':  return `${base} ${s.pillGreen}`;
      case 'CANCELLED': return `${base} ${s.pillRed}`;
      default: return base;
    }
  };

  const vatRate = 0.12;
  const vatableBase = selectedOrderForView ? selectedOrderForView.totalAmount / (1 + vatRate) : 0;
  const vatAmount   = selectedOrderForView ? selectedOrderForView.totalAmount - vatableBase : 0;

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {showToast && (
        <div className={s.toastOverlay}>
          {!isError && submittedData ? (
            <div className={s.alertBoxAdd}>
              <div className={s.alertHeaderAdd}><div className={s.checkCircleAdd}>✓</div></div>
              <div className={s.alertBodyAdd}>
                <h2 className={s.alertTitleAdd}>{toastTitle}</h2>
                <p className={s.alertMessageAdd}>{toastMessage}</p>
                <div className={s.alertDataTable}>
                  <div className={s.alertDataRow}><span>Customer:</span><strong>{submittedData.customer}</strong></div>
                  <div className={s.alertDataRow}><span>Total:</span><strong>₱{submittedData.total.toLocaleString()}</strong></div>
                  <div className={s.alertDataRow}><span>Method:</span><strong>{submittedData.method}</strong></div>
                  <div className={s.alertDataRow}><span>Time:</span><strong>{submittedData.dateTime}</strong></div>
                </div>
                <button className={s.okButtonAdd} onClick={() => { setShowToast(false); setSubmittedData(null); }}>OK</button>
              </div>
            </div>
          ) : (
            <div className={s.alertBox}>
              <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
                <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>{isError ? '!' : '✓'}</div>
              </div>
              <div className={s.alertBody}>
                <h2 className={s.alertTitle}>{toastTitle}</h2>
                <p className={s.alertMessage}>{toastMessage}</p>
                <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>OK</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={s.mainContent}>
        <div className={s.topGrid}>
          <section className={s.statCard}><p className={s.cardTitle}>Shipped Today</p><h2 className={s.bigNumber}>{summary ? `${summary.shippedToday.current}/${summary.shippedToday.total}` : '—'}</h2></section>
          <section className={s.statCard}><p className={s.cardTitle}>Orders Cancelled</p><h2 className={s.bigNumber}>{summary ? summary.cancelled.current : '—'}</h2></section>
          <section className={s.statCard}><p className={s.cardTitle}>Total Orders</p><h2 className={s.bigNumber}>{summary ? summary.totalOrders.count.toLocaleString() : '—'}</h2></section>
        </div>

        {isArchiveView ? (
          <ArchiveTable orders={orders} onRestore={handleToggleArchive} onBack={() => setIsArchiveView(false)} />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h2 className={s.title}>Orders</h2>
              <div className={s.controls}>
                <button className={s.archiveIconBtn} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }} onClick={() => setIsArchiveView(true)} title="View Archives">
                  <LuArchive size={20} />
                </button>
                <div className={s.searchWrapper}>
                  <input className={s.searchInput} placeholder="Search..." value={searchTerm} onChange={handleSearchChange} />
                  <LuSearch size={18} />
                </div>
                <button className={s.addButton} onClick={() => setShowAddModal(true)}>ADD</button>
              </div>
            </div>

            <table className={s.table}>
              <thead>
                <tr>
                  {[
                    { label: 'ID', key: 'id', sortable: true }, { label: 'CUSTOMER', key: 'customer', sortable: true },
                    { label: 'ADDRESS', key: 'address', sortable: true }, { label: 'QTY', key: 'totalQty', sortable: true },
                    { label: 'TOTAL', key: 'totalAmount', sortable: true }, { label: 'PAYMENT', key: 'paymentMethod', sortable: true },
                    { label: 'DATE', key: 'date', sortable: true }, { label: 'STATUS', key: 'status', sortable: true },
                    { label: 'ACTION', key: null, sortable: false },
                  ].map(col => (
                    <th key={col.label} onClick={() => col.sortable && col.key && handleSort(col.key as Exclude<SortKey, null>)} style={{ cursor: col.sortable ? 'pointer' : 'default' }}>
                      <div className={s.sortableHeader}>
                        <span>{col.label}</span>
                        {col.sortable && col.key && (
                          <div className={s.sortIconsStack}>
                            <LuChevronUp size={12} style={{ color: sortConfig.key === col.key && sortConfig.direction === 'asc' ? '#1a4263' : '#cbd5e1' }} />
                            <LuChevronDown size={12} style={{ color: sortConfig.key === col.key && sortConfig.direction === 'desc' ? '#1a4263' : '#cbd5e1' }} />
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((o, i) => (
                  <tr key={o.id} className={i % 2 ? s.altRow : ''} onClick={() => handleOpenView(o)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'center' }}>{o.id}</td>
                    <td style={{ textAlign: 'left', paddingLeft: '1rem' }}><strong>{o.customer}</strong></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</td>
                    <td style={{ textAlign: 'center' }}>{o.totalQty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₱{o.totalAmount?.toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>{o.paymentMethod}</td>
                    <td style={{ textAlign: 'center' }}>{o.date}</td>
                    <td style={{ textAlign: 'center' }}><span className={getStatusStyle(o.status)}>{o.status}</span></td>
                    <td className={s.actionCell} onClick={e => e.stopPropagation()}>
                      <LuEllipsisVertical className={s.moreIcon} onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)} />
                      {openMenuId === o.id && (
                        <div className={s.popupMenu}>
                          <button className={s.popBtnEdit} onClick={() => handleOpenEdit(o)}><LuPencil size={14} /> Edit</button>
                          <button className={s.popBtnArchive} onClick={() => handleToggleArchive(o.id)}><LuArchive size={14} /> Archive</button>
                          <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={s.footer}>
              <div className={s.showDataText}>Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}</div>
              <div className={s.pagination}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <div key={i + 1} className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</div>
                ))}
                <button className={s.nextBtn} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages}><LuChevronRight /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddOrderModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleSave} statuses={orderStatuses} paymentMethods={paymentMethods} inventoryItems={inventoryItems} />
      <OrderEditModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} orderData={selectedOrderForEdit} onSave={handleUpdateSave} statuses={orderStatuses} paymentMethods={paymentMethods} inventoryItems={inventoryItems} />

      {/* ===== VIEW / RECEIPT MODAL ===== */}
      {showViewModal && selectedOrderForView && (
        <div className={s.viewBackdrop} onClick={closeViewModal}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()}>

            <div className={s.viewModalHeader}>
              <div>
                <h2 className={s.viewCompanyName}>AE Samonte Trading</h2>
                <p className={s.viewOrderNumber}>No. {selectedOrderForView.id}</p>
              </div>
              <div className={s.viewHeaderRight}>
                <span className={getViewStatusClass(selectedOrderForView.status, s)}>{selectedOrderForView.status?.toUpperCase()}</span>
                <button className={s.viewCloseBtn} onClick={closeViewModal}><LuX size={20} /></button>
              </div>
            </div>
            <div className={s.viewDateRow}>DATE: {selectedOrderForView.date}</div>

            <div ref={printRef} className={s.viewPrintBody}>
              <div className={s.viewCustomerSection}>
                <p className={s.viewSectionTitle}>Customer Details</p>
                <div className={s.viewCustomerGrid}>
                  {[
                    { label: 'Contact Number', value: selectedOrderForView.contact || '—' },
                    { label: 'Address', value: selectedOrderForView.address },
                    { label: 'Payment Method', value: selectedOrderForView.paymentMethod },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className={s.viewInfoLabel}>{label}</p>
                      <p className={s.viewInfoValue}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <table className={s.viewItemsTable}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>QTY</th>
                    <th>Unit Cost</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrderForView.items && selectedOrderForView.items.length > 0 ? (
                    selectedOrderForView.items.map((item, idx) => {
                      const totalQty = selectedOrderForView.items?.reduce((acc, i) => acc + i.order_quantity, 0) || 1;
                      const unitCost = selectedOrderForView.totalAmount / totalQty;
                      const amount = unitCost * item.order_quantity;
                      return (
                        <tr key={idx}>
                          <td>
                            <p className={s.viewItemName}>{item.item_name || `Item #${item.inventory_id}`}</p>
                            <p className={s.viewItemStatus}>{item.item_status}</p>
                          </td>
                          <td>{item.order_quantity}</td>
                          <td>₱ {unitCost.toFixed(2)}</td>
                          <td>₱ {amount.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className={s.viewEmptyRow}><td colSpan={4}>No item details available</td></tr>
                  )}
                </tbody>
              </table>

              <div className={s.viewTotalsWrapper}>
                <div className={s.viewTotalsBox}>
                  <div className={s.viewTotalLine}><span>VATable Sales</span><span>₱ {vatableBase.toFixed(2)}</span></div>
                  <div className={s.viewTotalLine}><span>VAT Amount (12%)</span><span>₱ {vatAmount.toFixed(2)}</span></div>
                  <div className={s.viewTotalFinal}>
                    <span>Total</span>
                    <span>₱ {selectedOrderForView.totalAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={s.viewModalFooter}>
              <button className={s.viewBtnPrint} onClick={handlePrint}><LuPrinter size={14} /> Print Receipt</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}