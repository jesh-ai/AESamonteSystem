'use client';

/**
 * ExportReportsModal
 * ──────────────────────────────────────────────────────────────────────
 * Reusable export modal for the Reports module (AE Samonte Merchandise).
 * Accepts the live row data already loaded in Reports.tsx and lets the
 * user download it as  PDF  |  Excel (.xlsx)  |  CSV.
 *
 * Props
 *   isOpen    – controls visibility
 *   onClose   – called when the modal should close
 *   onSuccess – (message, type) callback → drives the parent toast
 *   activeTab – which of the 7 reports is currently displayed
 *   tabLabel  – human-readable tab name (e.g. "Stock on Hand")
 *   rows      – the raw JSON array fetched from Flask
 *   startDate – ISO date string used in filename / PDF subtitle
 *   endDate   – ISO date string used in filename / PDF subtitle
 * ──────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../../css/exportReports.module.css';

// ─── Tab key union (must match Reports.tsx) ────────────────────────────────────
export type TabKey =
  | 'stock-on-hand'
  | 'product-performance'
  | 'inventory-valuation'
  | 'stock-ageing'
  | 'reorder'
  | 'customer-sales';

export type ExportFormat = 'PDF' | 'Excel' | 'CSV';

export interface ExportReportsProps {
  isOpen:    boolean;
  onClose:   () => void;
  onSuccess: (message: string, type?: 'success' | 'error') => void;
  activeTab:  TabKey;
  tabLabel:   string;
  rows:       Record<string, unknown>[];
  startDate:  string;
  endDate:    string;
}

// ─── Brand constants ──────────────────────────────────────────────────────────
const BRAND_NAME    = 'AE Samonte Merchandise';
const BRAND_SUB     = 'ALAIN E. SAMONTE — Prop.  |  VAT Reg. TIN: 263-884-036-00000';
const HEADER_COLOR: [number, number, number] = [22, 65, 99];   // #164163
const ALT_ROW:      [number, number, number] = [248, 249, 250];

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN DEFINITIONS
// Each entry maps a TabKey → { headers[], rowMapper(row) → string[] }
// ─────────────────────────────────────────────────────────────────────────────

type RowMapper = (r: Record<string, unknown>) => (string | number | null)[];

interface ColDef {
  headers:   string[];
  mapRow:    RowMapper;
  filename:  string;
}

const fmt = {
  p: (v: unknown) => `PHP ${Number(v ?? 0).toFixed(2)}`,
  n: (v: unknown) => String(Number(v ?? 0)),
  f: (v: unknown, dp = 2) => Number(v ?? 0).toFixed(dp),
  s: (v: unknown) => String(v ?? '—'),
};

const COL_DEFS: Record<TabKey, ColDef> = {
  'stock-on-hand': {
    filename: 'stock_on_hand',
    headers:  ['SKU', 'Item Name', 'Brand', 'UOM', 'Qty on Hand', 'Unit Cost (PHP)', 'Selling Price (PHP)', 'Status'],
    mapRow: r => [
      fmt.s(r.sku), fmt.s(r.item_name), fmt.s(r.brand_name), fmt.s(r.uom),
      fmt.n(r.qty_on_hand), fmt.f(r.unit_cost), fmt.f(r.selling_price), fmt.s(r.stock_status),
    ],
  },
  'product-performance': {
    filename: 'product_performance',
    headers:  ['Item Name', 'Brand', 'SKU', 'UOM', 'Units Sold', 'Revenue (PHP)', 'COGS (PHP)', 'Gross Profit (PHP)', 'Margin (%)'],
    mapRow: r => [
      fmt.s(r.item_name), fmt.s(r.brand_name), fmt.s(r.sku), fmt.s(r.uom),
      fmt.n(r.units_sold), fmt.f(r.revenue), fmt.f(r.cogs), fmt.f(r.gross_profit), fmt.f(r.margin_pct),
    ],
  },
  'inventory-valuation': {
    filename: 'inventory_valuation',
    headers:  ['SKU', 'Item Name', 'Brand', 'UOM', 'Qty', 'Unit Cost (PHP)', 'Total Cost (PHP)', 'Selling Price (PHP)', 'Total Retail (PHP)', 'Potential Profit (PHP)'],
    mapRow: r => [
      fmt.s(r.sku), fmt.s(r.item_name), fmt.s(r.brand_name), fmt.s(r.uom), fmt.n(r.qty_on_hand),
      fmt.f(r.unit_cost), fmt.f(r.total_cost_value), fmt.f(r.selling_price),
      fmt.f(r.total_retail_value), fmt.f(r.potential_profit),
    ],
  },
  'stock-ageing': {
    filename: 'stock_ageing',
    headers:  ['SKU', 'Item Name', 'Brand', 'UOM', 'Qty on Hand', 'Last Sold Date', 'Days Since Last Sale', 'Ageing Status'],
    mapRow: r => [
      fmt.s(r.sku), fmt.s(r.item_name), fmt.s(r.brand_name), fmt.s(r.uom),
      fmt.n(r.qty_on_hand),
      r.last_sold_date ? String(r.last_sold_date) : 'Never',
      r.days_since_last_sale != null ? fmt.n(r.days_since_last_sale) : 'N/A',
      fmt.s(r.ageing_status),
    ],
  },
  'reorder': {
    filename: 'reorder_report',
    headers:  ['SKU', 'Item Name', 'Brand', 'UOM', 'Current Qty', 'Reorder Point', 'Min Order Qty', 'Lead Time (Days)', 'Suggested Order Qty', 'Primary Supplier', 'Contact'],
    mapRow: r => [
      fmt.s(r.sku), fmt.s(r.item_name), fmt.s(r.brand_name), fmt.s(r.uom),
      fmt.n(r.qty_on_hand), fmt.n(r.reorder_point), fmt.n(r.min_order_qty),
      fmt.n(r.lead_time_days), fmt.n(r.suggested_order_qty),
      fmt.s(r.primary_supplier), fmt.s(r.supplier_contact),
    ],
  },
  'customer-sales': {
    filename: 'customer_sales',
    headers:  ['Customer', 'Total Orders', 'Total Qty', 'Revenue (PHP)', 'COGS (PHP)', 'Profit (PHP)', 'Margin (%)', 'Avg Order Value (PHP)', 'Payment Methods'],
    mapRow: r => [
      fmt.s(r.customer_name), fmt.n(r.total_orders), fmt.n(r.total_qty),
      fmt.f(r.total_revenue), fmt.f(r.total_cogs), fmt.f(r.total_profit),
      fmt.f(r.margin_pct), fmt.f(r.avg_order_value), fmt.s(r.payment_methods),
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function exportCSV(
  tab:      TabKey,
  rows:     Record<string, unknown>[],
  tabLabel: string,
  dateRange: string,
  fileDate:  string,
) {
  const def  = COL_DEFS[tab];
  const body = [def.headers, ...rows.map(def.mapRow)];
  const meta = [
    [`Report: ${tabLabel}`],
    [`Period: ${dateRange}`],
    [`Generated: ${new Date().toLocaleString('en-PH')}`],
    [],
  ];
  const all  = [...meta, ...body];
  const csv  = all.map(row =>
    row.map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  ).join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${def.filename}_${fileDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT  (dynamic import — keeps bundle lean for users who don't export)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportExcel(
  tab:       TabKey,
  rows:      Record<string, unknown>[],
  tabLabel:  string,
  dateRange: string,
  fileDate:  string,
) {
  const XLSX = await import('xlsx');
  const def  = COL_DEFS[tab];

  const metaRows: (string | number | null)[][] = [
    [BRAND_NAME],
    [`Report: ${tabLabel}`],
    [`Period: ${dateRange}`],
    [`Generated: ${new Date().toLocaleString('en-PH')}`],
    [],
  ];

  const dataRows = rows.map(def.mapRow);
  const aoa      = [...metaRows, def.headers, ...dataRows];
  const ws       = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-fit column widths
  const widths = aoa.reduce<number[]>((acc, row) => {
    row.forEach((c, i) => { acc[i] = Math.max(acc[i] ?? 10, String(c ?? '').length + 2); });
    return acc;
  }, []);
  ws['!cols'] = widths.map(w => ({ wch: Math.min(w, 40) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tabLabel.slice(0, 31));
  XLSX.writeFile(wb, `${def.filename}_${fileDate}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF EXPORT  (dynamic import of jsPDF + jspdf-autotable)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportPDF(
  tab:       TabKey,
  rows:      Record<string, unknown>[],
  tabLabel:  string,
  dateRange: string,
  fileDate:  string,
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const def = COL_DEFS[tab];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();

  // ── Branded header ──
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, pw, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(BRAND_NAME, 14, 15);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(BRAND_SUB, 14, 22);
  // Report title block
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${tabLabel} Report`, 14, 48);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Period: ${dateRange}`, 14, 55);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 61);

  // ── Data table ──
  const body = rows.map(def.mapRow).map(r => r.map(v => String(v ?? '—')));

  autoTable(doc, {
    startY: 67,
    head:   [def.headers],
    body,
    headStyles: {
      fillColor:  HEADER_COLOR,
      textColor:  255,
      fontStyle:  'bold',
      fontSize:   7.5,
      halign:     'center',
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 0: { cellWidth: 'auto' } },
    margin: { left: 14, right: 14 },
    theme:  'grid',
    // Page number footer
    didDrawPage: (data) => {
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pw - 14,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'right' },
      );
    },
  });

  doc.save(`${def.filename}_${fileDate}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface DropdownProps<T extends string> {
  value:        T;
  options:      { id: T; label: string }[];
  open:         boolean;
  setOpen:      (v: boolean) => void;
  onChange:     (v: T) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  disabled?:    boolean;
}

function Dropdown<T extends string>({
  value, options, open, setOpen, onChange, containerRef, disabled = false,
}: DropdownProps<T>) {
  return (
    <div ref={containerRef} className={styles.dropdownContainer}>
      <button
        type="button"
        className={styles.dropdownTrigger}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{options.find(o => o.id === value)?.label ?? value}</span>
        <span className={`${styles.arrow} ${open ? styles.arrowUp : styles.arrowDown}`} />
      </button>
      {open && !disabled && (
        <div className={styles.dropdownList} role="listbox">
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={opt.id === value}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`${styles.dropdownItem} ${opt.id === value ? styles.dropdownItemActive : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT ICONS
// ─────────────────────────────────────────────────────────────────────────────

function FormatIcon({ format }: { format: ExportFormat }) {
  if (format === 'PDF') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
  if (format === 'Excel') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
    </svg>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL COMPONENT  (default export)
// ─────────────────────────────────────────────────────────────────────────────

export default function ExportReportsModal({
  isOpen, onClose, onSuccess,
  activeTab, tabLabel, rows,
  startDate, endDate,
}: ExportReportsProps) {
  const [format,      setFormat]      = useState<ExportFormat>('CSV');
  const [fmtOpen,     setFmtOpen]     = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fmtRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fmtRef.current && !fmtRef.current.contains(e.target as Node)) setFmtOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const hasData  = rows.length > 0;
  const fileDate = new Date().toISOString().slice(0, 10);
  const dateRange = startDate && endDate ? `${startDate} → ${endDate}` : 'Snapshot';

  const handleExport = useCallback(async () => {
    if (!hasData) { onSuccess('No data to export.', 'error'); return; }
    setIsExporting(true);
    try {
      if (format === 'CSV')   exportCSV(activeTab, rows, tabLabel, dateRange, fileDate);
      if (format === 'Excel') await exportExcel(activeTab, rows, tabLabel, dateRange, fileDate);
      if (format === 'PDF')   await exportPDF(activeTab, rows, tabLabel, dateRange, fileDate);
      onSuccess(`${tabLabel} exported as ${format} successfully!`, 'success');
      onClose();
    } catch (ex) {
      console.error('[ExportReportsModal] export failed:', ex);
      onSuccess('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [format, activeTab, rows, tabLabel, dateRange, fileDate, hasData, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Export report">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Close button */}
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        {/* Title */}
        <h2 className={styles.title}>Export Report</h2>

        {/* Which report */}
        <div className={styles.reportBadge}>
          <span className={styles.reportBadgeLabel}>Report</span>
          <span className={styles.reportBadgeName}>{tabLabel}</span>
          <span className={styles.reportBadgeCount}>{rows.length.toLocaleString()} row{rows.length !== 1 ? 's' : ''}</span>
        </div>

        {!hasData && (
          <p className={styles.noDataNote}>⚠ No data loaded. Please generate the report first.</p>
        )}

        {/* Format picker */}
        <p className={styles.label}>Export format</p>
        <div className={styles.formatGrid}>
          {(['CSV', 'Excel', 'PDF'] as ExportFormat[]).map(f => (
            <button
              key={f}
              type="button"
              className={`${styles.formatCard} ${format === f ? styles.formatCardActive : ''}`}
              onClick={() => setFormat(f)}
            >
              <span className={styles.formatIcon}><FormatIcon format={f} /></span>
              <span className={styles.formatLabel}>{f === 'Excel' ? 'Excel (.xlsx)' : f}</span>
              <span className={styles.formatDesc}>
                {f === 'CSV'   && 'Universal, lightweight'}
                {f === 'Excel' && 'Spreadsheet with auto-width'}
                {f === 'PDF'   && 'Branded, print-ready'}
              </span>
            </button>
          ))}
        </div>

        {/* Format dropdown — hidden, using cards above; keep for accessibility fallback */}
        <div style={{ display: 'none' }}>
          <Dropdown<ExportFormat>
            containerRef={fmtRef}
            value={format}
            options={[
              { id: 'CSV',   label: 'CSV' },
              { id: 'Excel', label: 'Excel (.xlsx)' },
              { id: 'PDF',   label: 'PDF' },
            ]}
            open={fmtOpen}
            setOpen={setFmtOpen}
            onChange={setFormat}
          />
        </div>

        {/* Period note */}
        {dateRange !== 'Snapshot' && (
          <p className={styles.periodNote}>Period: <strong>{dateRange}</strong></p>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={isExporting || !hasData}
          >
            {isExporting
              ? <><Spinner /> Exporting…</>
              : <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export as {format}
                </>
            }
          </button>
        </div>

      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         style={{ marginRight: 6, animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}