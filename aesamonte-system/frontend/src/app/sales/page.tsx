'use client'

import React, { useState, useEffect } from 'react'
import styles from '@/css/sales.module.css'
import TopHeader from '@/components/layout/TopHeader'
import ExportButton from '@/components/features/ExportButton'
import ExportModal from './exportModal' // Ensure the filename casing matches your file system
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuArchive
} from 'react-icons/lu'

/* ================= TYPES ================= */

interface SalesSummary {
  totalSales: number
  totalSalesChange: number
  weeklySales: number
  monthlySales: number
  yearlySales: number
  topClientName: string
  topClientSales: number
  topClientChange: number
}

interface Transaction {
  no: number
  name: string
  address: string
  date: string
  qty: number
  amount: number
  status: 'PAID' | 'PENDING'
}

interface SalesProps {
  role?: string
  onLogout: () => void
}

/* ================= COMPONENT ================= */

export default function SalesPage({ role = 'Admin', onLogout }: SalesProps) {
  const s = styles as Record<string, string>

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // FIXED: Added missing state for the Export Modal
  const [showExportModal, setShowExportModal] = useState(false)

  const [sortConfig, setSortConfig] = useState<{
    key: keyof Transaction | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  /* ================= FETCH ================= */

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [summaryRes, transRes] = await Promise.all([
          fetch('http://127.0.0.1:5000/api/sales/summary'),
          fetch('http://127.0.0.1:5000/api/sales/transactions')
        ])

        if (!summaryRes.ok || !transRes.ok) {
          throw new Error('Failed to fetch sales data')
        }

        const summaryData = await summaryRes.json()
        const transactionsData = await transRes.json()

        setSummary(summaryData)
        setTransactions(transactionsData)
      } catch (error) {
        console.error('Error connecting to database:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return <div className={s.loadingContainer}>Connecting to database...</div>
  }

  const safeSummary: SalesSummary = summary || {
    totalSales: 0,
    totalSalesChange: 0,
    weeklySales: 0,
    monthlySales: 0,
    yearlySales: 0,
    topClientName: 'None',
    topClientSales: 0,
    topClientChange: 0
  }

  /* ================= FILTER + SORT ================= */

  const filteredTx = transactions.filter(tx => {
    const searchStr = `${tx.no} ${tx.name} ${tx.address}`.toLowerCase()
    return searchStr.includes(searchTerm.toLowerCase())
  })

  const sortedTx = [...filteredTx].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aVal = a[sortConfig.key]
    const bVal = b[sortConfig.key]

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Transaction, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction })
  }

  /* ================= UI ================= */

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <main className={s.mainContent}>
        <div className={s.headerActions}>
          {/* IMPROVEMENT: Pass the setter to the ExportButton if it controls the modal */}
          <div onClick={() => setShowExportModal(true)}>
            <ExportButton />
          </div>
        </div>

        {/* ================= SUMMARY ================= */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Sales</p>
            <h2 className={s.bigNumber}>
              ₱ {safeSummary.totalSales.toLocaleString()}
            </h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              <span className={s.pill}>↗ {safeSummary.totalSalesChange}%</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Sales Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}>
                <span>Weekly Sales</span>
                <span className={s.green}>
                  ₱ {safeSummary.weeklySales.toLocaleString()}
                </span>
              </div>
              <div className={s.listRow}>
                <span>Monthly Sales</span>
                <span className={s.red}>
                  ₱ {safeSummary.monthlySales.toLocaleString()}
                </span>
              </div>
              <div className={`${s.listRow} ${s.altRow}`}>
                <span>Yearly Sales</span>
                <span className={s.blue}>
                  ₱ {safeSummary.yearlySales.toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Top Client</p>
            <h2 className={s.bigNumber}>
              ₱ {safeSummary.topClientSales.toLocaleString()}
            </h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>{safeSummary.topClientName}</span>
              <span className={s.pill}>↗ {safeSummary.topClientChange}%</span>
            </div>
          </section>
        </div>

        {/* ================= TABLE ================= */}
        <div className={s.tableContainer}>
          <div className={s.header}>
            <h1 className={s.title}>Transactions</h1>

            <div className={s.controls}>
              <button className={s.archiveIconBtn}>
                <LuArchive size={20} />
              </button>

              <div className={s.searchWrapper}>
                <input
                  className={s.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <LuSearch size={18} />
              </div>
            </div>
          </div>

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
                    <td>{tx.no}</td>
                    <td style={{ fontWeight: 600 }}>{tx.name}</td>
                    <td>{tx.address}</td>
                    <td>{tx.date}</td>
                    <td>{tx.qty}</td>
                    <td>₱ {tx.amount.toLocaleString()}</td>
                    <td className={tx.status === 'PAID' ? s.statusPaid : s.statusPending}>
                      {tx.status}
                    </td>
                    <td className={s.actionCell}>
                      <div className={s.actionWrapper}>
                        <button 
                          className={s.archiveBtn}
                          onClick={() => console.log('Archive transaction', tx.no)}
                        >
                          <LuArchive size={16} />
                          <span>Archive</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    No transactions available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className={s.footer}>
            Showing {sortedTx.length} of {transactions.length}
          </div>
        </div>
      </main>

      <ExportModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  )
}