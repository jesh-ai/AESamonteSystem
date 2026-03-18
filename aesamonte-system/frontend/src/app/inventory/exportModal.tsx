/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import styles from "@/css/inventory.module.css";
import { exportPDF, exportExcel, exportCSV } from '@/utils/exportUtils';

interface Product {
  id: string; item_name: string; item_description: string;
  qty: number; uom: string; status: string;
  brands?: { brand_name: string; sku: string; unit_price: number; selling_price: number; qty: number }[];
  suppliers?: { supplier_name: string }[];
}

interface InventorySummary {
  totalProducts: number; totalProductsChange: number;
  weeklyInventory: number; monthlyInventory: number; yearlyInventory: number;
  outOfStockCount: number;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string, type?: 'success' | 'error') => void;
  data: Product[];
  summary: InventorySummary; // ── ADDED: was missing ──
  exportType?: 'pdf' | 'xlsx' | 'csv' | null;
}

const COLUMNS = [
  { header: 'ID',          key: 'id' },
  { header: 'Item Name',   key: 'item_name' },
  { header: 'Description', key: 'item_description' },
  { header: 'Total Qty',   key: 'qty' },
  { header: 'UOM',         key: 'uom' },
  { header: 'Brands',      key: 'brands_summary' },
  { header: 'Suppliers',   key: 'suppliers_summary' },
  { header: 'Status',      key: 'status' },
];

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onSuccess, data, summary, exportType }) => {
  const [format, setFormat] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const s = styles as Record<string, string>;

  const getRows = () => data.map(p => ({
    ...p,
    brands_summary: (p.brands || []).map(b => b.brand_name === 'No Brand' ? '—' : b.brand_name).join(', ') || '—',
    suppliers_summary: (p.suppliers || []).map(s => s.supplier_name).join(', ') || '—',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as Record<string, any>);

  const getSummaryItems = () => [
    { label: 'Total Products',    value: summary.totalProducts.toLocaleString() },
    { label: 'vs Last Month',     value: `+${summary.totalProductsChange}%` },
    { label: 'Weekly Inventory',  value: summary.weeklyInventory.toLocaleString() },
    { label: 'Monthly Inventory', value: summary.monthlyInventory.toLocaleString() },
    { label: 'Yearly Inventory',  value: summary.yearlyInventory.toLocaleString() },
    { label: 'Out of Stock',      value: summary.outOfStockCount.toLocaleString() },
  ];

  // ── Auto-trigger export when exportType is passed from dropdown ──
  useEffect(() => {
    if (!isOpen || !exportType) return;

    const runExport = async () => {
      setLoading(true);
      try {
        const rows = getRows();
        const summaryItems = getSummaryItems();

        if (exportType === 'pdf')       await exportPDF('Inventory Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Inventory');
        else if (exportType === 'xlsx') await exportExcel('Inventory Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Inventory');
        else if (exportType === 'csv')  exportCSV('Inventory Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Inventory');

        onSuccess(`Inventory Report downloaded as ${exportType.toUpperCase()}!`, 'success');
      } catch (err) {
        console.error(err);
        onSuccess('Export failed. Please try again.', 'error');
      } finally {
        setLoading(false);
        onClose();
      }
    };

    runExport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, exportType]);

  // If exportType passed from dropdown, don't show modal UI — run silently
  if (!isOpen) return null;
  if (exportType) return null;

  const handleExportClick = async () => {
    if (!format) { onSuccess('Please select a format before exporting.', 'error'); return; }
    setLoading(true);
    try {
      const rows = getRows();
      const summaryItems = getSummaryItems();

      if (format === 'PDF')        await exportPDF('Inventory Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Inventory');
      else if (format === 'Excel') await exportExcel('Inventory Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Inventory');
      else if (format === 'CSV')   exportCSV('Inventory Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Inventory');

      onSuccess(`Inventory Report downloaded as ${format}!`, 'success');
      setFormat(''); onClose();
    } catch (err) {
      console.error(err);
      onSuccess('Export failed. Please try again.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className={s.modalOverlay}>
      <div className={s.exportModalContainer}>
        <button onClick={onClose} className={s.closeButton}>✕</button>
        <h2 className={s.modalTitleLarge}>Export</h2>
        <div className={s.exportFormGroup}>
          <label className={s.labelMedium}>Export as:</label>
          <div className={s.selectWrapper}>
            <select
              value={format}
              onChange={e => { setFormat(e.target.value); setIsDropdownOpen(false); }}
              className={s.exportSelect}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              onBlur={() => setIsDropdownOpen(false)}
            >
              <option value="" disabled>Select</option>
              <option value="PDF">PDF</option>
              <option value="Excel">Excel</option>
              <option value="CSV">CSV</option>
            </select>
            <div className={`${s.selectArrow} ${isDropdownOpen ? s.arrowUp : ''}`}>
              <span>{isDropdownOpen ? '▲' : '▼'}</span>
            </div>
          </div>
        </div>
        <div className={s.modalFooterRight}>
          <button onClick={handleExportClick} className={s.exportConfirmBtn} disabled={loading}>
            {loading ? 'Exporting...' : 'EXPORT'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;