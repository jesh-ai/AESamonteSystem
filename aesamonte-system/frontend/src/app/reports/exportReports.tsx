'use client';

import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from '../../css/exportReports.module.css';

/* ================= TYPES ================= */

interface SalesReportData {
  weekly: number;
  monthly: number;
  yearly: number;
}

interface InventoryReportData {
  weekly: number;
  monthly: number;
  yearly: number;
}

interface ExtraReportData {
  totals: {
    orders: number;
    ordersGrowth: number;
    sales: number;
    salesGrowth: number;
  };
  topClients: {
    name: string;
    orders: number;
    percentage: number;
  }[];
  mostStock: {
    name: string;
    qty: number;
    percentage: number;
  }[];
  yearlyHistory: {
    year: number;
    sales: number;
    percentage: number;
  }[];
}

interface ExportReportsProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string, type?: 'success' | 'error') => void;
  salesData: SalesReportData | null;
  inventoryData: InventoryReportData | null;
  extraData: ExtraReportData | null;
}

type ExportFormat = 'PDF' | 'Excel' | 'CSV';

type SectionId =
  | 'all'
  | 'overview'
  | 'sales'
  | 'inventory'
  | 'clients'
  | 'stock'
  | 'yearly';

interface Section {
  id: SectionId;
  label: string;
}

const SECTIONS: Section[] = [
  { id: 'all',       label: 'All Data'             },
  { id: 'overview',  label: 'Overview (Totals)'    },
  { id: 'sales',     label: 'Sales Report'         },
  { id: 'inventory', label: 'Inventory Report'     },
  { id: 'clients',   label: 'Top Clients Ordered'  },
  { id: 'stock',     label: 'Most Stock Items'     },
  { id: 'yearly',    label: 'Yearly Sales History' },
];

/* ─────────────────────────────────────────
   PDF CONSTANTS
───────────────────────────────────────── */
const HEADER_BG: [number, number, number] = [30, 58, 95];
const TABLE_HDR: [number, number, number] = [30, 58, 95];
const TABLE_ALT: [number, number, number] = [248, 249, 250];
const LABEL_CLR: [number, number, number] = [55, 65, 81];
const DATE_STR  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const FILE_DATE = new Date().toISOString().slice(0, 10);

// Bar chart colours matching the UI
const CLIENT_COLORS: [number, number, number][] = [
  [30, 58, 95],    // navy  #1e3a5f
  [239, 68, 68],   // red   #ef4444
  [250, 204, 21],  // yellow #facc15
];

