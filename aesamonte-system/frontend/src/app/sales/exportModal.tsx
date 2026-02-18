'use client';

import React, { useState } from 'react';
import s from "@/css/sales.module.css"; // Reusing the established styles

interface SalesExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SalesExportModal: React.FC<SalesExportModalProps> = ({ isOpen, onClose }) => {
  const [format, setFormat] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!isOpen) return null;

  const handleExportClick = () => {
    if (!format) {
      alert("Please select a format");
      return;
    }
    console.log(`Exporting Sales Report as ${format}...`);
    onClose(); 
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
              onChange={(e) => {
                setFormat(e.target.value);
                setIsDropdownOpen(false); 
              }}
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
          <button onClick={handleExportClick} className={s.exportConfirmBtn}>
            EXPORT
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesExportModal;