'use client'

import React, { useState } from 'react'
import styles from '@/css/sales.module.css'
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuArrowLeft,
  LuArchiveRestore
} from 'react-icons/lu'

export interface Transaction {
  no: string  // <--- FIXED to string
  name: string
  address: string
  date: string
  qty: number
  amount: number
  status: 'PAID' | 'PENDING' | 'INACTIVE'
  paymentMethod: string // <--- ADDED
  is_archived?: boolean
}

interface ArchiveTableProps {
  transactions: Transaction[]
  onRestore: (txNo: string) => void // <--- FIXED to string
  onBack: () => void
}

export default function ArchiveTable({ transactions, onRestore, onBack }: ArchiveTableProps) {
  const s = styles as Record<string, string>
  const [searchTerm, setSearchTerm] = useState('')
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
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Transaction, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction })
  }

  return (
    <div className={s.tableContainer} style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      <div className={s.header}>
        <h1 className={s.title} style={{ color: '#64748b' }}>Archived Transactions</h1>

        <div className={s.controls}>
          {/* Back Button */}
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
              onChange={e => setSearchTerm(e.target.value)}
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
                    <div className={s.sortIconsStack}>
                      <span 
                        className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                        onClick={() => requestSort(col.key as keyof Transaction, 'asc')}
                      >
                        <LuChevronUp size={12} />
                      </span>
                      <span 
                        className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                        onClick={() => requestSort(col.key as keyof Transaction, 'desc')}
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
            {sortedTx.length ? (
              sortedTx.map((tx, i) => (
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

      <div className={s.footer} style={{ color: '#94a3b8' }}>
        Showing {sortedTx.length} archived items
      </div>
    </div>
  )
}