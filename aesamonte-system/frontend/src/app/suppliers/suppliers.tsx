'use client';

import React, { useState, useEffect } from 'react';
import styles from "@/css/suppliers.module.css";
import TopHeader from '@/components/layout/TopHeader';
import {
  LuSearch,
  LuEllipsisVertical,
  LuChevronUp,
  LuChevronDown,
  LuPencil,
  LuArchive,
  LuChevronRight
} from "react-icons/lu";

/* ================= TYPES ================= */
interface SuppliersProps {
  role: string;
  onLogout: () => void;
}

interface Supplier {
  id: number;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
}

/* ================= COMPONENT ================= */
const Suppliers = ({ role, onLogout }: SuppliersProps) => {
  const s = styles as Record<string, string>;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Supplier | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5000/api/suppliers');
        const data = await res.json();
        setSuppliers(data);
      } catch (err) {
        console.error("Failed to fetch suppliers", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  /* ================= FILTER & SORT ================= */
  const filteredSuppliers = suppliers.filter(s =>
    `${s.supplierName} ${s.contactPerson} ${s.contactNumber} ${s.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: keyof Supplier, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  };

  if (isLoading) return <div className={s.loadingContainer}>Loading Suppliers...</div>;

  /* ================= UI ================= */
  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.tableContainer}>

          {/* HEADER */}
          <div className={s.header}>
            <h1 className={s.title}>Suppliers</h1>
            <div className={s.controls}>
              <button className={s.archiveIconBtn}><LuArchive size={20} /></button>
              <div className={s.searchWrapper}>
                <input
                  className={s.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <LuSearch size={18} />
              </div>
              <button className={s.addButton}>ADD</button>
            </div>
          </div>

          {/* TABLE */}
          <table className={s.table}>
            <thead>
              <tr>
                {[
                  { label: 'SUPPLIER NAME', key: 'supplierName' },
                  { label: 'CONTACT PERSON', key: 'contactPerson' },
                  { label: 'CONTACT NUMBER', key: 'contactNumber' },
                  { label: 'EMAIL', key: 'email' },
                  { label: 'ADDRESS', key: 'address' }
                ].map(col => (
                  <th key={col.key}>
                    <span>{col.label}</span>
                    <LuChevronUp onClick={() => requestSort(col.key as keyof Supplier, 'asc')} />
                    <LuChevronDown onClick={() => requestSort(col.key as keyof Supplier, 'desc')} />
                  </th>
                ))}
                <th className={s.actionHeader}>Action</th>
              </tr>
            </thead>

            <tbody>
              {sortedSuppliers.length ? (
                sortedSuppliers.map((sup, i) => (
                  <tr key={sup.id} className={i % 2 !== 0 ? s.rowOdd : ''}>
                    <td>{sup.supplierName}</td>
                    <td>{sup.contactPerson}</td>
                    <td>{sup.contactNumber}</td>
                    <td>{sup.email}</td>
                    <td>{sup.address}</td>
                    <td className={s.actionCell}>
                      <LuEllipsisVertical
                        onClick={() => setOpenMenuId(openMenuId === sup.id ? null : sup.id)}
                      />
                      {openMenuId === sup.id && (
                        <div className={s.popupMenu}>
                          <button className={s.popBtnEdit}><LuPencil size={14}/> Edit</button>
                          <button className={s.popBtnArchive}><LuArchive size={14}/> Archive</button>
                          <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                    No suppliers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* FOOTER */}
          <div className={s.footer}>
            Showing {sortedSuppliers.length} of {suppliers.length}
            <div className={s.pagination}>
              <button className={s.pageCircleActive}>1</button>
              <button className={s.nextBtn}>
                Next <LuChevronRight size={18} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Suppliers;
