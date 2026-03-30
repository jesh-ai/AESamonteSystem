/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import ExportModal from './exportModal';
import OrderEditModal from './editOrderModal';
import AddOrderModal from './addOrderModal';
import ArchiveTable from './archiveOrderModal';
import { 
  LuSearch, LuChevronUp, LuChevronDown, LuEllipsisVertical, 
  LuArchive, LuChevronRight, LuChevronLeft, LuPencil, LuX, LuPrinter
} from 'react-icons/lu';

const STATUS_PRIORITY: Record<string, number> = { 'PREPARING': 1, 'TO SHIP': 2, 'RECEIVED': 3, 'CANCELLED': 4 };
const ITEM_STATUS_MAP: Record<number, string> = { 1: 'AVAILABLE', 2: 'PARTIALLY_AVAILABLE', 3: 'OUT_OF_STOCK' };
const ROWS_PER_PAGE = 10;

type OrderItemBackend = {
  inventory_id: number; order_quantity: number; available_quantity: number;
  item_status_id: number; item_status?: string; item_name?: string; amount?: number; uom?: string;
};

export type Order = {
  id: number; customer: string; contact?: string; address: string;
  date: string; status: string; paymentMethod: string;
  totalQty: number; totalAmount: number; items?: OrderItemBackend[]; is_archived?: boolean;
};

type Summary = {
  shippedToday: { current: number; total: number};
  cancelled: { current: number};
  totalOrders: { count: number; growth: number };
};

type SortKey = 'id' | 'customer' | 'address' | 'totalQty' | 'totalAmount' | 'paymentMethod' | 'date' | 'status' | null;

const getViewStatusClass = (status: string, s: Record<string, string>) => {
  switch (status?.toUpperCase()) {
    case 'PREPARING': return s.viewStatusPreparing;
    case 'TO SHIP':   return s.viewStatusToShip;
    case 'RECEIVED':  return s.viewStatusReceived;
    case 'CANCELLED': return s.viewStatusCancelled;
    default:          return s.viewStatusDefault;
  }
};

