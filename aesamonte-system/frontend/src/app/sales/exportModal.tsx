'use client';

import React, { useState } from 'react';
import styles from "@/css/inventory.module.css";
import { exportPDF, exportExcel, exportCSV } from '@/utils/exportUtils';

interface Transaction {
  no: string; name: string; address: string; date: string;
  qty: number; amount: number; paymentMethod: string; status: string;
}
interface SalesSummary {
  totalSales: number; totalSalesChange: number;
  weeklySales: number; monthlySales: number; yearlySales: number;
  topClientName: string; topClientSales: number; topClientChange: number;
}
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string, type?: 'success' | 'error') => void;
  data: Transaction[];
  summary: SalesSummary;
}

const COLUMNS = [
  { header: 'No.',            key: 'no' },
  { header: 'Name',           key: 'name' },
  { header: 'Address',        key: 'address' },
  { header: 'Date',           key: 'date' },
  { header: 'Qty',            key: 'qty' },
  { header: 'Amount',         key: 'amount' },
  { header: 'Payment Method', key: 'paymentMethod' },
  { header: 'Status',         key: 'status' },
];

const SalesExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onSuccess, data, summary }) => {
  const [format, setFormat] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const s = styles as Record<string, string>;

  if (!isOpen) return null;

  const handleExportClick = async () => {
    if (!format) { onSuccess('Please select a format before exporting.', 'error'); return; }
    setLoading(true);
    try {
      const summaryItems = [
        { label: 'Total Sales',       value: `PHP ${summary.totalSales.toLocaleString()}` },
        { label: 'vs Last Month',     value: `+${summary.totalSalesChange}%` },
        { label: 'Weekly Sales',      value: `PHP ${summary.weeklySales.toLocaleString()}` },
        { label: 'Monthly Sales',     value: `PHP ${summary.monthlySales.toLocaleString()}` },
        { label: 'Yearly Sales',      value: `PHP ${summary.yearlySales.toLocaleString()}` },
        { label: 'Top Client',        value: summary.topClientName },
        { label: 'Top Client Sales',  value: `PHP ${summary.topClientSales.toLocaleString()}` },
        { label: 'Top Client Growth', value: `+${summary.topClientChange}%` },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = data.map(tx => ({ ...tx }) as Record<string, any>);

      if (format === 'PDF')        await exportPDF('Sales Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Sales');
      else if (format === 'Excel') await exportExcel('Sales Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Sales');
      else if (format === 'CSV')   exportCSV('Sales Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Sales');

      onSuccess(`Sales Report downloaded as ${format}!`, 'success');
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
            <select value={format} onChange={e => { setFormat(e.target.value); setIsDropdownOpen(false); }}
              className={s.exportSelect} onClick={() => setIsDropdownOpen(!isDropdownOpen)} onBlur={() => setIsDropdownOpen(false)}>
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

export default SalesExportModal;
