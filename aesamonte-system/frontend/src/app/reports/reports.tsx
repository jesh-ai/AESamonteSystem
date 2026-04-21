'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styles from '@/css/reports.module.css';
import exportStyles from '../../css/exportReports.module.css';
import TopHeader from '@/components/layout/TopHeader';
import { LuDownload, LuSearch, LuX } from 'react-icons/lu';
import ExportReportsModal, { type TabKey } from './exportReports';

// ─── Tab configuration ────────────────────────────────────────────────────────
interface TabConfig {
  key:           TabKey;
  label:         string;
  usesDateFilter: boolean;
  endpoint:      string;
}

const TABS: TabConfig[] = [
  { key: 'stock-on-hand',       label: 'Stock on Hand',       usesDateFilter: false, endpoint: '/api/reports/stock-on-hand'       },
  { key: 'product-performance', label: 'Product Performance', usesDateFilter: true,  endpoint: '/api/reports/product-performance' },
  { key: 'inventory-turnover',  label: 'Inventory Turnover',  usesDateFilter: true,  endpoint: '/api/reports/inventory-turnover'  },
  { key: 'inventory-valuation', label: 'Inventory Valuation', usesDateFilter: false, endpoint: '/api/reports/inventory-valuation' },
  { key: 'stock-ageing',        label: 'Stock Ageing',        usesDateFilter: false, endpoint: '/api/reports/stock-ageing'        },
  { key: 'reorder',             label: 'Reorder Report',      usesDateFilter: false, endpoint: '/api/reports/reorder'             },
  { key: 'customer-sales',      label: 'Customer Sales',      usesDateFilter: true,  endpoint: '/api/reports/customer-sales'      },
];

// ─── Row type definitions ─────────────────────────────────────────────────────

interface StockOnHandRow        { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; unit_cost: number; selling_price: number; stock_status: string; shelf_life: string | null; days_to_expiry: number | null; }
interface ProductPerfRow        { item_name: string; brand_name: string; sku: string; uom: string; units_sold: number; revenue: number; cogs: number; gross_profit: number; margin_pct: number; }
interface InventoryTurnoverRow  { sku: string; item_name: string; brand_name: string; uom: string; units_sold: number; ending_qty: number; avg_inventory: number; turnover_rate: number; days_to_sell: number | null; }
interface InventoryValuationRow { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; unit_cost: number; total_cost_value: number; selling_price: number; total_retail_value: number; potential_profit: number; }
interface StockAgeingRow        { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; last_sold_date: string | null; days_since_last_sale: number | null; ageing_status: string; }
interface ReorderRow            { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; reorder_point: number; min_order_qty: number; lead_time_days: number; suggested_order_qty: number; primary_supplier: string; supplier_contact: string; }
interface CustomerSalesRow      { customer_name: string; total_orders: number; total_qty: number; total_revenue: number; total_cogs: number; total_profit: number; margin_pct: number; avg_order_value: number; payment_methods: string; }

// ─── Formatting helpers ───────────────────────────────────────────────────────