/* ─────────────────────────────────────────
   PDF HELPERS
───────────────────────────────────────── */
function addPDFHeader(doc: jsPDF, subtitle: string): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, pw, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AE Samonte Merchandise', 14, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ALAIN E. SAMONTE - Prop.  |  VAT Reg. TIN: 263-884-036-00000', 14, 22);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(subtitle, 14, 46);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${DATE_STR}`, 14, 53);
  return 62;
}

function sectionTitle(doc: jsPDF, label: string, y: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...LABEL_CLR);
  doc.text(label.toUpperCase(), 14, y);
  doc.setDrawColor(220, 220, 220);
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2);
  return y + 9;
}

/** Truncate label to fit in a fixed pixel width */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

/* ─────────────────────────────────────────
   PDF TABLE SECTIONS
───────────────────────────────────────── */
function addOverview(doc: jsPDF, extra: ExtraReportData, startY: number): number {
  const y = sectionTitle(doc, 'Overview', startY);
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total Orders',                  extra.totals.orders.toLocaleString()],
      ['Orders Growth (vs last month)', `${extra.totals.ordersGrowth >= 0 ? '+' : ''}${extra.totals.ordersGrowth}%`],
      ['Total Sales',                   `PHP ${extra.totals.sales.toLocaleString()}`],
      ['Sales Growth (vs last month)',  `${extra.totals.salesGrowth >= 0 ? '+' : ''}${extra.totals.salesGrowth}%`],
    ],
    headStyles:         { fillColor: TABLE_HDR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: TABLE_ALT },
    bodyStyles:         { fontSize: 9 },
    columnStyles:       { 0: { cellWidth: 80, fontStyle: 'bold', fillColor: [243, 244, 246] as [number, number, number] } },
    margin:             { left: 14, right: 14 },
    theme:              'grid',
  });
  return (doc as any).lastAutoTable.finalY + 10;
}

function addSales(doc: jsPDF, sales: SalesReportData, startY: number): number {
  const y = sectionTitle(doc, 'Sales Report', startY);
  autoTable(doc, {
    startY: y,
    head: [['Period', 'Sales']],
    body: [
      ['Weekly',  sales.weekly.toLocaleString()],
      ['Monthly', sales.monthly.toLocaleString()],
      ['Yearly',  sales.yearly.toLocaleString()],
    ],
    headStyles:         { fillColor: TABLE_HDR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: TABLE_ALT },
    bodyStyles:         { fontSize: 9 },
    columnStyles:       { 0: { cellWidth: 80, fontStyle: 'bold', fillColor: [243, 244, 246] as [number, number, number] } },
    margin:             { left: 14, right: 14 },
    theme:              'grid',
  });
  return (doc as any).lastAutoTable.finalY + 10;
}

function addInventory(doc: jsPDF, inv: InventoryReportData, startY: number): number {
  const y = sectionTitle(doc, 'Inventory Report', startY);
  autoTable(doc, {
    startY: y,
    head: [['Period', 'Inventory']],
    body: [
      ['Weekly',  inv.weekly.toLocaleString()],
      ['Monthly', inv.monthly.toLocaleString()],
      ['Yearly',  inv.yearly.toLocaleString()],
    ],
    headStyles:         { fillColor: TABLE_HDR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: TABLE_ALT },
    bodyStyles:         { fontSize: 9 },
    columnStyles:       { 0: { cellWidth: 80, fontStyle: 'bold', fillColor: [243, 244, 246] as [number, number, number] } },
    margin:             { left: 14, right: 14 },
    theme:              'grid',
  });
  return (doc as any).lastAutoTable.finalY + 10;
}

/* ─────────────────────────────────────────
   PDF CHART SECTIONS  (visual bars)
───────────────────────────────────────── */

/**
 * Draws horizontal bar chart for Top Clients.
 * Each bar is drawn as a filled rectangle using the same 3 colours as the UI.
 */
function addClientsChart(doc: jsPDF, extra: ExtraReportData, startY: number): number {
  let y = sectionTitle(doc, 'Top Clients Ordered', startY);

  if (!extra.topClients.length) {
    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text('No data available.', 14, y + 6);
    return y + 16;
  }

  const pw       = doc.internal.pageSize.getWidth();
  const labelW   = 38;   // mm reserved for the name label
  const valueW   = 12;   // mm reserved for the count on the right
  const margin   = 14;
  const trackW   = pw - margin * 2 - labelW - valueW - 4;
  const barH     = 7;
  const rowGap   = 13;
  const maxOrders = Math.max(...extra.topClients.map(c => c.orders));

  extra.topClients.forEach((client, i) => {
    const barY   = y + i * rowGap;
    const fillW  = maxOrders > 0 ? (client.orders / maxOrders) * trackW : 0;
    const color  = CLIENT_COLORS[i % CLIENT_COLORS.length];

    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(truncate(client.name, 18), margin, barY + barH - 1);

    // Track (background)
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + labelW, barY, trackW, barH, 2, 2, 'F');

    // Fill (coloured bar)
    if (fillW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(margin + labelW, barY, fillW, barH, 2, 2, 'F');
    }

    // Value
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(String(client.orders), pw - margin, barY + barH - 1, { align: 'right' });
  });

  // Axis labels
  y += extra.topClients.length * rowGap + 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const axisX = margin + labelW;
  doc.text('0', axisX, y);
  doc.text(String(Math.ceil(maxOrders * 0.25)), axisX + trackW * 0.25, y, { align: 'center' });
  doc.text(String(Math.ceil(maxOrders * 0.5)),  axisX + trackW * 0.5,  y, { align: 'center' });
  doc.text(String(Math.ceil(maxOrders * 0.75)), axisX + trackW * 0.75, y, { align: 'center' });
  doc.text(String(maxOrders), axisX + trackW, y, { align: 'right' });

  return y + 10;
}

/**
 * Draws horizontal bar chart for Most Stock Items.
 * All bars use the same navy colour (#1e3a5f) matching the UI.
 */
function addStockChart(doc: jsPDF, extra: ExtraReportData, startY: number): number {
  let y = sectionTitle(doc, 'Most Stock Items', startY);

  if (!extra.mostStock.length) {
    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text('No data available.', 14, y + 6);
    return y + 16;
  }

  const pw      = doc.internal.pageSize.getWidth();
  const labelW  = 38;
  const valueW  = 14;
  const margin  = 14;
  const trackW  = pw - margin * 2 - labelW - valueW - 4;
  const barH    = 5;
  const rowGap  = 11;

  extra.mostStock.forEach((item, i) => {
    const barY  = y + i * rowGap;
    const fillW = (item.percentage / 100) * trackW;

    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(truncate(item.name, 18), margin, barY + barH - 0.5);

    // Track
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + labelW, barY, trackW, barH, 1.5, 1.5, 'F');

    // Fill — navy
    if (fillW > 0) {
      doc.setFillColor(30, 58, 95);
      doc.roundedRect(margin + labelW, barY, fillW, barH, 1.5, 1.5, 'F');
    }

    // Percentage value
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`${Math.round(item.percentage)}%`, pw - margin, barY + barH - 0.5, { align: 'right' });
  });

  return y + extra.mostStock.length * rowGap + 8;
}

/**
 * Draws horizontal bar chart for Yearly Sales.
 * All bars use blue (#3b82f6) matching the UI.
 */
function addYearlyChart(doc: jsPDF, extra: ExtraReportData, startY: number): number {
  let y = sectionTitle(doc, 'Yearly Sales History', startY);

  if (!extra.yearlyHistory.length) {
    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text('No sales history available.', 14, y + 6);
    return y + 16;
  }

  const pw      = doc.internal.pageSize.getWidth();
  const labelW  = 14;
  const valueW  = 26;
  const margin  = 14;
  const trackW  = pw - margin * 2 - labelW - valueW - 4;
  const barH    = 5;
  const rowGap  = 11;

  extra.yearlyHistory.forEach((item, i) => {
    const barY  = y + i * rowGap;
    const fillW = (item.percentage / 100) * trackW;

    // Year label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(String(item.year), margin, barY + barH - 0.5);

    // Track
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + labelW, barY, trackW, barH, 1.5, 1.5, 'F');

    // Fill — blue
    if (fillW > 0) {
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(margin + labelW, barY, fillW, barH, 1.5, 1.5, 'F');
    }

    // Sales value
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text(item.sales.toLocaleString(), pw - margin, barY + barH - 0.5, { align: 'right' });
  });

  return y + extra.yearlyHistory.length * rowGap + 8;
}

/* ─────────────────────────────────────────
   MAIN PDF EXPORT
───────────────────────────────────────── */
function exportPDF(section: SectionId, sales: SalesReportData, inv: InventoryReportData, extra: ExtraReportData) {
  const subtitle = section === 'all' ? 'Reports Summary' : (SECTIONS.find(s => s.id === section)?.label ?? 'Reports');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = addPDFHeader(doc, subtitle);

  // Check if we need a new page before adding a section
  const checkPage = (neededHeight: number) => {
    const ph = doc.internal.pageSize.getHeight();
    if (y + neededHeight > ph - 20) {
      doc.addPage();
      y = 16;
    }
  };

  if (section === 'all' || section === 'overview')  { checkPage(50);  y = addOverview(doc, extra, y); }
  if (section === 'all' || section === 'sales')     { checkPage(40);  y = addSales(doc, sales, y); }
  if (section === 'all' || section === 'inventory') { checkPage(40);  y = addInventory(doc, inv, y); }
  if (section === 'all' || section === 'clients')   { checkPage(60);  y = addClientsChart(doc, extra, y); }
  if (section === 'all' || section === 'stock')     { checkPage(50);  y = addStockChart(doc, extra, y); }
  if (section === 'all' || section === 'yearly')    { checkPage(50);  y = addYearlyChart(doc, extra, y); }

  doc.save(`reports_${section}_${FILE_DATE}.pdf`);
}

/* ─────────────────────────────────────────
   EXCEL EXPORT
───────────────────────────────────────── */
async function exportExcel(section: SectionId, sales: SalesReportData, inv: InventoryReportData, extra: ExtraReportData) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const addSheet = (name: string, rows: (string | number)[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const widths = rows.reduce<number[]>((acc, row) => {
      row.forEach((c, i) => { acc[i] = Math.max(acc[i] ?? 10, String(c ?? '').length + 2); });
      return acc;
    }, []);
    ws['!cols'] = widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  if (section === 'all' || section === 'overview')
    addSheet('Overview', [['Metric', 'Value'], ['Total Orders', extra.totals.orders],
      ['Orders Growth (%)', extra.totals.ordersGrowth], ['Total Sales (PHP)', extra.totals.sales],
      ['Sales Growth (%)', extra.totals.salesGrowth]]);
  if (section === 'all' || section === 'sales')
    addSheet('Sales Report', [['Period', 'Sales'],
      ['Weekly', sales.weekly], ['Monthly', sales.monthly], ['Yearly', sales.yearly]]);
  if (section === 'all' || section === 'inventory')
    addSheet('Inventory Report', [['Period', 'Inventory'],
      ['Weekly', inv.weekly], ['Monthly', inv.monthly], ['Yearly', inv.yearly]]);
  if (section === 'all' || section === 'clients')
    addSheet('Top Clients', [['Client Name', 'Orders', 'Percentage (%)'],
      ...extra.topClients.map(c => [c.name, c.orders, c.percentage])]);
  if (section === 'all' || section === 'stock')
    addSheet('Most Stock Items', [['Item Name', 'Quantity', 'Percentage (%)'],
      ...extra.mostStock.map(s => [s.name, s.qty, s.percentage])]);
  if (section === 'all' || section === 'yearly')
    addSheet('Yearly Sales', [['Year', 'Sales', 'Percentage (%)'],
      ...extra.yearlyHistory.map(yr => [yr.year, yr.sales, yr.percentage])]);
  XLSX.writeFile(wb, `reports_${section}_${FILE_DATE}.xlsx`);
}

/* ─────────────────────────────────────────
   CSV EXPORT
───────────────────────────────────────── */
function exportCSV(section: SectionId, sales: SalesReportData, inv: InventoryReportData, extra: ExtraReportData) {
  const all: (string | number)[][] = [];
  const push = (rows: (string | number)[][]) => { all.push(...rows, []); };
  if (section === 'all' || section === 'overview')
    push([['=== OVERVIEW ==='], ['Metric', 'Value'], ['Total Orders', extra.totals.orders],
      ['Orders Growth (%)', extra.totals.ordersGrowth], ['Total Sales (PHP)', extra.totals.sales],
      ['Sales Growth (%)', extra.totals.salesGrowth]]);
  if (section === 'all' || section === 'sales')
    push([['=== SALES REPORT ==='], ['Period', 'Sales'],
      ['Weekly', sales.weekly], ['Monthly', sales.monthly], ['Yearly', sales.yearly]]);
  if (section === 'all' || section === 'inventory')
    push([['=== INVENTORY REPORT ==='], ['Period', 'Inventory'],
      ['Weekly', inv.weekly], ['Monthly', inv.monthly], ['Yearly', inv.yearly]]);
  if (section === 'all' || section === 'clients')
    push([['=== TOP CLIENTS ORDERED ==='], ['Client Name', 'Orders', 'Percentage (%)'],
      ...extra.topClients.map(c => [c.name, c.orders, c.percentage])]);
  if (section === 'all' || section === 'stock')
    push([['=== MOST STOCK ITEMS ==='], ['Item Name', 'Quantity', 'Percentage (%)'],
      ...extra.mostStock.map(s => [s.name, s.qty, s.percentage])]);
  if (section === 'all' || section === 'yearly')
    push([['=== YEARLY SALES HISTORY ==='], ['Year', 'Sales (PHP)', 'Percentage (%)'],
      ...extra.yearlyHistory.map(yr => [yr.year, yr.sales, yr.percentage])]);
  const csv = all.map(row => row.map(c => {
    const v = String(c ?? '');
    return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `reports_${section}_${FILE_DATE}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────
   REUSABLE DROPDOWN
