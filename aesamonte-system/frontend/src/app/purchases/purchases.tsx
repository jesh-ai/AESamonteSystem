/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import TopHeader from '@/components/layout/TopHeader';
import PageHeader from '@/components/layout/PageHeader';
import AddPOModal from './addPOModal';
import s from '@/css/purchase.module.css';
import {
  Search, CalendarDays, ChevronUp, ChevronDown,
  Archive, ArrowLeft, ChevronLeft, ChevronRight, MoreVertical,
  Edit, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type PurchaseOrder = {
  purchase_order_id: number;
  po_number:         string;
  supplier_name:     string;
  status:            string;
  order_date:        string | null;
  expected_delivery: string | null;
  notes:             string | null;
  total_items:       number;
  total_cost:        number;
};

type SortKey = keyof PurchaseOrder;
type SortDir = 'asc' | 'desc' | null;

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_ORDERS: PurchaseOrder[] = [
  {
    purchase_order_id: 1,
    po_number:        'PO-2026-001',
    supplier_name:    'XYZ Distributors',
    status:           'DRAFT',
    order_date:       '2026-04-28',
    expected_delivery:'2026-05-01',
    notes:            null,
    total_items:      150,
    total_cost:       12500,
  },
  {
    purchase_order_id: 2,
    po_number:        'PO-2026-002',
    supplier_name:    'Metro Supply Inc.',
    status:           'SENT',
    order_date:       '2026-04-20',
    expected_delivery:'2026-04-30',
    notes:            'Urgent restock',
    total_items:      80,
    total_cost:       54300,
  },
  {
    purchase_order_id: 3,
    po_number:        'PO-2026-003',
    supplier_name:    'Avelino Trading Co.',
    status:           'COMPLETED',
    order_date:       '2026-04-10',
    expected_delivery:'2026-04-18',
    notes:            null,
    total_items:      200,
    total_cost:       98750,
  },
  {
    purchase_order_id: 4,
    po_number:        'PO-2026-004',
    supplier_name:    'Samonte Goods Distribution',
    status:           'RECEIVED',
    order_date:       '2026-04-05',
    expected_delivery:'2026-04-15',
    notes:            null,
    total_items:      60,
    total_cost:       31200,
  },
  {
    purchase_order_id: 5,
    po_number:        'PO-2026-005',
    supplier_name:    'Luntian Fresh Farms',
    status:           'CANCELLED',
    order_date:       '2026-03-28',
    expected_delivery:'2026-04-08',
    notes:            'Supplier unavailable',
    total_items:      30,
    total_cost:       8900,
  },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 10;

const ALL_STATUSES = ['All Status', 'DRAFT', 'SENT', 'APPROVED', 'RECEIVED', 'COMPLETED', 'CANCELLED'];

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0, SENT: 1, APPROVED: 2, RECEIVED: 3, COMPLETED: 4, CANCELLED: 5, ARCHIVED: 6,
};

const STATUS_STYLE: Record<string, { badge: string }> = {
  DRAFT:     { badge: 'border border-gray-300   bg-gray-50   text-gray-600'   },
  SENT:      { badge: 'border border-blue-300   bg-blue-50   text-blue-700'   },
  APPROVED:  { badge: 'border border-indigo-300 bg-indigo-50 text-indigo-700' },
  RECEIVED:  { badge: 'border border-amber-300  bg-amber-50  text-amber-700'  },
  COMPLETED: { badge: 'border border-green-300  bg-green-50  text-green-700'  },
  CANCELLED: { badge: 'border border-red-300    bg-red-50    text-red-600'    },
  ARCHIVED:  { badge: 'border border-slate-300  bg-slate-50  text-slate-500'  },
};

const STATUS_DOT: Record<string, string> = {
  DRAFT:     '#9ca3af',
  SENT:      '#3b82f6',
  APPROVED:  '#6366f1',
  RECEIVED:  '#f59e0b',
  COMPLETED: '#22c55e',
  CANCELLED: '#f87171',
  ARCHIVED:  '#94a3b8',
};

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'po_number',         label: 'PO NUMBER'          },
  { key: 'supplier_name',     label: 'SUPPLIER'           },
  { key: 'total_items',       label: 'QTY',   numeric: true },
  { key: 'total_cost',        label: 'TOTAL', numeric: true },
  { key: 'expected_delivery', label: 'EXPECTED DELIVERY'  },
  { key: 'order_date',        label: 'DATE CREATED'       },
  { key: 'status',            label: 'STATUS'             },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const yy = String(dt.getUTCFullYear()).slice(2);
  return `${mm}/${dd}/${yy}`;
}

function fmtPHP(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function StatusBadge({ status }: { status: string }) {
  const { badge } = STATUS_STYLE[status?.toUpperCase()] ?? { badge: 'border border-gray-200 bg-gray-50 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${badge}`}>
      {status}
    </span>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className={s.skeletonCell}>
          <div className={s.skeletonBar} />
        </td>
      ))}
    </tr>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PurchasesPage({
  role,
  onLogout,
}: {
  role: string;
  onLogout: () => void;
  permissions?: any;
}) {
  const [orders, setOrders]             = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [sortKey, setSortKey]           = useState<SortKey | null>(null);
  const [sortDir, setSortDir]           = useState<SortDir>(null);
  const [openMenuId, setOpenMenuId]     = useState<number | null>(null);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [isArchiveView, setIsArchiveView] = useState(false);
  const [selectedPO, setSelectedPO]       = useState<PurchaseOrder | null>(null);
  const [poItems, setPoItems]             = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [statusFilter, setStatusFilter]   = useState('All Status');
  const [statusOpen, setStatusOpen]       = useState(false);

  const menuRef   = useRef<HTMLTableCellElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    if (!selectedPO) { setPoItems([]); return; }
    setIsLoadingItems(true);
    fetch(`/api/purchases/${selectedPO.purchase_order_id}/items`)
      .then(r => r.json())
      .then(data => setPoItems(Array.isArray(data) ? data : []))
      .catch(() => setPoItems([]))
      .finally(() => setIsLoadingItems(false));
  }, [selectedPO]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current   && !menuRef.current.contains(e.target as Node))   setOpenMenuId(null);
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchOrders() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/purchases');
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) && data.length > 0 ? data : MOCK_ORDERS);
      } else {
        setOrders(MOCK_ORDERS);
      }
    } catch {
      setOrders(MOCK_ORDERS);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Sort ───────────────────────────────────────────────────────────────────

  function handleSort(key: SortKey) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir(null); }
    setCurrentPage(1);
  }

  function SortIcons({ col }: { col: SortKey }) {
    if (sortKey !== col || !sortDir) return <ChevronUp size={14} color="#d1d5db" />;
    return sortDir === 'asc'
      ? <ChevronUp   size={14} color="#1a4263" />
      : <ChevronDown size={14} color="#1a4263" />;
  }

  // ── Archive ────────────────────────────────────────────────────────────────

  async function handleArchive(poId: number) {
    try {
      const res = await fetch(`/api/purchases/${poId}/archive`, { method: 'PATCH' });
      if (res.ok) {
        setOrders(prev => prev.map(o =>
          o.purchase_order_id === poId ? { ...o, status: 'ARCHIVED' } : o
        ));
        setOpenMenuId(null);
      }
    } catch {
      // silently fail — user can refresh
    }
  }

  // ── Filter + Sort ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let list = orders.filter(o => {
      const isArchived = o.status.toUpperCase() === 'ARCHIVED';
      if (!isArchiveView &&  isArchived) return false;
      if ( isArchiveView && !isArchived) return false;
      const matchSearch =
        o.po_number.toLowerCase().includes(term)     ||
        o.supplier_name.toLowerCase().includes(term) ||
        o.status.toLowerCase().includes(term);
      const matchStatus =
        statusFilter === 'All Status' ||
        o.status.toUpperCase() === statusFilter;
      return matchSearch && matchStatus;
    });
    list = [...list].sort((a, b) => {
      if (sortKey && sortDir) {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        if (av < bv) return sortDir === 'asc' ? -1 :  1;
        if (av > bv) return sortDir === 'asc' ?  1 : -1;
        return 0;
      }
      const ao = STATUS_ORDER[a.status?.toUpperCase()] ?? 99;
      const bo = STATUS_ORDER[b.status?.toUpperCase()] ?? 99;
      return ao - bo;
    });
    return list;
  }, [orders, searchTerm, isArchiveView, statusFilter, sortKey, sortDir]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function goToPage(p: number) {
    setCurrentPage(Math.min(Math.max(1, p), totalPages));
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | '…')[]>((acc, p, i, arr) => {
      if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1)
        acc.push('…');
      acc.push(p);
      return acc;
    }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={s.pageWrapper}>
      <TopHeader role={role} onLogout={onLogout} />

      <AddPOModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => { setShowAddModal(false); fetchOrders(); }}
      />

      <main className={s.main}>
        <PageHeader
          title="PURCHASE ORDERS"
          subtitle="Draft, track, and receive inventory deliveries."
        />

        {/* ── Card ── */}
        <div className={s.tableContainer}>

          {/* ── Card Header ── */}
          <div className={s.cardHeader}>
            {isArchiveView ? (
              <h2 className="text-2xl font-bold text-[#64748b]">Archived Purchase Orders</h2>
            ) : (
              <h2 className={s.cardTitle}>Purchase Orders</h2>
            )}

            <div className={s.controls}>
              {isArchiveView ? (
                /* ── Archived view controls ── */
                <>
                  <button
                    onClick={() => { setIsArchiveView(false); setSearchTerm(''); setStatusFilter('All Status'); setCurrentPage(1); }}
                    className="bg-[#475569] hover:bg-[#8aa7cf] text-white px-5 py-2.5 rounded-md flex items-center gap-2 font-medium transition-colors cursor-pointer shadow-sm"
                    style={{ border: 'none' }}
                  >
                    <ArrowLeft size={16} />
                    Back to Active
                  </button>

                  <div className={s.searchWrapper}>
                    <Search size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
                    <input
                      className={s.searchInput}
                      type="text"
                      placeholder="Search archives..."
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                  </div>
                </>
              ) : (
                /* ── Active view controls ── */
                <>
                  {/* Date Range */}
                  <button className={s.filterBtn}>
                    <CalendarDays size={15} color="#64748b" />
                    <span>Date Range</span>
                    <ChevronDown size={14} color="#64748b" />
                  </button>

                  {/* All Status */}
                  <div className={s.filterDropdownWrap} ref={statusRef}>
                    <button
                      className={`${s.filterBtn} ${statusOpen ? s.filterBtnActive : ''}`}
                      onClick={() => setStatusOpen(prev => !prev)}
                    >
                      <span
                        className={s.statusDot}
                        style={{ background: STATUS_DOT[statusFilter] ?? '#94a3b8' }}
                      />
                      <span>{statusFilter}</span>
                      <ChevronDown
                        size={14}
                        color="#64748b"
                        style={{ transition: 'transform 0.2s', transform: statusOpen ? 'rotate(180deg)' : 'none' }}
                      />
                    </button>
                    {statusOpen && (
                      <div className={s.filterDropdown}>
                        {ALL_STATUSES.map(st => (
                          <button
                            key={st}
                            className={`${s.filterDropdownItem} ${statusFilter === st ? s.filterDropdownItemActive : ''}`}
                            onClick={() => { setStatusFilter(st); setStatusOpen(false); setCurrentPage(1); }}
                          >
                            {st !== 'All Status' && (
                              <span
                                className={s.statusDot}
                                style={{ background: STATUS_DOT[st] ?? '#94a3b8' }}
                              />
                            )}
                            {st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Archive toggle */}
                  <button
                    title="View Archives"
                    onClick={() => { setIsArchiveView(true); setSearchTerm(''); setCurrentPage(1); }}
                    className="bg-white border border-[#ddd] text-slate-500 hover:bg-[#3e73b1] hover:text-white hover:border-[#3e73b1] p-[8px] rounded-lg flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Archive size={20} />
                  </button>

                  {/* Search */}
                  <div className={s.searchWrapper}>
                    <Search size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
                    <input
                      className={s.searchInput}
                      type="text"
                      placeholder="Search…"
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                  </div>

                  {/* ADD */}
                  <button className={s.addButton} onClick={() => setShowAddModal(true)}>
                    ADD
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Table ── */}
          <div className={s.tableResponsive}>
            <table className={s.table}>
              <thead>
                <tr>
                  {COLUMNS.map(({ key, label, numeric }) => (
                    <th
                      key={key}
                      className={numeric ? s.thSortable : s.thDefault}
                      onClick={numeric ? () => handleSort(key) : undefined}
                    >
                      <div className={s.sortHeaderInner}>
                        {label}
                        {numeric && <SortIcons col={key} />}
                      </div>
                    </th>
                  ))}
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} cols={COLUMNS.length + 1} />
                  ))
                ) : paginated.length === 0 ? (
                  <tr className={s.emptyRow}>
                    <td colSpan={COLUMNS.length + 1}>
                      {isArchiveView ? 'No archived purchase orders found.' : 'No purchase orders found.'}
                    </td>
                  </tr>
                ) : paginated.map((po, idx) => (
                  <tr
                    key={po.purchase_order_id}
                    className={`${idx % 2 !== 0 ? s.altRow : ''} cursor-pointer transition-colors hover:bg-slate-50`}
                    onClick={() => setSelectedPO(po)}
                  >
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{po.po_number}</td>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{po.supplier_name}</td>
                    <td style={{ color: '#475569' }}>{po.total_items}</td>
                    <td style={{ fontWeight: 700, color: '#1e293b' }}>{fmtPHP(po.total_cost)}</td>
                    <td style={{ color: '#475569' }}>{fmtDate(po.expected_delivery)}</td>
                    <td style={{ color: '#475569' }}>{fmtDate(po.order_date)}</td>
                    <td><StatusBadge status={po.status} /></td>
                    <td
                      className={s.actionCell}
                      ref={openMenuId === po.purchase_order_id ? menuRef : null}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        className={s.moreIcon}
                        onClick={() => setOpenMenuId(prev =>
                          prev === po.purchase_order_id ? null : po.purchase_order_id
                        )}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openMenuId === po.purchase_order_id && (
                        <div className={s.popupMenu}>
                          <button className={s.popBtnEdit} onClick={() => setOpenMenuId(null)}>
                            <Edit size={13} />
                            Edit
                          </button>
                          <button className={s.popBtnArchive} onClick={() => handleArchive(po.purchase_order_id)}>
                            <Archive size={13} />
                            Archive
                          </button>
                          <button className={s.popBtnClose} onClick={() => setOpenMenuId(null)}>
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className={s.footer}>
            <span className={s.showDataText}>
              Showing{' '}
              <span className={s.countBadge}>
                {Math.min(currentPage * ROWS_PER_PAGE, filtered.length)}
              </span>
              {' '}of {filtered.length}
            </span>

            <div className={s.pagination}>
              <button
                className={s.nextBtn}
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={14} />
              </button>

              {pageNumbers.map((p, i) =>
                p === '…' ? (
                  <span key={`e-${i}`} className={s.ellipsis}>…</span>
                ) : (
                  <button
                    key={p}
                    className={currentPage === p ? s.pageCircleActive : s.pageCircle}
                    onClick={() => goToPage(p as number)}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                className={s.nextBtn}
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* ── Quick View Modal ── */}
      {selectedPO && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPO(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '2px' }}>
                  Purchase Order Details
                </p>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                  {selectedPO.po_number}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <StatusBadge status={selectedPO.status} />
                <button
                  onClick={() => setSelectedPO(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex', borderRadius: '6px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-6" style={{ flex: 1 }}>

              {/* Supplier / Dates info box */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '4px' }}>Supplier</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{selectedPO.supplier_name}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '4px' }}>Date Created</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{fmtDate(selectedPO.order_date)}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '4px' }}>Expected Delivery</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{fmtDate(selectedPO.expected_delivery)}</p>
                  </div>
                </div>
                {selectedPO.notes && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '4px' }}>Notes</p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>{selectedPO.notes}</p>
                  </div>
                )}
              </div>

              {/* Items table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Item Description', 'Qty', 'Unit Price', 'Subtotal'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Item Description' ? 'left' : 'center', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingItems ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        {[...Array(4)].map((_, j) => (
                          <td key={j} style={{ padding: '10px 12px' }}>
                            <div style={{ height: '13px', background: '#e2e8f0', borderRadius: '4px', width: j === 0 ? '70%' : '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : poItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic' }}>
                        No items found.
                      </td>
                    </tr>
                  ) : poItems.map((item, i) => {
                    const subtotal = item.quantity_ordered * item.unit_cost;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 !== 0 ? '#f8fafc' : '#fff' }}>
                        <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: 500 }}>
                          {item.item_name}
                          {item.brand_name && item.brand_name !== 'No Brand' && (
                            <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#94a3b8' }}>({item.brand_name})</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>
                          {item.quantity_ordered} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.uom_name}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>
                          {fmtPHP(item.unit_cost)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>
                          {fmtPHP(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '2px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Total Amount</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>{fmtPHP(selectedPO.total_cost)}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => setSelectedPO(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.875rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#1a4263', color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Print PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