export default function OrderPage({ role, onLogout, initialSearch }: { role: string; onLogout: () => void; initialSearch?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearch ?? '');

  useEffect(() => {
    if (initialSearch) setSearchTerm(initialSearch);
  }, [initialSearch]);

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  // ── DATE RANGE FILTER ──
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  // ── STATUS FILTER ──
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const s = styles;

  const ORDER_STATUS_OPTIONS = ['All Status', 'PREPARING', 'TO SHIP', 'RECEIVED', 'CANCELLED'];

  const getStatusBadgeColor = (status: string) => {
    if (status === 'PREPARING') return '#3b82f6';
    if (status === 'TO SHIP')   return '#f59e0b';
    if (status === 'RECEIVED')  return '#10b981';
    if (status === 'CANCELLED') return '#ef4444';
    return '#9ca3af';
  };

  const getDateRangeLabel = () => {
    if (!fromDate && !toDate) return 'Date Range';
    if (fromDate && toDate) return `${fromDate} to ${toDate}`;
    if (fromDate) return `From ${fromDate}`;
    if (toDate) return `Until ${toDate}`;
    return 'Date Range';
  };

  const handleClearDateFilter = () => { setFromDate(''); setToDate(''); setCurrentPage(1); };

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      const year = parseInt(parts[2]) + (parseInt(parts[2]) < 100 ? 2000 : 0);
      return new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
    }
    return null;
  };

  const isDateInRange = (txDate: string): boolean => {
    if (!fromDate && !toDate) return true;
    const tx = parseDate(txDate);
    if (!tx) return true;
    if (fromDate) { const from = parseDate(fromDate); if (from && tx < from) return false; }
    if (toDate)   { const to   = parseDate(toDate);   if (to   && tx > to)   return false; }
    return true;
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders/list');
      if (!res.ok) { console.error('Failed to fetch orders:', res.status); return; }
      const data: Order[] = await res.json();
      if (!Array.isArray(data)) { console.error('Unexpected orders response:', data); return; }
      setOrders(data.map(order => ({
        ...order,
        items: order.items?.map(item => ({
          ...item,
          item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
        }))
      })));
    } catch (err) { console.error('Error fetching orders:', err); }
  };

  const fetchSummary = async () => {
    try {
      const r = await fetch('/api/orders/summary');
      if (r.ok) { const d = await r.json(); if (d && d.shippedToday) setSummary(d); }
    } catch (err) { console.error('Error fetching summary:', err); }
  };

  useEffect(() => {
    fetchOrders();
    fetchSummary();
    const fetchDropdowns = async () => {
      try {
        const [sR, pR, iR] = await Promise.all([
          fetch("/api/orders/status?scope=ORDER_STATUS"),
          fetch("/api/orders/status?scope=PAYMENT_METHOD"),
          fetch("/api/inventory")
        ]);
        if (sR.ok) setOrderStatuses(await sR.json());
        if (pR.ok) setPaymentMethods(await pR.json());
        if (iR.ok) setInventoryItems(await iR.json());
      } catch (err) { console.error("Dropdown fetch error", err); }
    };
    fetchDropdowns();
    const summaryInterval = setInterval(() => { fetchSummary(); }, 10000);
    return () => clearInterval(summaryInterval);
  }, []);

  // ── CLOSE DROPDOWNS ON OUTSIDE CLICK ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-filter="date"]'))   setIsDateFilterOpen(false);
      if (!target.closest('[data-filter="status"]')) setIsStatusDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async (newOrderData: any) => {
    try {
      const response = await fetch(`/api/orders/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newOrderData),
      });
      if (response.ok) {
        setSubmittedData({
          customer: newOrderData.customerName,
          total: newOrderData.items?.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) || 0,
          method: newOrderData.items?.[0]?.paymentMethod || newOrderData.payment_method || newOrderData.paymentMethod || '—',
          dateTime: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        setToastTitle("Order Submitted!"); setToastMessage("Your new order has been successfully added.");
        setIsError(false); setShowToast(true); setShowAddModal(false);
        fetchOrders(); fetchSummary();
      } else {
        const errData = await response.json();
        setToastTitle("Oops!"); setToastMessage(errData.error || "Failed to save order.");
        setIsError(true); setShowToast(true);
      }
    } catch { setToastTitle("Network Error"); setToastMessage("Could not connect to the server."); setIsError(true); setShowToast(true); }
  };

  const handleUpdateSave = async (updatedOrder: any) => {
    try {
      const response = await fetch(`/api/orders/update/${updatedOrder.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedOrder),
      });
      if (response.ok) {
        setToastTitle("Updated!"); setToastMessage("The order record has been successfully updated.");
        setIsError(false); setSubmittedData(null); setShowToast(true); setShowEditModal(false);
        fetchOrders(); fetchSummary();
      } else {
        setToastTitle("Update Failed"); setToastMessage("Failed to update order.");
        setIsError(true); setShowToast(true);
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleArchive = async (id: number) => {
    try {
      const response = await fetch(`/api/orders/archive/${id}`, { method: 'PUT' });
      if (response.ok) {
        const apiData = await response.json();
        setOrders(prev => prev.map(o => o.id === id ? { ...o, is_archived: apiData.is_archived } : o));
        setSubmittedData(null);
        setToastTitle(apiData.is_archived ? "Archived!" : "Restored!");
        setToastMessage(apiData.is_archived ? "Order moved to Archive" : "Order restored from Archive");
        setIsError(false); setShowToast(true); setOpenMenuId(null);
        fetchOrders(); fetchSummary();
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

  const handlePrint = () => {
    if (!selectedOrderForView) return;
    const pw = window.open('', '_blank');
    if (!pw) { alert('Pop-up blocked. Please allow pop-ups for this site in your browser settings, then try again.'); return; }
    const items = selectedOrderForView.items || [];
    const totalRows = Math.max(25, items.length);
    const rows = Array.from({ length: totalRows }, (_, i) => {
      const item = items[i];
      return item
        ? `<tr><td>${i + 1}</td><td>${item.order_quantity}</td><td>PCS</td><td class="part">${item.item_name || `Item #${item.inventory_id}`}</td></tr>`
        : `<tr><td>${i + 1}</td><td></td><td></td><td></td></tr>`;
    }).join('');

    pw.document.write(`<!DOCTYPE html>
<html><head>
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
      <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${selectedOrderForView.date}</span></div>
      <div class="meta-row"><span class="meta-label">P.O. No.:</span><span class="meta-value">&nbsp;</span></div>
      <div class="meta-row"><span class="meta-label">RFQ No.:</span><span class="meta-value">&nbsp;</span></div>
      <div class="meta-row"><span class="meta-label">TIN No.:</span><span class="meta-value">&nbsp;</span></div>
    </div>
  </div>
  <div class="deliver-section">
    <div class="deliver-row"><span class="deliver-label">DELIVERED TO:</span><span class="deliver-line">${selectedOrderForView.customer}</span></div>
    <div class="deliver-row"><span class="deliver-label">Address:</span><span class="deliver-line">${selectedOrderForView.address}</span></div>
  </div>
  <table>
    <thead><tr><th style="width:6%">ITEM</th><th style="width:8%">QTY</th><th style="width:10%">UNIT</th><th class="art">ARTICLES / PARTICULARS</th></tr></thead>
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
</body></html>`);
    pw.document.close(); pw.focus(); pw.print();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setCurrentPage(1); };

  const handleSort = (key: Exclude<SortKey, null>) => {
    setSortConfig(prev => prev.key === key 
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } 
      : { key, direction: 'asc' });
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter(o => {
      const matchesArchiveView = isArchiveView ? Boolean(o.is_archived) : !o.is_archived;
      const matchesStatus = statusFilter === 'All Status' || o.status?.toUpperCase() === statusFilter;
      const matchesDate = isDateInRange(o.date);
      return matchesArchiveView && matchesStatus && matchesDate && (
        o.id.toString().toLowerCase().includes(term) ||
        o.customer.toLowerCase().includes(term) ||
        (o.address ?? '').toLowerCase().includes(term) ||
        (o.contact ?? '').toLowerCase().includes(term) ||
        (o.paymentMethod ?? '').toLowerCase().includes(term) ||
        o.date.toLowerCase().includes(term) ||
        o.status.toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, isArchiveView, statusFilter, fromDate, toDate]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const getSafeId = (id: any) => Number(String(id).replace(/\D/g, '')) || 0;
    if (!sortConfig.key || !sortConfig.direction) {
      return arr.sort((a, b) => {
        const dateA = parseDate(a.date)?.getTime() ?? 0;
        const dateB = parseDate(b.date)?.getTime() ?? 0;
        if (dateB !== dateA) return dateB - dateA; // newest first
        return getSafeId(b.id) - getSafeId(a.id);  // then by ID descending
      });
    }
    const { key, direction } = sortConfig;
    return arr.sort((a, b) => {
      const A = a[key as keyof Order]; const B = b[key as keyof Order];
      if (key === 'date') return direction === 'asc' ? new Date(A as string).getTime() - new Date(B as string).getTime() : new Date(B as string).getTime() - new Date(A as string).getTime();
      if (key === 'id') { const numA = getSafeId(A); const numB = getSafeId(B); return direction === 'asc' ? numA - numB : numB - numA; }
      if (key === 'totalQty' || key === 'totalAmount') { const numA = Number(A) || 0; const numB = Number(B) || 0; return direction === 'asc' ? numA - numB : numB - numA; }
      if (key === 'status') {
        const valA = STATUS_PRIORITY[String(A ?? '').toUpperCase()] || 999;
        const valB = STATUS_PRIORITY[String(B ?? '').toUpperCase()] || 999;
        if (valA !== valB) return direction === 'asc' ? valA - valB : valB - valA;
        return direction === 'asc' ? getSafeId(a.id) - getSafeId(b.id) : getSafeId(b.id) - getSafeId(a.id);
      }
      const sA = String(A ?? '').toLowerCase(); const sB = String(B ?? '').toLowerCase();
      if (sA < sB) return direction === 'asc' ? -1 : 1;
      if (sA > sB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE) || 1;
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const getStatusStyle = (status: string | undefined): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 'fit-content', whiteSpace: 'nowrap',
      padding: '2px 10px', borderRadius: '999px',
      fontSize: '0.78rem', fontWeight: 600,
    };
    switch (status?.toUpperCase()) {
      case 'PREPARING': return { ...base, color: '#2563eb', border: '1.5px solid #93c5fd', backgroundColor: '#eff6ff' };
      case 'TO SHIP':   return { ...base, color: '#b45309', border: '1.5px solid #fcd34d', backgroundColor: '#fffbeb' };
      case 'RECEIVED':  return { ...base, color: '#15803d', border: '1.5px solid #86efac', backgroundColor: '#f0fdf4' };
      case 'CANCELLED': return { ...base, color: '#dc2626', border: '1.5px solid #fca5a5', backgroundColor: '#fef2f2' };
      default:          return { ...base, color: '#6b7280', border: '1.5px solid #e5e7eb', backgroundColor: '#f9fafb' };
    }
  };

  const vatRate = 0.12;
  const vatableBase = selectedOrderForView ? selectedOrderForView.totalAmount / (1 + vatRate) : 0;
  const vatAmount   = selectedOrderForView ? selectedOrderForView.totalAmount - vatableBase : 0;

  const renderPageNumbers = () => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(<button key={i} className={currentPage === i ? s.pageCircleActive : s.pageCircle} onClick={() => setCurrentPage(i)}>{i}</button>);
    }
    return pages;
  };

  const renderGrowthPill = (value: number) => {
    let icon = '—'; let textColor = '#ca8a04'; let bgColor = '#fef08a';
    if (value > 0) { icon = '↗'; textColor = '#15803d'; bgColor = '#dcfce7'; }
    else if (value < 0) { icon = '↘'; textColor = '#b91c1c'; bgColor = '#fee2e2'; }
    return (
      <span style={{ color: textColor, backgroundColor: bgColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '0.85rem' }}>
        {icon} {Math.abs(value)}%
      </span>
    );
  };

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
                  <div className={s.alertDataRow}><span>Date:</span><strong>{submittedData.dateTime.split(' ')[0]}</strong></div>
                  <div className={s.alertDataRow}><span>Time:</span><strong>{submittedData.dateTime.split(' ').slice(1).join(' ')}</strong></div>
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

        {/* ── HEADER ROW ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', margin: 0 }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>ORDERS</h1>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>Track, manage, and process customer orders.</p>
          </div>
          <div>
            {['Admin', 'Manager'].includes(role) && (
              <ExportButton onSelect={(type) => { setExportType(type); setShowExportModal(true); }} />
            )}
          </div>
        </div>

        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Shipped Today</p>
            <h2 className={s.bigNumberGreen}>
              <svg width="36" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
                <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v4h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              <span style={{ color: "#16a34a" }}>{summary ? summary.shippedToday.current : '—'}</span>
              {summary && <span style={{ color: "#164163" }}>/{summary.shippedToday.total}</span>}
            </h2>
          </section>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Orders Cancelled</p>
            <h2 className={s.bigNumberRed}>{summary ? summary.cancelled.current : '—'}</h2>
          </section>
          <section className={s.statCardSpaced}>
            <p className={s.cardTitle}>Total Orders</p>
            <h2 className={s.bigNumberGold}>{summary ? summary.totalOrders.count.toLocaleString() : '—'}</h2>
            <div className={s.cardFooter}>
              <span className={s.cardSubtext}>vs last month</span>
              {summary && summary.totalOrders.growth != null && renderGrowthPill(summary.totalOrders.growth)}
            </div>
          </section>
        </div>
        
        {isArchiveView ? (
          <ArchiveTable orders={orders} onRestore={handleToggleArchive} onBack={() => setIsArchiveView(false)} />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h2 className={s.title}>Orders</h2>
              <div className={s.controls}>

                {/* ── DATE RANGE FILTER ── */}
                <div className={s.dateFilterContainer} data-filter="date">
                  <button
                    className={`${s.dateFilterTrigger} ${isDateFilterOpen ? s.dateFilterTriggerOpen : ''} ${(fromDate || toDate) ? s.dateFilterTriggerActive : ''}`}
                    onClick={() => setIsDateFilterOpen(prev => !prev)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span className={s.dateFilterLabel}>{getDateRangeLabel()}</span>
                    <svg className={`${s.dateFilterChevron} ${isDateFilterOpen ? s.dateFilterChevronOpen : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {isDateFilterOpen && (
                    <div className={s.dateFilterMenu}>
                      <div className={s.dateFilterInputGroup}>
                        <label htmlFor="orderFromDate" className={s.dateFilterLabel}>From</label>
                        <input id="orderFromDate" type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }} className={s.dateFilterInput} />
                      </div>
                      <div className={s.dateFilterInputGroup}>
                        <label htmlFor="orderToDate" className={s.dateFilterLabel}>To</label>
                        <input id="orderToDate" type="date" value={toDate} onChange={e => { setToDate(e.target.value); setCurrentPage(1); }} className={s.dateFilterInput} />
                      </div>
                      {(fromDate || toDate) && (
                        <button className={s.dateFilterClear} onClick={handleClearDateFilter}>Clear Dates</button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── STATUS FILTER ── */}
                <div className={s.statusFilterContainer} data-filter="status">
                  <button
                    className={`${s.statusFilterTrigger} ${isStatusDropdownOpen ? s.statusFilterTriggerOpen : ''}`}
                    onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                  >
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusBadgeColor(statusFilter), flexShrink: 0 }}></span>
                    <span className={s.statusFilterLabel}>{statusFilter}</span>
                    <svg className={`${s.statusFilterChevron} ${isStatusDropdownOpen ? s.statusFilterChevronOpen : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {isStatusDropdownOpen && (
                    <div className={s.statusFilterMenu}>
                      {ORDER_STATUS_OPTIONS.map(option => (
                        <button
                          key={option}
                          className={`${s.statusFilterMenuItem} ${statusFilter === option ? s.statusFilterMenuItemActive : ''}`}
                          onClick={() => { setStatusFilter(option); setIsStatusDropdownOpen(false); setCurrentPage(1); }}
                        >
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusBadgeColor(option), flexShrink: 0 }}></span>
                          <span>{option}</span>
                          {statusFilter === option && <svg className={s.statusFilterCheckmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives"><LuArchive size={20} /></button>

                {/* ── SEARCH (updated to match Sales style) ── */}
                <div className={s.searchWrapper}>
                  <LuSearch size={18} className={s.searchIcon} />
                  <input className={s.searchInput} placeholder="Search No, Name, Address, Payment" value={searchTerm} onChange={handleSearchChange} />
                </div>

                <button className={s.addButton} onClick={() => setShowAddModal(true)}>ADD</button>
              </div>
            </div>

            <div className={s.tableResponsive}>
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
                              <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                              <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
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
                      <td>{o.id}</td>
                      <td><strong>{o.customer}</strong></td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.address}</td>
                      <td>{o.totalQty}</td>
                      <td style={{ fontWeight: 'bold' }}>₱{o.totalAmount?.toLocaleString()}</td>
                      <td>{o.paymentMethod}</td>
                      <td>{o.date}</td>
                      <td><span style={getStatusStyle(o.status)}>{o.status}</span></td>
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
            </div>

            <div className={s.footer}>
              <div className={s.showDataText}>Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}</div>
              <div className={s.pagination}>
                <button className={s.nextBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}><LuChevronLeft /></button>
                {renderPageNumbers()}
                <button className={s.nextBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(prev => prev + 1)}><LuChevronRight /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ExportModal isOpen={showExportModal} onClose={() => { setShowExportModal(false); setExportType(null); }} 
                    onSuccess={(msg, type) => { setToastTitle(type === 'error' ? 'Oops!' : 'Success!'); setToastMessage(msg); setIsError(type === 'error'); setShowToast(true); }} 
                    data={orders.filter(o => !o.is_archived)} 
                    summary={summary ?? { shippedToday: { current: 0, total: 0 }, cancelled: { current: 0 }, totalOrders: { count: 0 } }}
                    exportType={exportType} />

      <AddOrderModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} 
                      onSave={handleSave} statuses={orderStatuses} 
                      paymentMethods={paymentMethods} inventoryItems={inventoryItems} />

      <OrderEditModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} 
                      orderData={selectedOrderForEdit} onSave={handleUpdateSave} 
                      statuses={orderStatuses} paymentMethods={paymentMethods} inventoryItems={inventoryItems} />

      {showViewModal && selectedOrderForView && (
        <div className={s.viewBackdrop} onClick={closeViewModal}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()}>
            <div className={s.viewModalHeader}>
              <div>
                <h2 className={s.viewCompanyName}>AE Samonte Merchandise</h2>
                <p className={s.viewOrderNumber}>No. OR{new Date().getFullYear()}-{String(selectedOrderForView.id).padStart(6, '0')}</p>
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
                    { label: 'Customer Name', value: selectedOrderForView.customer },
                    { label: 'Contact Number', value: selectedOrderForView.contact || '—' },
                    { label: 'Address', value: selectedOrderForView.address },
                    { label: 'Payment Method', value: selectedOrderForView.paymentMethod },
                  ].map(({ label, value }) => (
                    <div key={label}><p className={s.viewInfoLabel}>{label}</p><p className={s.viewInfoValue}>{value}</p></div>
                  ))}
                </div>
              </div>

              <table className={s.viewItemsTable}>
                <thead><tr><th>Item Description</th><th>Qty</th><th>Unit Cost</th><th>Amount</th></tr></thead>
                <tbody>
                  {selectedOrderForView.items && selectedOrderForView.items.length > 0 ? (
                    selectedOrderForView.items.map((item, idx) => {
                      const itemAmount = item.amount ?? 0;
                      const unitCost = item.order_quantity > 0 ? itemAmount / item.order_quantity : 0;
                      return (
                        <tr key={idx}>
                          <td><p className={s.viewItemName}>{item.item_name || `Item #${item.inventory_id}`}</p>{item.uom && <p className={s.viewItemStatus}>{item.uom}</p>}</td>
                          <td>{item.order_quantity}</td>
                          <td>₱ {unitCost.toFixed(2)}</td>
                          <td>₱ {itemAmount.toFixed(2)}</td>
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
                  <div className={s.viewTotalFinal}><span>Total</span><span>₱ {selectedOrderForView.totalAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
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