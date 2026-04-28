'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styles from '@/css/reports.module.css';
import exportStyles from '../../css/exportReports.module.css';
import TopHeader from '@/components/layout/TopHeader';
import { LuDownload, LuSearch, LuX } from 'react-icons/lu';
import ExportReportsModal, { type TabKey } from './exportReports';
import RestrictedAccessModal from '@/components/features/RestrictedAccessModal';
import type { ModulePerms } from '@/types/user';

// ─── Tab config ───────────────────────────────────────────────────────────────
interface TabConfig { key: TabKey; label: string; usesDateFilter: boolean; endpoint: string; }
const TABS: TabConfig[] = [
  { key: 'stock-on-hand',       label: 'Stock on Hand',       usesDateFilter: false, endpoint: '/api/reports/stock-on-hand'       },
  { key: 'product-performance', label: 'Product Performance', usesDateFilter: false, endpoint: '/api/reports/product-performance' },
  { key: 'inventory-valuation', label: 'Inventory Valuation', usesDateFilter: false, endpoint: '/api/reports/inventory-valuation' },
  { key: 'stock-ageing',        label: 'Stock Ageing',        usesDateFilter: false, endpoint: '/api/reports/stock-ageing'        },
  { key: 'reorder',             label: 'Reorder Report',      usesDateFilter: false, endpoint: '/api/reports/reorder'             },
  { key: 'customer-sales',      label: 'Customer Sales',      usesDateFilter: false,  endpoint: '/api/reports/customer-sales'      },
];

