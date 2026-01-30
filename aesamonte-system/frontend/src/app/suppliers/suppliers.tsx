'use client';

import React, { useState, useEffect } from 'react';
import styles from "@/css/suppliers.module.css";
import TopHeader from '@/components/layout/TopHeader'
import { 
  LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown, 
  LuPencil, LuArchive, LuDownload, LuChevronRight
} from "react-icons/lu";

interface SuppliersProps {
  role: string;
  onLogout: () => void;
}

interface Supplier {
  id: string;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  costPrice: number;
  leadTime: number;
  moq: number;
}

const Suppliers = ({ role, onLogout }: SuppliersProps) => {
  const s = styles as Record<string, string>;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  // Fetch logic
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setIsLoading(true);
        // API endpoint
        const response = await fetch('/api/suppliers');
        if (response.ok) {
          const data = await response.json();
          setSuppliers(data);
        }
      } catch (error) {
        console.error("Failed to fetch suppliers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  const requestSort = (key: string, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactNumber.includes(searchTerm)
  );

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aValue = a[sortConfig.key as keyof Supplier];
    const bValue = b[sortConfig.key as keyof Supplier];
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (isLoading) return <div className={s.loadingContainer}>Loading Suppliers...</div>;

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.tableContainer}>

          {/* HEADER */}
          <div className={s.header}>
            <h1 className={s.title}>Suppliers</h1>
            <div className={s.controls}>
                <button className={s.archiveIconBtn} title="View Archive">
                    <LuArchive size={20} />
                </button>
              <div className={s.searchWrapper}>
                <input
                  type="text"
                  placeholder="Search..."
                  className={s.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                  { label: 'COST PRICE', key: 'costPrice' },
                  { label: 'LEAD TIME (DAYS)', key: 'leadTime' },
                  { label: 'MOQ', key: 'moq' },
                ].map(col => (
                  <th key={col.key}>
                    <div className={s.sortableHeader}>
                      <span>{col.label}</span>
                      <div className={s.sortIconsStack}>
                        <span 
                          className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                          onClick={() => requestSort(col.key, 'asc')}
                        >
                          <LuChevronUp size={12} />
                        </span>
                        <span 
                          className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                          onClick={() => requestSort(col.key, 'desc')}
                        >
                          <LuChevronDown size={12} />
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className={s.actionHeader}>Action</th>
              </tr>
            </thead>

            <tbody>
              {sortedSuppliers.length > 0 ? (
                sortedSuppliers.map((supply, index) => (
                  <tr key={supply.id} className={index % 2 !== 0 ? s.rowOdd : ''}>
                    <td style={{ fontWeight: 600 }}>{supply.supplierName}</td>
                    <td>{supply.contactPerson}</td>
                    <td>{supply.contactNumber}</td>
                    <td>₱ {supply.costPrice.toFixed(2)}</td>
                    <td>{supply.leadTime}</td>
                    <td>{supply.moq}</td>
                    <td className={s.actionCell}>
                      <div className={s.moreIcon} onClick={() => setOpenMenuId(openMenuId === supply.id ? null : supply.id)}>
                        <LuEllipsisVertical size={20} />
                      </div>
                      {openMenuId === supply.id && (
                        <div className={s.popupMenu}>
                          <button className={s.popBtnEdit}><LuPencil size={14}/> Edit</button>
                          <button className={s.popBtnArchive}><LuDownload size={14} /> Archive</button>
                          <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    No suppliers found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* FOOTER */}
          <div className={s.footer}>
            <div>Show data <span className={s.countBadge}>{sortedSuppliers.length}</span> of {suppliers.length}</div>
            <div className={s.pagination}>
                <button className={s.pageCircleActive}>1</button>
                <button className={s.pageCircle}>2</button>
                <button className={s.pageCircle}>3</button>
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