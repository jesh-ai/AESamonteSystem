'use client'

import { useState } from 'react'
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
  supplier_id: number;
  supplier_name: string;
  supplier_address?: string;
  contact_person?: string;
  supplier_contact?: string;
  supplier_email?: string;
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
    const searchStr = `${sup.supplier_id} ${sup.supplier_name} ${sup.contact_person || ''}`.toLowerCase()
    return searchStr.includes(searchTerm.toLowerCase())
  })

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    if (sortConfig.key === 'supplier_id') {
      return sortConfig.direction === 'asc'
        ? (Number(a.supplier_id) || 0) - (Number(b.supplier_id) || 0)
        : (Number(b.supplier_id) || 0) - (Number(a.supplier_id) || 0)
    }
    const aVal = a[sortConfig.key] ?? ''
    const bVal = b[sortConfig.key] ?? ''
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Supplier, direction: 'asc' | 'desc') => {
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
  { label: 'ID',             key: 'supplier_id' },
  { label: 'SUPPLIER NAME',  key: 'supplier_name' },
  { label: 'CONTACT PERSON', key: 'contact_person' },
  { label: 'CONTACT NUMBER', key: 'supplier_contact' },
  { label: 'EMAIL',          key: 'supplier_email' },
  { label: 'ADDRESS',        key: 'supplier_address' },
  ]

  return (
    <div className={s.tableContainer} style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      <div className={s.header}>
        <h1 className={s.title} style={{ color: '#64748b' }}>Archived Suppliers</h1>
        <div className={s.controls}>
          <button className={s.backArchiveIconBtn} onClick={onBack}>
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
                <th key={col.key}>
                  <div className={s.sortableHeader}>
                    <span>{col.label}</span>
                    {col.key === 'supplier_id' && (
                      <div className={s.sortIconsStack}>
                        <span
                          className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                          onClick={() => requestSort(col.key as keyof Supplier, 'asc')}
                          style={{ cursor: 'pointer' }}
                        >
                          <LuChevronUp size={12} />
                        </span>
                        <span
                          className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                          onClick={() => requestSort(col.key as keyof Supplier, 'desc')}
                          style={{ cursor: 'pointer' }}
                        >
                          <LuChevronDown size={12} />
                        </span>
                      </div>
                    )}
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
                <tr key={sup.supplier_id} className={i % 2 ? s.altRow : ''}>
                  <td style={{ color: '#94a3b8' }}>{sup.supplier_id}</td>
                  <td style={{ fontWeight: 600, color: '#64748b' }}>{sup.supplier_name}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.contact_person || '—'}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.supplier_contact || '—'}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.supplier_email || '—'}</td>
                  <td style={{ color: '#94a3b8' }}>{sup.supplier_address || '—'}</td>
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
                      <button className={s.archiveBtn} onClick={() => onRestore(sup.supplier_id)}>
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