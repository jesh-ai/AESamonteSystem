'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from '@/css/suppliers.module.css';
import TopHeader from '@/components/layout/TopHeader';
import {
  LuSearch,
  LuEllipsisVertical,
  LuChevronUp,
  LuChevronDown,
  LuPencil,
  LuArchive,
  LuChevronRight
} from 'react-icons/lu';

/* TYPES */
interface Supplier {
  id: number;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
}

const ROWS_PER_PAGE = 10;

/* COMPONENT */
export default function Suppliers({ role, onLogout }: { role: string; onLogout: () => void }) {
  const s = styles as Record<string, string>;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Supplier | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });

  /* FETCH */
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5000/api/suppliers');
        const data = await res.json();
        setSuppliers(data);
      } catch (err) {
        console.error('Failed to fetch suppliers', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSuppliers();
  }, []);

  /* FILTER */
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(sup =>
      `${sup.supplierName} ${sup.contactPerson} ${sup.contactNumber} ${sup.email} ${sup.address}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  }, [suppliers, searchTerm]);

  /* SORT */
  const sortedSuppliers = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredSuppliers;
    return [...filteredSuppliers].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSuppliers, sortConfig]);

  /* TOGGLE SORT ON HEADER CLICK */
  const handleSort = (key: keyof Supplier) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        // toggle direction
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' }; // default to ascending
    });
  };

  /* PAGINATION */
  const totalPages = Math.ceil(sortedSuppliers.length / ROWS_PER_PAGE);
  const paginated = sortedSuppliers.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [searchTerm]);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () =>
    Array.from({ length: totalPages }, (_, i) => (
      <div
        key={i + 1}
        className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
        onClick={() => changePage(i + 1)}
      >
        {i + 1}
      </div>
    ));

  if (isLoading) return <div className={s.loadingContainer}>Loading Suppliers...</div>;

  /* UI */
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
                  <th
                    key={col.key}
                    className={s.sortableHeader}
                    onClick={() => handleSort(col.key as keyof Supplier)}
                  >
                    <div className={s.sortHeaderInner}>
                      <span>{col.label}</span>
                      <div className={s.sortIconsStack}>
                        <LuChevronUp
                          className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                        />
                        <LuChevronDown
                          className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                        />
                      </div>
                    </div>
                  </th>
                ))}
                <th className={s.actionHeader}>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {paginated.length ? (
                paginated.map((sup, i) => (
                  <tr key={sup.id} className={i % 2 !== 0 ? s.altRow : ''}>
                    <td>{sup.supplierName}</td>
                    <td>{sup.contactPerson}</td>
                    <td>{sup.contactNumber}</td>
                    <td>{sup.email}</td>
                    <td>{sup.address}</td>
                    <td className={s.actionCell}>
                      <LuEllipsisVertical
                        className={s.moreIcon}
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
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{paginated.length}</span> of {sortedSuppliers.length}
            </div>
            <div className={s.pagination}>
              {renderPageNumbers()}
              <button
                className={s.nextBtn}
                onClick={() => changePage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <LuChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
