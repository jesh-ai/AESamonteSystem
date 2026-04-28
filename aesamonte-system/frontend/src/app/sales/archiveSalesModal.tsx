'use client'

import React, { useState } from 'react'
import styles from '@/css/sales.module.css'
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuArrowLeft,
  LuArchiveRestore,
  LuChevronLeft,
  LuChevronRight
} from 'react-icons/lu'

export interface Transaction {
  no: string
  name: string
  address: string
  date: string
  qty: number
  amount: number
  status: 'PAID' | 'PENDING' | 'INACTIVE'
  paymentMethod: string
  is_archived?: boolean
}

interface ArchiveTableProps {
  transactions: Transaction[]
  onRestore: (txNo: string) => void
  onBack: () => void
}

const ROWS_PER_PAGE = 10;

export default function ArchiveTable({ transactions, onRestore, onBack }: ArchiveTableProps) {
  const s = styles as Record<string, string>
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Transaction | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  // 1. Filter: ONLY show archived items that match the search
  const filteredTx = transactions.filter(tx => {
    if (!tx.is_archived) return false;
    const searchStr = `${tx.no} ${tx.name} ${tx.address}`.toLowerCase()
    return searchStr.includes(searchTerm.toLowerCase())
  })

  // 2. Sort Logic
  const sortedTx = [...filteredTx].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aVal = a[sortConfig.key] ?? ''
    const bVal = b[sortConfig.key] ?? ''

    // Numeric sort for 'no'
    if (sortConfig.key === 'no') {
      return sortConfig.direction === 'asc'
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal)
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Transaction, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction })
  }

  // 3. Pagination Logic
  const totalPages = Math.max(1, Math.ceil(sortedTx.length / ROWS_PER_PAGE));
  const paginatedTx = sortedTx.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

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

  return (
    <div className={s.tableContainer} style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      <div className={s.header}>
        <h1 className={s.title} style={{ color: '#64748b' }}>Archived Transactions</h1>

        <div className={s.controls}>
          {/* Back Button */}
          <button
          className={s.backArchiveIconBtn}
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

      <div className={s.tableResponsive}>
        <table className={s.table}>
            <thead>
            <tr>
              {[
                { label: 'No.', key: 'no' },
                { label: 'NAME', key: 'name' },
                { label: 'ADDRESS', key: 'address' },
                { label: 'DATE', key: 'date' },
                { label: 'QTY', key: 'qty' },
                { label: 'AMOUNT', key: 'amount' },
                { label: 'STATUS', key: 'status' }
              ].map(col => (
                <th key={col.key}>
                  <div className={s.sortableHeader}>
                    <span>{col.label}</span>
                    {col.key === 'no' && (
                      <div className={s.sortIconsStack}>
                        <span
                        className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                        onClick={() => requestSort(col.key as keyof Transaction, 'asc')}
                        style={{ cursor: 'pointer' }}
                      >
                        <LuChevronUp size={12} />
                      </span>
                      <span
                        className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                        onClick={() => requestSort(col.key as keyof Transaction, 'desc')}
                        style={{ cursor: 'pointer' }}
                      >
                        <LuChevronDown size={12} />
                      </span>
                      </div>
                    )}
                  </div>
                </th>
              ))}
              <th className={s.actionHeader}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTx.length ? (
              paginatedTx.map((tx, i) => (
                <tr key={tx.no} className={i % 2 !== 0 ? s.rowOdd : ''}>
                  <td style={{ color: '#94a3b8' }}>{tx.no}</td>
                  <td style={{ fontWeight: 600, color: '#64748b' }}>{tx.name}</td>
                  <td style={{ color: '#94a3b8' }}>{tx.address}</td>
                  <td style={{ color: '#94a3b8' }}>{tx.date}</td>
                  <td style={{ color: '#94a3b8' }}>{tx.qty}</td>
                  <td style={{ color: '#94a3b8' }}>₱ {tx.amount.toLocaleString()}</td>
                  <td>
                     <span style={{ backgroundColor: '#e2e8f0', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>ARCHIVED</span>
                  </td>
                  <td className={s.actionCell}>
                    <div className={s.actionWrapper}>
                      <button 
                        className={s.archiveBtn}
                        style={{ color: '#10b981', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}
                        onClick={() => onRestore(tx.no)}
                      >
                        <LuArchiveRestore size={16} />
                        <span>Restore</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No archived transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={s.footer}>
        <div className={s.showDataText} style={{ color: '#94a3b8' }}>
          Showing <span className={s.countBadge}>{paginatedTx.length}</span> of {sortedTx.length}
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