// ─── Row types ────────────────────────────────────────────────────────────────
interface StockOnHandRow        { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; unit_cost: number; selling_price: number; stock_status: string; shelf_life: string | null; days_to_expiry: number | null; }
interface ProductPerfRow        { item_name: string; brand_name: string; sku: string; uom: string; units_sold: number; revenue: number; cogs: number; gross_profit: number; margin_pct: number; }
interface InventoryValuationRow { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; unit_cost: number; total_cost_value: number; selling_price: number; total_retail_value: number; potential_profit: number; profit_status: string; }
interface StockAgeingRow        { item_name: string; brand_name: string; uom: string; qty_on_hand: number; last_received_date: string | null; days_in_inventory: number | null; ageing_category: string; value_of_aged_stock: number; ageing_status: string; }
interface ReorderRow            { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; reorder_point: number; min_order_qty: number; lead_time_days: number; suggested_order_qty: number; primary_supplier: string; supplier_contact: string; inventory_brand_id: number; }
interface CustomerSalesRow      { customer_name: string; total_orders: number; total_revenue: number; last_purchase_date: string | null; days_inactive: number | null; activity_status: string; ltv_trend: string; this_month: number; last_month: number; preferred_payment: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const peso = (v: number | null | undefined) => `\u20b1${(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num  = (v: number | null | undefined) => (v ?? 0).toLocaleString('en-PH');
function sumField<T>(arr: T[], key: keyof T): number {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function EmptyRow({ cols, message }: { cols: number; message?: string }) {
  return <tr><td colSpan={cols} className={styles.emptyCell}>{message ?? 'No data found.'}</td></tr>;
}
function LoadingRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className={styles.emptyCell} style={{ color: '#94a3b8' }}>Loading...</td></tr>;
}
function SkuCell({ sku }: { sku: string }) {
  return <span className={styles.codeText}>{sku}</span>;
}
function StockStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Available: styles.statusAvailable, 'Low Stock': styles.statusLow,
    'Out of Stock': styles.statusOut, 'Expiring Soon': styles.statusLow, Archived: styles.statusArchived,
  };
  return <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>{status}</span>;
}
function AgeingBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Fresh:    styles.ageActive,
    Ageing:   styles.ageSlow,
    Old:      styles.ageRisk,
    Critical: styles.ageDead,
  };
  return <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>{status}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ReportsPage({
  role = 'Admin', onLogout, permissions, onNavigate,
}: {
  role?: string;
  onLogout: () => void;
  permissions?: ModulePerms;
  onNavigate?: (tab: string, item?: { inventory_brand_id: number; item_name: string; brand_name: string; uom_name: string; quantity_ordered: number; unit_cost: number; }) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('stock-on-hand');
  const today    = new Date().toISOString().split('T')[0];
  const firstDay = today.slice(0, 8) + '01';
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate,   setEndDate]   = useState(today);
  const [dataMap,   setDataMap]   = useState<Partial<Record<TabKey, Record<string, unknown>[]>>>({});
  const [extraMap,  setExtraMap]  = useState<Partial<Record<TabKey, unknown>>>({});
  const [loading,   setLoading]   = useState(false);
  const [errMsg,    setErrMsg]    = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [showExport, setShowExport] = useState(false);

  // ── Status / category filter ──
  const [statusFilter, setStatusFilter] = useState('All');
  const [statusOpen,   setStatusOpen]   = useState(false);

  // ── Date range filter (for tabs that don't use server-side date) ──
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  // ── Sort ──
  const [sortKey, setSortKey]   = useState<string>('');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg,  setToastMsg]  = useState('');
  const [isError,   setIsError]   = useState(false);

  const toast = useCallback((msg: string, err = false) => {
    setToastMsg(msg); setIsError(err); setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  }, []);

  const fetchTab = useCallback(async (tab: TabKey, sd: string, ed: string) => {
    const cfg = TABS.find(t => t.key === tab)!;
    setLoading(true); setErrMsg(null);
    let url = cfg.endpoint;
    if (cfg.usesDateFilter) url += `?start_date=${sd}&end_date=${ed}`;
    try {
      const res  = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Request failed');
      setDataMap(prev => ({ ...prev, [tab]: json }));
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Unknown error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const cfg = TABS.find(t => t.key === activeTab)!;
    // Always re-fetch; don't use stale cache
    fetchTab(activeTab, startDate, endDate);
    setSearch(''); setStatusFilter('All'); setFromDate(''); setToDate('');
    setSortKey(''); setSortDir('asc');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startDate, endDate]);

  const allRows = useMemo<Record<string, unknown>[]>(() => dataMap[activeTab] ?? [], [dataMap, activeTab]);
  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [allRows, search]);

  const cfg = TABS.find(t => t.key === activeTab)!;
  const canExport = permissions?.can_export ?? false;

  // ── Per-tab filter options ──
  const STATUS_OPTIONS: Partial<Record<TabKey, { label: string; color: string; field: string }[]>> = {
    'stock-on-hand':  [
      { label: 'All', color: '#9ca3af', field: '' },
      { label: 'Available',      color: '#10b981', field: 'stock_status' },
      { label: 'Low Stock',      color: '#f59e0b', field: 'stock_status' },
      { label: 'Expiring Soon',  color: '#f97316', field: 'stock_status' },
      { label: 'Out of Stock',   color: '#ef4444', field: 'stock_status' },
      { label: 'Archived',       color: '#6b7280', field: 'stock_status' },
    ],
    'stock-ageing': [
      { label: 'All',          color: '#9ca3af', field: '' },
      { label: 'Fresh',        color: '#10b981', field: 'ageing_status' },
      { label: 'Ageing',       color: '#f59e0b', field: 'ageing_status' },
      { label: 'Old',          color: '#f97316', field: 'ageing_status' },
      { label: 'Critical',     color: '#ef4444', field: 'ageing_status' },
    ],
    'product-performance': [
      { label: 'All', color: '#9ca3af', field: '' },
      { label: 'High Margin (>=20%)', color: '#10b981', field: '_margin' },
      { label: 'Mid Margin',          color: '#f59e0b', field: '_margin' },
      { label: 'Low Margin (<10%)',   color: '#ef4444', field: '_margin' },
    ],
    'inventory-valuation': [
      { label: 'All', color: '#9ca3af', field: '' },
      { label: 'Profitable',     color: '#10b981', field: '_profit' },
      { label: 'Break-even',     color: '#f59e0b', field: '_profit' },
      { label: 'Loss',           color: '#ef4444', field: '_profit' },
    ],
    'customer-sales': [
      { label: 'All',      color: '#9ca3af', field: '' },
      { label: 'Active',   color: '#10b981', field: 'activity_status' },
      { label: 'Inactive', color: '#f59e0b', field: 'activity_status' },
      { label: 'At Risk',  color: '#f97316', field: 'activity_status' },
      { label: 'Dormant',  color: '#ef4444', field: 'activity_status' },
    ],
  };

  const tabStatusOptions = STATUS_OPTIONS[activeTab] ?? [];
  const dotColor = tabStatusOptions.find(o => o.label === statusFilter)?.color ?? '#9ca3af';

  const filteredRows = useMemo(() => {
    let result = rows;

    // Status / category filter
    if (statusFilter !== 'All' && tabStatusOptions.length > 0) {
      const opt = tabStatusOptions.find(o => o.label === statusFilter);
      if (opt && opt.field) {
        if (opt.field === 'stock_status') result = result.filter(r => (r as Record<string,unknown>).stock_status === opt.label);
        else if (opt.field === 'ageing_status') result = result.filter(r => (r as Record<string,unknown>).ageing_status === opt.label);
        else if (opt.field === 'item_status') result = result.filter(r => (r as Record<string,unknown>).item_status === opt.label);
        else if (opt.field === 'activity_status') result = result.filter(r => (r as Record<string,unknown>).activity_status === opt.label);
        else if (opt.field === '_margin') {
          result = result.filter(r => {
            const m = Number((r as Record<string,unknown>).margin_pct ?? 0);
            if (opt.label.startsWith('High'))  return m >= 20;
            if (opt.label.startsWith('Low'))   return m < 10;
            return m >= 10 && m < 20;
          });
        } else if (opt.field === '_profit') {
          result = result.filter(r => {
            const status = (r as Record<string,unknown>).profit_status as string;
            return status === opt.label;
          });
        }
      }
    }

    // Date range filter (client-side, for non-server-date tabs)
    if ((fromDate || toDate) && !cfg.usesDateFilter) {
      const dateField: Partial<Record<TabKey, string>> = {
        'stock-ageing':   'last_sold_date',
        'customer-sales': 'sales_date',
        'product-performance': 'sales_date',
      };
      const field = dateField[activeTab];
      if (field) {
        result = result.filter(r => {
          const d = (r as Record<string,unknown>)[field] as string | null;
          if (!d) return !fromDate; // null dates only shown when no from filter
          if (fromDate && d < fromDate) return false;
          if (toDate   && d > toDate)   return false;
          return true;
        });
      }
    }

    // Sort
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = (a as Record<string,unknown>)[sortKey];
        const bv = (b as Record<string,unknown>)[sortKey];
        const an = Number(av), bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, statusFilter, fromDate, toDate, sortKey, sortDir, activeTab, tabStatusOptions]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>;
    return sortDir === 'asc'
      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a4263" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a4263" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>;
  }

  // Tabs that show date inputs (server-side via usesDateFilter, or client-side filtering)
  const hasDateFilter = ['product-performance'].includes(activeTab);

  return (
    <div className={styles.container}>
      {permissions && !permissions.can_view && (
        <RestrictedAccessModal onClose={onLogout} message="You don't have permission to view Reports. Please contact your administrator." />
      )}
      <div style={{ flexShrink: 0 }}><TopHeader role={role} onLogout={onLogout} /></div>

      {/* Toast */}
      {showToast && (
        <div className={exportStyles.toastBackdrop}>
          <div className={exportStyles.toastCard}>
            <div className={`${exportStyles.toastBand} ${isError ? exportStyles.toastBandError : exportStyles.toastBandSuccess}`}>
              <div className={exportStyles.toastIcon}>
                {isError
                  ? <span className={exportStyles.toastIconExclaim}>!</span>
                  : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
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

      <ExportReportsModal
        isOpen={showExport} onClose={() => setShowExport(false)}
        onSuccess={(msg, type) => { setShowExport(false); toast(msg, type === 'error'); }}
        activeTab={activeTab} tabLabel={cfg.label} rows={filteredRows}
        startDate={cfg.usesDateFilter ? startDate : ''} endDate={cfg.usesDateFilter ? endDate : ''}
      />

      <main className={styles.mainContent}>
        {/* Header */}
        <div className={styles.headerActions}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>REPORTS</h1>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
              Granular tabular reports across inventory, sales, and customer data.
            </p>
          </div>
          {canExport && (
            <button className={styles.exportCsvBtn} onClick={() => {
              if (!allRows.length) { toast('No data to export.', true); return; }
              setShowExport(true);
            }}>
              <LuDownload size={15} /> Export Report
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button key={t.key}
              className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Report panel */}
        <div className={styles.reportPanel}>
          {errMsg && (
            <div style={{ color: '#b91c1c', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.875rem' }}>
              <strong>Error:</strong> {errMsg}
            </div>
          )}

          {/* Single unified filter row */}
          <div className={styles.filterBar} style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between' }}>
            {/* LEFT: date inputs */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              {(cfg.usesDateFilter || hasDateFilter) && (
                <>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Start Date</label>
                    <input type="date" className={styles.dateInput}
                      value={cfg.usesDateFilter ? startDate : fromDate}
                      max={cfg.usesDateFilter ? endDate : (toDate || undefined)}
                      onChange={e => cfg.usesDateFilter ? setStartDate(e.target.value) : setFromDate(e.target.value)} />
                  </div>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>End Date</label>
                    <input type="date" className={styles.dateInput}
                      value={cfg.usesDateFilter ? endDate : toDate}
                      min={cfg.usesDateFilter ? startDate : (fromDate || undefined)}
                      onChange={e => cfg.usesDateFilter ? setEndDate(e.target.value) : setToDate(e.target.value)} />
                  </div>
                  <button className={styles.generateBtn}
                    onClick={() => { if (cfg.usesDateFilter) fetchTab(activeTab, startDate, endDate); }}>
                    Generate
                  </button>
                  {!cfg.usesDateFilter && (fromDate || toDate) && (
                    <button onClick={() => { setFromDate(''); setToDate(''); }}
                      style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 12px', fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer' }}>
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: status filter + search + count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {tabStatusOptions.length > 1 && (
                <div className={styles.statusFilterContainer}>
                  <button
                    className={`${styles.statusFilterTrigger} ${statusOpen ? styles.statusFilterTriggerOpen : ''}`}
                    onClick={() => setStatusOpen(p => !p)}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: dotColor, display: 'inline-block' }} />
                    <span>{statusFilter}</span>
                    <svg className={`${styles.statusFilterChevron} ${statusOpen ? styles.statusFilterChevronOpen : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {statusOpen && (
                    <div className={styles.statusFilterMenu}>
                      {tabStatusOptions.map(opt => (
                        <button key={opt.label}
                          className={`${styles.statusFilterMenuItem} ${statusFilter === opt.label ? styles.statusFilterMenuItemActive : ''}`}
                          onClick={() => { setStatusFilter(opt.label); setStatusOpen(false); }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {statusFilter === opt.label && <svg className={styles.statusFilterCheckmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <LuSearch size={14} style={{ position: 'absolute', left: 9, color: '#94a3b8', pointerEvents: 'none' }} />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                  className={styles.dateInput} style={{ paddingLeft: 28, paddingRight: search ? 28 : 8, width: 180, fontSize: '0.8rem' }} />
                {search && (
                  <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}>
                    <LuX size={13} />
                  </button>
                )}
              </div>

              <span className={styles.tableCount}>
                {filteredRows.length !== allRows.length
                  ? `${filteredRows.length} of ${allRows.length} rows`
                  : `${filteredRows.length} row${filteredRows.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* STOCK ON HAND */}
          {activeTab === 'stock-on-hand' && (() => {
            const r = filteredRows as unknown as StockOnHandRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>SKU</th><th>Item Name</th><th>Brand</th><th>UOM</th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('qty_on_hand')}>Qty on Hand <SortIcon col="qty_on_hand" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('unit_cost')}>Unit Cost <SortIcon col="unit_cost" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('selling_price')}>Selling Price <SortIcon col="selling_price" /></th>
                    <th>Expiry Date</th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('days_to_expiry')}>Days to Expiry <SortIcon col="days_to_expiry" /></th>
                    <th>Status</th>
                  </tr></thead>
                  <tbody>
                    {loading
                      ? [1,2,3,4,5,6,7,8].map(i => (
                          <tr key={i}>{[80,90,70,60,40,50,50,60,40,80].map((w,j) => (
                            <td key={j}><div className={styles.skeleton} style={{ width: `${w}%`, height: 20, marginLeft: j >= 4 ? 'auto' : undefined }} /></td>
                          ))}</tr>
                        ))
                      : r.length === 0 ? <EmptyRow cols={10} />
                      : r.map((row, i) => (
                        <tr key={i}>
                          <td><SkuCell sku={row.sku} /></td>
                          <td>{row.item_name}</td><td>{row.brand_name}</td><td>{row.uom}</td>
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
                    }
                  </tbody>
                  {r.length > 0 && <tfoot><tr>
                    <td colSpan={4} className={styles.totalLabel} style={{ paddingLeft: 14 }}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`} style={{ paddingRight: 14 }}>{num(sumField(r, 'qty_on_hand'))}</td>
                    <td /><td /><td /><td /><td />
                  </tr></tfoot>}
                </table>
              </div>
            );
          })()}

          {/* PRODUCT PERFORMANCE */}
          {activeTab === 'product-performance' && (() => {
            const r = filteredRows as unknown as ProductPerfRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>Item Name</th><th>Brand</th><th>SKU</th><th>UOM</th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('units_sold')}>Qty Sold <SortIcon col="units_sold" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('revenue')}>Gross Sales <SortIcon col="revenue" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('cogs')}>COGS <SortIcon col="cogs" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('gross_profit')}>Net Profit <SortIcon col="gross_profit" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('margin_pct')}>Contribution % <SortIcon col="margin_pct" /></th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={9} /> : r.length === 0 ? <EmptyRow cols={9} /> : r.map((row, i) => (
                      <tr key={i}>
                        <td>{row.item_name}</td><td>{row.brand_name}</td>
                        <td><SkuCell sku={row.sku} /></td><td>{row.uom}</td>
                        <td className={styles.numCol}>{num(row.units_sold)}</td>
                        <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.revenue)}</td>
                        <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.cogs)}</td>
                        <td className={`${styles.numCol} ${row.gross_profit >= 0 ? styles.addedVal : styles.soldVal}`}>{peso(row.gross_profit)}</td>
                        <td className={`${styles.numCol} ${row.margin_pct >= 20 ? styles.addedVal : row.margin_pct < 5 ? styles.soldVal : ''}`}>
                          {row.margin_pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {r.length > 0 && <tfoot><tr>
                    <td colSpan={4} className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'units_sold'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'revenue'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'cogs'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'gross_profit'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>100%</td>
                  </tr></tfoot>}
                </table>
              </div>
            );
          })()}

          {/* INVENTORY VALUATION */}
          {activeTab === 'inventory-valuation' && (() => {
            const r = filteredRows as unknown as InventoryValuationRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>Item Name</th><th>Brand</th><th>UOM</th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('qty_on_hand')}>Stock on Hand <SortIcon col="qty_on_hand" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('unit_cost')}>Unit Cost <SortIcon col="unit_cost" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('selling_price')}>Unit Price <SortIcon col="selling_price" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('total_cost_value')}>Total Cost Value <SortIcon col="total_cost_value" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('total_retail_value')}>Total Retail Value <SortIcon col="total_retail_value" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('potential_profit')}>Potential Profit <SortIcon col="potential_profit" /></th>
                    <th>Status</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={10} /> : r.length === 0 ? <EmptyRow cols={10} /> : r.map((row, i) => (
                      <tr key={i}>
                        <td>{row.item_name}</td>
                        <td>{row.brand_name}</td><td>{row.uom}</td>
                        <td className={styles.numCol}>{num(row.qty_on_hand)}</td>
                        <td className={styles.numCol}>{peso(row.unit_cost)}</td>
                        <td className={styles.numCol}>{peso(row.selling_price)}</td>
                        <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.total_cost_value)}</td>
                        <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.total_retail_value)}</td>
                        <td className={`${styles.numCol} ${row.potential_profit >= 0 ? styles.addedVal : styles.soldVal}`}>{peso(row.potential_profit)}</td>
                        <td>
                          <span className={styles.statusBadge} style={{
                            background: row.profit_status === 'Profitable' ? '#dcfce7' : row.profit_status === 'Loss' ? '#fee2e2' : '#fef9c3',
                            color:      row.profit_status === 'Profitable' ? '#15803d' : row.profit_status === 'Loss' ? '#b91c1c' : '#854d0e',
                          }}>{row.profit_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {r.length > 0 && <tfoot><tr>
                    <td colSpan={3} className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'qty_on_hand'))}</td>
                    <td /><td />
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_cost_value'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_retail_value'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'potential_profit'))}</td>
                    <td />
                  </tr></tfoot>}
                </table>
              </div>
            );
          })()}

          {/* STOCK AGEING */}
          {activeTab === 'stock-ageing' && (() => {
            const r = filteredRows as unknown as StockAgeingRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>Item Name</th><th>Brand</th><th>UOM</th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('qty_on_hand')}>Qty on Hand <SortIcon col="qty_on_hand" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('last_received_date')}>Last Received <SortIcon col="last_received_date" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('days_in_inventory')}>Days in Inventory <SortIcon col="days_in_inventory" /></th>
                    <th>Ageing Category</th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('value_of_aged_stock')}>Value of Aged Stock <SortIcon col="value_of_aged_stock" /></th>
                    <th>Status</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={9} /> : r.length === 0 ? <EmptyRow cols={9} /> : r.map((row, i) => (
                      <tr key={i}>
                        <td>{row.item_name}</td>
                        <td>{row.brand_name}</td><td>{row.uom}</td>
                        <td className={styles.numCol}>{num(row.qty_on_hand)}</td>
                        <td>{row.last_received_date ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                        <td className={styles.numCol}>{row.days_in_inventory ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                        <td style={{ fontSize: '0.82rem', color: '#475569' }}>{row.ageing_category}</td>
                        <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.value_of_aged_stock)}</td>
                        <td><AgeingBadge status={row.ageing_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                  {r.length > 0 && <tfoot><tr>
                    <td colSpan={3} className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'qty_on_hand'))}</td>
                    <td /><td /><td />
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'value_of_aged_stock'))}</td>
                    <td />
                  </tr></tfoot>}
                </table>
              </div>
            );
          })()}

          {/* REORDER REPORT */}
          {activeTab === 'reorder' && (() => {
            const r = filteredRows as unknown as ReorderRow[];
            return (
              <>
                {!loading && r.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.8rem', color: '#92400e' }}>
                    <strong>{r.length} item{r.length !== 1 ? 's' : ''}</strong> {r.length === 1 ? 'has' : 'have'} reached or fallen below their reorder point.
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
                      <th>Primary Supplier</th><th>Contact</th>
                    </tr></thead>
                    <tbody>
                      {loading ? <LoadingRow cols={11} />
                        : r.length === 0
                          ? <tr><td colSpan={11} className={styles.emptyCell} style={{ color: '#15803d' }}>All items are sufficiently stocked.</td></tr>
                          : r.map((row, i) => (
                            <tr key={i}
                              style={{ cursor: onNavigate ? 'pointer' : undefined }}
                              onClick={() => onNavigate?.('Purchases', {
                                inventory_brand_id: 0, // resolved server-side via SKU
                                item_name:          row.item_name,
                                brand_name:         row.brand_name,
                                uom_name:           row.uom,
                                quantity_ordered:   row.suggested_order_qty,
                                unit_cost:          0,
                              })}
                              title={onNavigate ? `Create PO for ${row.item_name}` : undefined}>
                              <td><SkuCell sku={row.sku} /></td>
                              <td style={{ color: '#1a4263', fontWeight: 600 }}>{row.item_name}</td>
                              <td>{row.brand_name}</td><td>{row.uom}</td>
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
                    {r.length > 0 && <tfoot><tr>
                      <td colSpan={8} className={styles.totalLabel}>Total Suggested Orders</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'suggested_order_qty'))}</td>
                      <td colSpan={2} />
                    </tr></tfoot>}
                  </table>
                </div>
              </>
            );
          })()}

          {/* CUSTOMER SALES */}
          {activeTab === 'customer-sales' && (() => {
            const r = filteredRows as unknown as CustomerSalesRow[];
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <th>Customer Name</th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('total_orders')}>Total Orders <SortIcon col="total_orders" /></th>
                    <th className={styles.numCol} style={{ cursor:'pointer' }} onClick={() => toggleSort('total_revenue')}>Total Revenue <SortIcon col="total_revenue" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('last_purchase_date')}>Last Purchase Date <SortIcon col="last_purchase_date" /></th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('days_inactive')}>Activity Status <SortIcon col="days_inactive" /></th>
                    <th>Spending Pattern (Current vs Last Month)</th>
                    <th>Payment Methods</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={7} /> : r.length === 0 ? <EmptyRow cols={7} /> : r.map((row, i) => {
                      const trendMap: Record<string, { icon: string; label: string; color: string; bg: string }> = {
                        up:   { icon: '↑', label: '', color: '#15803d', bg: '#dcfce7' },
                        down: { icon: '↓', label: '', color: '#b91c1c', bg: '#fee2e2' },
                        flat: { icon: '→', label: '', color: '#854d0e', bg: '#fef9c3' },
                        new:  { icon: '✦', label: 'New', color: '#1d4ed8', bg: '#dbeafe' },
                      };
                      const trend = trendMap[row.ltv_trend] ?? trendMap.flat;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{row.customer_name}</td>
                          <td className={styles.numCol}>{num(row.total_orders)}</td>
                          <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.total_revenue)}</td>
                          <td>{row.last_purchase_date ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                          <td>{(() => {
                            const riskMap: Record<string, { color: string; bg: string }> = {
                              Active:   { color: '#15803d', bg: '#dcfce7' },
                              Inactive: { color: '#854d0e', bg: '#fef9c3' },
                              'At Risk':{ color: '#9a3412', bg: '#ffedd5' },
                              Dormant:  { color: '#b91c1c', bg: '#fee2e2' },
                              Unknown:  { color: '#64748b', bg: '#f1f5f9' },
                            };
                            const s = riskMap[row.activity_status] ?? riskMap.Unknown;
                            return (
                              <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>
                                {row.activity_status}
                                {row.days_inactive != null && <span style={{ fontWeight: 400, marginLeft: 4 }}>({row.days_inactive}d)</span>}
                              </span>
                            );
                          })()}</td>
                          <td>
                            {row.ltv_trend === 'new'
                              ? <span style={{ color: '#94a3b8' }}>—</span>
                              : <span className={styles.statusBadge} style={{ background: trend.bg, color: trend.color }}>
                                  {trend.icon} {peso(row.this_month)} vs {peso(row.last_month)}
                                </span>
                            }
                          </td>
                          <td><span className={styles.paymentBadge}>{row.preferred_payment}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {r.length > 0 && <tfoot><tr>
                    <td className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(r, 'total_orders'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(r, 'total_revenue'))}</td>
                    <td colSpan={4} />
                  </tr></tfoot>}
                </table>
              </div>
            );
          })()}

        </div>
      </main>
    </div>
  );
}
