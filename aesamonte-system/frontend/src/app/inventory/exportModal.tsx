'use client';

import React, { useState } from 'react';
import styles from "@/css/inventory.module.css"; 

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [format, setFormat] = useState("");
  // Changed to isDropdownOpen for clearer intent
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const s = styles as Record<string, string>;

  if (!isOpen) return null;

  const handleExportClick = () => {
    if (!format) {
      alert("Please select a format");
      return;
    }
    console.log(`Downloading ${format} file...`);
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
                setIsDropdownOpen(false); // Close arrow on selection
              }}
              className={s.exportSelect}
              // Toggle state on click
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              // Ensure it closes if user clicks outside
              onBlur={() => setIsDropdownOpen(false)}
            >
              <option value="" disabled>Select</option>
              <option value="PDF">PDF</option>
              <option value="Excel">Excel</option>
              <option value="CSV">CSV</option>
            </select>
            
            {/* Using a separate span for the arrow to ensure it renders correctly */}
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

export default ExportModal;