const peso = (v: number) =>
  `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num  = (v: number) => v.toLocaleString('en-PH');

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyRow({ cols, message }: { cols: number; message?: string }) {
  return (
    <tr>
      <td colSpan={cols} className={styles.emptyCell}>
        {message ?? 'No data found for the selected period.'}
      </td>
    </tr>
  );
}

function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className={styles.emptyCell} style={{ color: '#94a3b8' }}>
        Loading…
      </td>
    </tr>
  );
}

function SkuCell({ sku }: { sku: string }) {
  return <span className={styles.codeText}>{sku}</span>;
}

function StockStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Available:       styles.statusAvailable,
    'Low Stock':     styles.statusLow,
    'Out of Stock':  styles.statusOut,
    'Expiring Soon': styles.statusExpiring ?? styles.statusLow,
    Archived:        styles.statusArchived,
  };
  return <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>{status}</span>;
}

function AgeingBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active:        styles.ageActive,
    'Slow-Moving': styles.ageSlow,
    'At Risk':     styles.ageRisk,
    'Dead Stock':  styles.ageDead,
    'Never Sold':  styles.ageNever,
  };
  return <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>{status}</span>;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sumField<T>(arr: T[], key: keyof T): number {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportsPage({
  role = 'Admin',
  onLogout,
}: {
  role?: string;
  onLogout: () => void;
}) {
  // ── Active tab ──
  const [activeTab, setActiveTab] = useState<TabKey>('stock-on-hand');

  // ── Date range (default: first day of month → today) ──
  const today    = new Date().toISOString().split('T')[0];
  const firstDay = today.slice(0, 8) + '01';
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate,   setEndDate]   = useState(today);

  // ── Per-tab data cache ──
  const [dataMap,  setDataMap]  = useState<Partial<Record<TabKey, Record<string, unknown>[]>>>({});
  const [extraMap, setExtraMap] = useState<Partial<Record<TabKey, unknown>>>({});

  // ── UI state ──
  const [loading,  setLoading]  = useState(false);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const [search,   setSearch]   = useState('');

  // ── Export modal ──
  const [showExport, setShowExport] = useState(false);

  // ── Status filter ──
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // ── Toast ──
  const [showToast, setShowToast] = useState(false);
  const [toastMsg,  setToastMsg]  = useState('');
  const [isError,   setIsError]   = useState(false);

  const toast = useCallback((msg: string, err = false) => {
    setToastMsg(msg); setIsError(err); setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  }, []);

  // ── Fetch current tab ──────────────────────────────────────────────────────
  const fetchTab = useCallback(async (tab: TabKey, sd: string, ed: string) => {
    const cfg = TABS.find(t => t.key === tab)!;
    setLoading(true);
    setErrMsg(null);

    let url = cfg.endpoint;
    if (cfg.usesDateFilter) url += `?start_date=${sd}&end_date=${ed}`;

    try {
      const res  = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Request failed');

      if (tab === 'inventory-turnover') {
        setDataMap(prev  => ({ ...prev,  [tab]: json.rows }));
        setExtraMap(prev => ({ ...prev,  [tab]: { period_days: json.period_days } }));
      } else {
        setDataMap(prev  => ({ ...prev,  [tab]: json }));
      }
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch: re-runs whenever tab, startDate, or endDate changes.
  // Snapshot reports (no date filter) are fetched once and cached.
  useEffect(() => {
    const cfg = TABS.find(t => t.key === activeTab)!;
    if (!cfg.usesDateFilter && dataMap[activeTab] !== undefined) return;
    fetchTab(activeTab, startDate, endDate);
    setSearch('');
    setStatusFilter('All Status');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startDate, endDate]);

  // ── Rows ───────────────────────────────────────────────────────────────────
  const allRows: Record<string, unknown>[] = dataMap[activeTab] ?? [];

  // ── Client-side search filter ─────────────────────────────────────────────
  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter(r =>
      Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [allRows, search]);
  
  const cfg      = TABS.find(t => t.key === activeTab)!;
  const canExport = ['Super Admin','Admin', 'Manager'].includes(role ?? '');

  const filteredRows = useMemo(() => {
  if (statusFilter === 'All Status') return rows;
  return rows.filter(r => {
    if (activeTab === 'stock-on-hand') return r.stock_status === statusFilter;
    if (activeTab === 'stock-ageing')  return r.ageing_status === statusFilter;
    return true;
  });
}, [rows, statusFilter, activeTab]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      {/* In reports.tsx — wrap TopHeader */}
      <div style={{ flexShrink: 0 }}>
        <TopHeader role={role} onLogout={onLogout} />
      </div>
      {/* ── Toast notification ── */}
      {showToast && (
        <div className={exportStyles.toastBackdrop}>
          <div className={exportStyles.toastCard}>
            <div className={`${exportStyles.toastBand} ${isError ? exportStyles.toastBandError : exportStyles.toastBandSuccess}`}>
              <div className={exportStyles.toastIcon}>
                {isError
                  ? <span className={exportStyles.toastIconExclaim}>!</span>
                  : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                }
              </div>
            </div>
            <div className={exportStyles.toastBody}>
              <h2 className={exportStyles.toastTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={exportStyles.toastMessage}>{toastMsg}</p>
              <button onClick={() => setShowToast(false)} className={`${exportStyles.toastOkBtn} ${isError ? exportStyles.toastOkBtnError : exportStyles.toastOkBtnSuccess}`}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export modal ── */}
      <ExportReportsModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onSuccess={(msg, type) => { setShowExport(false); toast(msg, type === 'error'); }}
        activeTab={activeTab}
        tabLabel={cfg.label}
        rows={filteredRows}
        startDate={cfg.usesDateFilter ? startDate : ''}
        endDate={cfg.usesDateFilter ? endDate : ''}
      />

      <main className={styles.mainContent}>

        {/* ── Page header ── */}
        <div className={styles.headerActions}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>
              REPORTS
            </h1>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
              Granular tabular reports across inventory, sales, and customer data.
            </p>
          </div>

          {canExport && (
            <button
              className={styles.exportCsvBtn}
              onClick={() => {
                if (!allRows.length) { toast('No data to export. Generate the report first.', true); return; }
                setShowExport(true);
              }}
            >
              <LuDownload size={15} />
              Export Report
            </button>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Report panel ── */}
        <div className={styles.reportPanel}>

          {/* Date filter bar */}
          {cfg.usesDateFilter && (
            <div className={styles.filterBar}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Start Date</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={startDate}
                  max={endDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>End Date</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

              {/* Error banner */}
              {errMsg && (
                <div style={{ color: '#b91c1c', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.875rem' }}>
                  <strong>Error:</strong> {errMsg}
                </div>
              )}

              {/* Table meta row: title + count + search */}
              <div className={styles.tableMetaRow}>
                <span className={styles.tableTitle}>{cfg.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                  
              {/* Status filter — only for stock-on-hand and stock-ageing */}
              {(activeTab === 'stock-on-hand' || activeTab === 'stock-ageing') && (
                <div style={{ position: 'relative' }} data-filter="status">
                  <button
                    onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 12px', borderRadius: '8px',
                      border: '1px solid #e2e8f0', background: '#fff',
                      fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
                      color: '#2d3748', minHeight: '36px'
                    }}
                  >
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: activeTab === 'stock-on-hand'
                        ? statusFilter === 'Available' ? '#10b981'
                        : statusFilter === 'Low Stock' ? '#f59e0b'
                        : statusFilter === 'Expiring Soon' ? '#f97316'
                        : statusFilter === 'Out of Stock' ? '#ef4444'
                        : '#9ca3af'
                        : statusFilter === 'Active' ? '#10b981'
                        : statusFilter === 'Slow-Moving' ? '#f59e0b'
                        : statusFilter === 'At Risk' ? '#f97316'
                        : statusFilter === 'Dead Stock' ? '#ef4444'
                        : statusFilter === 'Never Sold' ? '#94a3b8'
                        : '#9ca3af'
                    }} />
                    <span>{statusFilter}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points={isStatusDropdownOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                    </svg>
                  </button>

                  {isStatusDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                      background: '#fff', border: '1px solid #e2e8f0',
                      borderRadius: '10px', minWidth: '180px', zIndex: 50,
                      boxShadow: '0 10px 28px rgba(0,0,0,0.12)', overflow: 'hidden'
                    }}>
                      {(activeTab === 'stock-on-hand'
                        ? [
                            { label: 'All Status',      color: '#9ca3af' },
                            { label: 'Available',       color: '#10b981' },
                            { label: 'Low Stock',       color: '#f59e0b' },
                            { label: 'Expiring Soon',   color: '#f97316' },
                            { label: 'Out of Stock',    color: '#ef4444' },
                          ]
                        : [
                            { label: 'All Status',   color: '#9ca3af' },
                            { label: 'Active',       color: '#10b981' },
                            { label: 'Slow-Moving',  color: '#f59e0b' },
                            { label: 'At Risk',      color: '#f97316' },
                            { label: 'Dead Stock',   color: '#ef4444' },
                            { label: 'Never Sold',   color: '#94a3b8' },
                          ]
                      ).map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => { setStatusFilter(opt.label); setIsStatusDropdownOpen(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            width: '100%', padding: '10px 14px', border: 'none',
                            background: statusFilter === opt.label ? '#eff6ff' : '#fff',
                            color: statusFilter === opt.label ? '#2563eb' : '#2d3748',
                            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
                            textAlign: 'left', borderBottom: '1px solid #f1f5f9'
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {statusFilter === opt.label && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search box */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <LuSearch size={14} style={{ position: 'absolute', left: 9, color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={styles.dateInput}
                  style={{ paddingLeft: 28, paddingRight: search ? 28 : 8, width: 180, fontSize: '0.8rem' }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: 7, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                    aria-label="Clear search"
                  >
                    <LuX size={13} />
                  </button>
                )}
              </div>
              <span className={styles.tableCount}>
                {filteredRows.length !== allRows.length
                  ? `${filteredRows.length} of ${allRows.length} row${allRows.length !== 1 ? 's' : ''}`
                  : `${filteredRows.length} row${filteredRows.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORT 1 — STOCK ON HAND                                          */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'stock-on-hand' && (() => {
            const r = filteredRows as unknown as StockOnHandRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>SKU</th><th>Item Name</th><th>Brand</th><th>UOM</th>
                    <th className={styles.numCol}>Qty on Hand</th>
                    <th className={styles.numCol}>Unit Cost</th>
                    <th className={styles.numCol}>Selling Price</th>
                    <th>Expiry Date</th>
                    <th className={styles.numCol}>Days to Expiry</th>
                    <th>Status</th>
                  </tr></thead>
                  <tbody>
  {loading ? (
    [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <tr key={`skeleton-${i}`}>
        <td><div className={styles.skeleton} style={{ width: '80%', height: '20px' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '90%', height: '20px' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '70%', height: '20px' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '60%', height: '20px' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '40%', height: '20px', marginLeft: 'auto' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '50%', height: '20px', marginLeft: 'auto' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '50%', height: '20px', marginLeft: 'auto' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '60%', height: '20px' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '40%', height: '20px', marginLeft: 'auto' }} /></td>
        <td><div className={styles.skeleton} style={{ width: '80%', height: '24px', borderRadius: '12px' }} /></td>
      </tr>
    ))
  ) : rows.length === 0 ? (
    <EmptyRow cols={10} />
  ) : (
    r.map((row, i) => (
      <tr key={i}>
        <td><SkuCell sku={row.sku} /></td>
        <td>{row.item_name}</td>
        <td>{row.brand_name}</td>
        <td>{row.uom}</td>
        <td className={styles.numCol}>{num(row.qty_on_hand)}</td>
        <td className={styles.numCol}>{peso(row.unit_cost)}</td>
        <td className={styles.numCol}>{peso(row.selling_price)}</td>
        <td style={{ fontSize: '0.82rem', color: row.days_to_expiry != null && row.days_to_expiry <= 30 ? '#d97706' : '#374151' }}>
          {row.shelf_life ?? <span style={{ color: '#94a3b8' }}>—</span>}
        </td>
        <td className={styles.numCol} style={{ color: row.days_to_expiry != null && row.days_to_expiry <= 0 ? '#dc2626' : row.days_to_expiry != null && row.days_to_expiry <= 30 ? '#d97706' : undefined }}>
          {row.days_to_expiry != null ? row.days_to_expiry : <span style={{ color: '#94a3b8' }}>—</span>}
        </td>
        <td><StockStatusBadge status={row.stock_status} /></td>
      </tr>
    ))
  )}
</tbody>
                  {r.length > 0 && (
                    <tfoot><tr>
                      <td colSpan={4} className={styles.totalLabel}>Totals</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'qty_on_hand'))}</td>
                      <td className={styles.numCol} /><td className={styles.numCol} /><td /><td /><td />
                    </tr></tfoot>
                  )}
                </table>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORT 2 — PRODUCT PERFORMANCE                                    */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'product-performance' && (() => {
            const r = rows as unknown as ProductPerfRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>Item Name</th><th>Brand</th><th>SKU</th><th>UOM</th>
                    <th className={styles.numCol}>Units Sold</th>
                    <th className={styles.numCol}>Revenue</th>
                    <th className={styles.numCol}>COGS</th>
                    <th className={styles.numCol}>Gross Profit</th>
                    <th className={styles.numCol}>Margin %</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={9} /> : r.length === 0 ? <EmptyRow cols={9} /> :
                      r.map((row, i) => (
                        <tr key={i}>
                          <td>{row.item_name}</td>
                          <td>{row.brand_name}</td>
                          <td><SkuCell sku={row.sku} /></td>
                          <td>{row.uom}</td>
                          <td className={styles.numCol}>{num(row.units_sold)}</td>
                          <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.revenue)}</td>
                          <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.cogs)}</td>
                          <td className={`${styles.numCol} ${styles.addedVal}`}>{peso(row.gross_profit)}</td>
                          <td className={`${styles.numCol} ${row.margin_pct >= 20 ? styles.addedVal : row.margin_pct < 10 ? styles.soldVal : ''}`}>
                            {row.margin_pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                  {r.length > 0 && (
                    <tfoot><tr>
                      <td colSpan={4} className={styles.totalLabel}>Totals</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'units_sold'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'revenue'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'cogs'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'gross_profit'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>
                        {sumField(r, 'revenue') > 0
                          ? `${((sumField(r, 'gross_profit') / sumField(r, 'revenue')) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORT 3 — INVENTORY TURNOVER                                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'inventory-turnover' && (() => {
            const r    = rows as unknown as InventoryTurnoverRow[];
            const meta = extraMap['inventory-turnover'] as { period_days: number } | undefined;
            return (
              <>
                {meta && (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 12 }}>
                    Analysis period: <strong>{meta.period_days} days</strong>
                  </p>
                )}
                <div className={styles.tableWrapper}>
                  <table className={styles.reportTable}>
                    <thead><tr>
                      <th>SKU</th><th>Item Name</th><th>Brand</th><th>UOM</th>
                      <th className={styles.numCol}>Units Sold</th>
                      <th className={styles.numCol}>Ending Qty</th>
                      <th className={styles.numCol}>Avg Inventory</th>
                      <th className={styles.numCol}>Turnover Rate</th>
                      <th className={styles.numCol}>Days to Sell</th>
                    </tr></thead>
                    <tbody>
                      {loading ? <LoadingRow cols={9} /> : r.length === 0 ? <EmptyRow cols={9} /> :
                        r.map((row, i) => (
                          <tr key={i}>
                            <td><SkuCell sku={row.sku} /></td>
                            <td>{row.item_name}</td>
                            <td>{row.brand_name}</td>
                            <td>{row.uom}</td>
                            <td className={styles.numCol}>{num(row.units_sold)}</td>
                            <td className={styles.numCol}>{num(row.ending_qty)}</td>
                            <td className={styles.numCol}>{row.avg_inventory.toFixed(1)}</td>
                            <td className={`${styles.numCol} ${row.turnover_rate >= 4 ? styles.addedVal : row.turnover_rate < 1 ? styles.soldVal : ''}`}>
                              {row.turnover_rate.toFixed(2)}×
                            </td>
                            <td className={styles.numCol}>
                              {row.days_to_sell != null ? `${row.days_to_sell} days` : '—'}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORT 4 — INVENTORY VALUATION                                    */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'inventory-valuation' && (() => {
            const r = rows as unknown as InventoryValuationRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>SKU</th><th>Item Name</th><th>Brand</th><th>UOM</th>
                    <th className={styles.numCol}>Qty</th>
                    <th className={styles.numCol}>Unit Cost</th>
                    <th className={styles.numCol}>Total Cost Value</th>
                    <th className={styles.numCol}>Selling Price</th>
                    <th className={styles.numCol}>Total Retail Value</th>
                    <th className={styles.numCol}>Potential Profit</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={10} /> : r.length === 0 ? <EmptyRow cols={10} /> :
                      r.map((row, i) => (
                        <tr key={i}>
                          <td><SkuCell sku={row.sku} /></td>
                          <td>{row.item_name}</td>
                          <td>{row.brand_name}</td>
                          <td>{row.uom}</td>
                          <td className={styles.numCol}>{num(row.qty_on_hand)}</td>
                          <td className={styles.numCol}>{peso(row.unit_cost)}</td>
                          <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.total_cost_value)}</td>
                          <td className={styles.numCol}>{peso(row.selling_price)}</td>
                          <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.total_retail_value)}</td>
                          <td className={`${styles.numCol} ${styles.addedVal}`}>{peso(row.potential_profit)}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                  {r.length > 0 && (
                    <tfoot><tr>
                      <td colSpan={4} className={styles.totalLabel}>Totals</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'qty_on_hand'))}</td>
                      <td className={styles.numCol} />
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_cost_value'))}</td>
                      <td className={styles.numCol} />
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_retail_value'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'potential_profit'))}</td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORT 5 — STOCK AGEING                                           */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'stock-ageing' && (() => {
            const r = filteredRows as unknown as StockAgeingRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>SKU</th><th>Item Name</th><th>Brand</th><th>UOM</th>
                    <th className={styles.numCol}>Qty on Hand</th>
                    <th>Last Sold Date</th>
                    <th className={styles.numCol}>Days Since Sale</th>
                    <th>Ageing Status</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={8} /> : r.length === 0 ? <EmptyRow cols={8} /> :
                      r.map((row, i) => (
                        <tr key={i}>
                          <td><SkuCell sku={row.sku} /></td>
                          <td>{row.item_name}</td>
                          <td>{row.brand_name}</td>
                          <td>{row.uom}</td>
                          <td className={styles.numCol}>{num(row.qty_on_hand)}</td>
                          <td>{row.last_sold_date ?? <span style={{ color: '#94a3b8' }}>Never</span>}</td>
                          <td className={styles.numCol}>
                            {row.days_since_last_sale != null
                              ? row.days_since_last_sale
                              : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                          <td><AgeingBadge status={row.ageing_status} /></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORT 6 — REORDER REPORT                                         */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'reorder' && (() => {
            const r = rows as unknown as ReorderRow[];
            return (
              <>
                {!loading && r.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.8rem', color: '#92400e' }}>
                    ⚠ <strong>{r.length} item{r.length !== 1 ? 's' : ''}</strong> {r.length === 1 ? 'has' : 'have'} reached or fallen below their reorder point.
                  </div>
                )}
                <div className={styles.tableWrapper}>
                  <table className={styles.reportTable}>
                    <thead><tr>
                      <th>SKU</th><th>Item Name</th><th>Brand</th><th>UOM</th>
                      <th className={styles.numCol}>Current Qty</th>
                      <th className={styles.numCol}>Reorder Point</th>
                      <th className={styles.numCol}>Min Order Qty</th>
                      <th className={styles.numCol}>Lead Time (Days)</th>
                      <th className={styles.numCol}>Suggested Order</th>
                      <th>Primary Supplier</th>
                      <th>Contact</th>
                    </tr></thead>
                    <tbody>
                      {loading ? <LoadingRow cols={11} /> : r.length === 0
                        ? <tr><td colSpan={11} className={styles.emptyCell} style={{ color: '#15803d' }}>✓ All items are sufficiently stocked.</td></tr>
                        : r.map((row, i) => (
                          <tr key={i}>
                            <td><SkuCell sku={row.sku} /></td>
                            <td>{row.item_name}</td>
                            <td>{row.brand_name}</td>
                            <td>{row.uom}</td>
                            <td className={`${styles.numCol} ${row.qty_on_hand === 0 ? styles.soldVal : styles.endingLow}`}>
                              {num(row.qty_on_hand)}
                            </td>
                            <td className={styles.numCol}>{num(row.reorder_point)}</td>
                            <td className={styles.numCol}>{num(row.min_order_qty)}</td>
                            <td className={styles.numCol}>{row.lead_time_days}</td>
                            <td className={`${styles.numCol} ${styles.revenueVal}`} style={{ fontWeight: 700 }}>
                              {num(row.suggested_order_qty)}
                            </td>
                            <td>{row.primary_supplier}</td>
                            <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{row.supplier_contact}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                    {r.length > 0 && (
                      <tfoot><tr>
                        <td colSpan={8} className={styles.totalLabel}>Total Suggested Orders</td>
                        <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'suggested_order_qty'))}</td>
                        <td colSpan={2} />
                      </tr></tfoot>
                    )}
                  </table>
                </div>
              </>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORT 7 — CUSTOMER SALES                                         */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'customer-sales' && (() => {
            const r = rows as unknown as CustomerSalesRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>Customer</th>
                    <th className={styles.numCol}>Total Orders</th>
                    <th className={styles.numCol}>Total Qty</th>
                    <th className={styles.numCol}>Revenue</th>
                    <th className={styles.numCol}>COGS</th>
                    <th className={styles.numCol}>Profit</th>
                    <th className={styles.numCol}>Margin %</th>
                    <th className={styles.numCol}>Avg Order Value</th>
                    <th>Payment Methods</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={9} /> : r.length === 0 ? <EmptyRow cols={9} /> :
                      r.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{row.customer_name}</td>
                          <td className={styles.numCol}>{num(row.total_orders)}</td>
                          <td className={styles.numCol}>{num(row.total_qty)}</td>
                          <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.total_revenue)}</td>
                          <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.total_cogs)}</td>
                          <td className={`${styles.numCol} ${styles.addedVal}`}>{peso(row.total_profit)}</td>
                          <td className={`${styles.numCol} ${row.margin_pct >= 20 ? styles.addedVal : row.margin_pct < 10 ? styles.soldVal : ''}`}>
                            {row.margin_pct.toFixed(1)}%
                          </td>
                          <td className={styles.numCol}>{peso(row.avg_order_value)}</td>
                          <td><span className={styles.paymentBadge}>{row.payment_methods}</span></td>
                        </tr>
                      ))
                    }
                  </tbody>
                  {r.length > 0 && (
                    <tfoot><tr>
                      <td className={styles.totalLabel}>Totals</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'total_orders'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'total_qty'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_revenue'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_cogs'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_profit'))}</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>
                        {sumField(r, 'total_revenue') > 0
                          ? `${((sumField(r, 'total_profit') / sumField(r, 'total_revenue')) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td colSpan={2} />
                    </tr></tfoot>
                  )}
                </table>
              </div>
            );
          })()}

        </div>
      </main>
    </div>
  );
}