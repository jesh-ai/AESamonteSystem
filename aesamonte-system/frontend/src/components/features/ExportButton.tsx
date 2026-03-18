'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LuUpload } from "react-icons/lu";
import styles from "@/css/reports.module.css";

interface ExportButtonProps {
  onSelect?: (type: 'pdf' | 'xlsx' | 'csv') => void;
}

export default function ExportButton({ onSelect }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (type: 'pdf' | 'xlsx' | 'csv') => {
    setOpen(false);
    onSelect?.(type);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className={styles.exportBtn} onClick={() => setOpen(prev => !prev)}>
        <LuUpload /> Export
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: '#fff',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          minWidth: '170px',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {[
            { label: 'Export as .pdf',  type: 'pdf'  as const },
            { label: 'Export as .xlsx', type: 'xlsx' as const },
            { label: 'Export as .csv',  type: 'csv'  as const },
          ].map((item, i) => (
            <button
              key={item.type}
              onClick={() => handleSelect(item.type)}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: '#fff',        
                color: '#',          
                fontWeight: 400,           
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#1a4263';
                (e.currentTarget as HTMLButtonElement).style.color = '#fff';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                (e.currentTarget as HTMLButtonElement).style.color = '#1e293b';
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}