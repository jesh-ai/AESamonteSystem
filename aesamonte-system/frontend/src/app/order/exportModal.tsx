'use client';

import React, { useState } from 'react';
import styles from "@/css/inventory.module.css";
import { exportPDF, exportExcel, exportCSV } from '@/utils/exportUtils';

interface Order {
  id: number; customer: string; address: string; date: string;
  totalQty: number; totalAmount: number; paymentMethod: string; status: string;
}
interface OrderSummary {
  shippedToday: { current: number; total: number };
  cancelled: { current: number };
  totalOrders: { count: number };
}
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string, type?: 'success' | 'error') => void;
  data: Order[];
  summary: OrderSummary;
}

const COLUMNS = [
  { header: 'ID',             key: 'id' },
  { header: 'Customer',       key: 'customer' },
  { header: 'Address',        key: 'address' },
  { header: 'Date',           key: 'date' },
  { header: 'Qty',            key: 'totalQty' },
  { header: 'Total Amount',   key: 'totalAmount' },
  { header: 'Payment Method', key: 'paymentMethod' },
  { header: 'Status',         key: 'status' },
];

const OrderExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onSuccess, data, summary }) => {
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
        { label: 'Shipped Today',    value: `${summary.shippedToday.current} / ${summary.shippedToday.total}` },
        { label: 'Orders Cancelled', value: summary.cancelled.current.toLocaleString() },
        { label: 'Total Orders',     value: summary.totalOrders.count.toLocaleString() },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = data.map(o => ({ ...o }) as Record<string, any>);

      if (format === 'PDF')        await exportPDF('Orders Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Orders');
      else if (format === 'Excel') await exportExcel('Orders Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Orders');
      else if (format === 'CSV')   exportCSV('Orders Report', summaryItems, COLUMNS, rows, 'AE_Samonte_Orders');

      onSuccess(`Orders Report downloaded as ${format}!`, 'success');
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

export default OrderExportModal;
