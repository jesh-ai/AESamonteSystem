'use client'

import React, { useState } from 'react'
import styles from '@/css/suppliers.module.css'
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuArrowLeft,
  LuArchiveRestore,
  LuChevronLeft,
  LuChevronRight
} from 'react-icons/lu'

export interface Supplier {
  id: number;
  supplierName: string;
  address?: string;        
  contactPerson?: string;
  contactNumber?: string;
  email?: string;
  paymentTerms?: string;
  is_archived?: boolean;
}

interface ArchiveSupplierTableProps {
  suppliers: Supplier[]
  onRestore: (id: number) => void
  onBack: () => void
}

const ROWS_PER_PAGE = 10;

export default function ArchiveSupplierTable({ suppliers, onRestore, onBack }: ArchiveSupplierTableProps) {
  const s = styles as Record<string, string>
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Supplier | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  const filteredSuppliers = suppliers.filter(sup => {
    if (!sup.is_archived) return false;
    const searchStr = `${sup.id} ${sup.supplierName} ${sup.contactPerson || ''}`.toLowerCase()
    return searchStr.includes(searchTerm.toLowerCase())
  })

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aVal = a[sortConfig.key] ?? ''
    const bVal = b[sortConfig.key] ?? ''
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Supplier) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(sortedSuppliers.length / ROWS_PER_PAGE));
  const paginatedSuppliers = sortedSuppliers.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const renderPageNumbers = () => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button 
          key={i} 
          className={currentPage === i ? s.pageCircleActive : s.pageCircle} 
          onClick={() => setCurrentPage(i)}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  const columns: { label: string; key: keyof Supplier }[] = [
  { label: 'ID',             key: 'id' },
  { label: 'SUPPLIER NAME',  key: 'supplierName' },
  { label: 'CONTACT PERSON', key: 'contactPerson' },
  { label: 'CONTACT NUMBER', key: 'contactNumber' },
  { label: 'EMAIL',          key: 'email' },
  { label: 'ADDRESS',        key: 'address' },
  ]

  return (
    <div className={s.tableContainer} style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      <div className={s.header}>
        <h1 className={s.title} style={{ color: '#64748b' }}>Archived Suppliers</h1>
        <div className={s.controls}>
          <button
            className={s.archiveIconBtn}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#64748b', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            onClick={onBack}
          >
            <LuArrowLeft size={18} /> Back to Active
          </button>
          <div className={s.searchWrapper}>
            <input
              className={s.searchInput}
              placeholder="Search archives..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
            />
            <LuSearch size={18} />
          </div>
        </div>
      </div>

      {/* WRAP THE TABLE IN s.tableResponsive HERE */}
      <div className={s.tableResponsive}>
        <table className={s.table}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} onClick={() => requestSort(col.key)} style={{ cursor: 'pointer' }}>
                  <div className={s.sortableHeaderInner}>
                    <span>{col.label}</span>
                    <div className={s.sortIconsStack}>
                      <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                      <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
              ))}
              <th style={{ display: 'none' }}>STATUS</th>  
              <th style={{ textAlign: 'center', width: '120px' }}>ACTION</th>  
            </tr>
          </thead>
          <tbody>
            {paginatedSuppliers.length ? (
              paginatedSuppliers.map((sup, i) => (
                <tr key={sup.id} className={i % 2 ? s.altRow : ''}>
                  <td style={{ color: '#94a3b8' }}>{sup.id}</td>
                  <td style={{ fontWeight: 600, color: '#64748b' }}>{sup.supplierName}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.contactPerson || '—'}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.contactNumber || '—'}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.email || '—'}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.address || '—'}</td>
                  <td style={{ display: 'none' }}>
                      <span style={{ backgroundColor: '#e2e8f0', 
                                     color: '#64748b', 
                                     padding: '4px 8px', 
                                     borderRadius: '4px', 
                                     fontSize: '0.75rem', 
                                     fontWeight: 600, 
                                     display: 'inline-block',
                                     width: '90px',        
                                     textAlign: 'center' 
                                     }}>
                                       ARCHIVED
                      </span>
                  </td>
                  <td className={s.actionCell}>
                      <div className={s.actionWrapper}>
                      <button className={s.archiveBtn} onClick={() => onRestore(sup.id)}>
                          <LuArchiveRestore size={14} />
                          <span>Restore</span>
                      </button>
                      </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No archived suppliers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={s.footer}>
        <div className={s.showDataText} style={{ color: '#94a3b8' }}>
          Showing <span className={s.countBadge}>{paginatedSuppliers.length}</span> of {sortedSuppliers.length}
        </div>
        <div className={s.pagination}>
          <button className={s.nextBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
            <LuChevronLeft />
          </button>
          {renderPageNumbers()}
          <button className={s.nextBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
            <LuChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}