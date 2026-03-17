'use client'

import React, { useState } from 'react'
import styles from '@/css/order.module.css'
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuArrowLeft,
  LuArchiveRestore
} from 'react-icons/lu'

/* ===================== TYPE ===================== */
// Mirrors the Order type in OrderPage — same pattern as Product in archiveInvModal
export interface Order {
  id: number;
  customer: string;
  contact?: string;
  address: string;
  date: string;
  status: string;
  paymentMethod: string;
  totalQty: number;
  totalAmount: number;
  is_archived?: boolean;
}

interface ArchiveTableProps {
  orders: Order[]                    // receives ALL orders (same as products in inventory)
  onRestore: (id: number) => void   // same toggle function — handles both archive & restore
  onBack: () => void
}

export default function ArchiveTable({ orders, onRestore, onBack }: ArchiveTableProps) {
  const s = styles as Record<string, string>
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Order | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  // 1. Filter: ONLY show archived orders that match search — same as inventory
  const filteredOrders = orders.filter(o => {
    if (!o.is_archived) return false;  // same guard as inventory's !p.is_archived
    const searchStr = `${o.id} ${o.customer} ${o.address}`.toLowerCase()
    return searchStr.includes(searchTerm.toLowerCase())
  })

  // 2. Sort Logic — same as inventory
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aVal = a[sortConfig.key] ?? ''
    const bVal = b[sortConfig.key] ?? ''
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Order) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const columns: { label: string; key: keyof Order }[] = [
    { label: 'ID',      key: 'id' },
    { label: 'CUSTOMER', key: 'customer' },
    { label: 'ADDRESS', key: 'address' },
    { label: 'QTY',     key: 'totalQty' },
    { label: 'TOTAL',   key: 'totalAmount' },
    { label: 'PAYMENT', key: 'paymentMethod' },
    { label: 'DATE',    key: 'date' },
    { label: 'STATUS',  key: 'status' },
  ]

  return (
    <div className={s.tableContainer} style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      {/* HEADER */}
      <div className={s.header}>
        <h1 className={s.title} style={{ color: '#64748b' }}>Archived Orders</h1>
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
              {columns.map(col => (
                <th key={col.key} onClick={() => requestSort(col.key)} style={{ cursor: 'pointer' }}>
                  <div className={s.sortableHeader}>
                    <span>{col.label}</span>
                    <div className={s.sortIconsStack}>
                      <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                      <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
              ))}
              <th className={s.actionHeader}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.length ? (
              sortedOrders.map((o, i) => (
                <tr key={o.id} className={i % 2 ? s.altRow : ''}>
                  <td style={{ color: '#94a3b8' }}>{o.id}</td>
                  <td style={{ fontWeight: 600, color: '#64748b' }}>{o.customer}</td>
                  <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }}>{o.address}</td>
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>{o.totalQty}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#64748b' }}>₱{o.totalAmount?.toLocaleString()}</td>
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>{o.paymentMethod}</td>
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>{o.date}</td>
                  <td>
                    <span style={{ backgroundColor: '#e2e8f0', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      ARCHIVED
                    </span>
                  </td>
                  <td className={s.actionCell}>
                    <div className={s.actionWrapper}>
                      <button
                        className={s.archiveBtn}
                        onClick={() => onRestore(o.id)}  
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No archived orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className={s.footer} style={{ color: '#94a3b8' }}>
        Showing {sortedOrders.length} archived order{sortedOrders.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}