───────────────────────────────────────── */
interface DropdownProps<T extends string> {
  value: T;
  options: { id: T; label: string }[];
  open: boolean;
  setOpen: (v: boolean) => void;
  onChange: (v: T) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function Dropdown<T extends string>({ value, options, open, setOpen, onChange, containerRef }: DropdownProps<T>) {
  return (
    <div ref={containerRef} className={styles.dropdownContainer}>
      <button className={styles.dropdownTrigger} onClick={() => setOpen(!open)}>
        <span>{options.find(o => o.id === value)?.label ?? value}</span>
        <span className={`${styles.arrow} ${open ? styles.arrowUp : styles.arrowDown}`} />
      </button>
      {open && (
        <div className={styles.dropdownList}>
          {options.map(opt => (
            <button
              key={opt.id}
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

/* ─────────────────────────────────────────
   MODAL COMPONENT
───────────────────────────────────────── */
export default function ExportReportsModal({
  isOpen, onClose, onSuccess,
  salesData, inventoryData, extraData,
}: ExportReportsProps) {
  const [format,      setFormat]      = useState<ExportFormat>('PDF');
  const [section,     setSection]     = useState<SectionId>('all');
  const [fmtOpen,     setFmtOpen]     = useState(false);
  const [secOpen,     setSecOpen]     = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fmtRef = useRef<HTMLDivElement>(null);
  const secRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fmtRef.current && !fmtRef.current.contains(e.target as Node)) setFmtOpen(false);
      if (secRef.current && !secRef.current.contains(e.target as Node)) setSecOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isOpen) return null;

  const hasData = !!(salesData && inventoryData && extraData);

  const handleExport = async () => {
    if (!hasData) { onSuccess('No report data available to export.', 'error'); return; }
    setIsExporting(true);
    try {
      const s = salesData!; const v = inventoryData!; const x = extraData!;
      if (format === 'PDF')        exportPDF(section, s, v, x);
      else if (format === 'Excel') await exportExcel(section, s, v, x);
      else                         exportCSV(section, s, v, x);
      const sLabel = SECTIONS.find(sc => sc.id === section)?.label ?? 'Reports';
      onSuccess(`${sLabel} exported as ${format} successfully!`, 'success');
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      onSuccess('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose}>×</button>
        <h2 className={styles.title}>Export</h2>

        <p className={styles.label}>Export as:</p>
        <div className={styles.dropdownWrap}>
          <Dropdown<ExportFormat>
            containerRef={fmtRef}
            value={format}
            options={[
              { id: 'PDF',   label: 'PDF'          },
              { id: 'Excel', label: 'Excel (.xlsx)' },
              { id: 'CSV',   label: 'CSV'           },
            ]}
            open={fmtOpen}
            setOpen={setFmtOpen}
            onChange={setFormat}
          />
        </div>

        <p className={styles.label}>Data to export:</p>
        <div className={styles.dropdownWrapLast}>
          <Dropdown<SectionId>
            containerRef={secRef}
            value={section}
            options={SECTIONS}
            open={secOpen}
            setOpen={setSecOpen}
            onChange={setSection}
          />
        </div>

        <div className={styles.footer}>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={isExporting || !hasData}
          >
            {isExporting ? 'EXPORTING…' : 'EXPORT'}
          </button>
        </div>

      </div>
    </div>
  );
}