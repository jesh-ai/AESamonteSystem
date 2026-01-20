'use client'

import React, { useState, useEffect } from 'react'
import styles from '@/css/sales.module.css'
import TopHeader from '@/components/layout/TopHeader'
import { LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown, LuChevronRight, LuArchive } from 'react-icons/lu'

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

export default function SalesPage({ role = 'Admin', onLogout }: SalesProps) {
  const s = styles as Record<string, string>
  const [data, setData] = useState<SalesSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  useEffect(() => {
    setData({
      totalSales: 21059,
      totalSalesChange: 5,
      weeklySales: 903,
      monthlySales: 5029,
      yearlySales: 21095,
      topClientName: 'Trans Logistica',
      topClientSales: 5520,
      topClientChange: 11,
    })

    setTransactions([
      { no: 4002, name: 'JOY Company Incorporation', address: 'Muralla Intramuros', date: '04/15/25', qty: 10, amount: 982.44, status: 'PENDING' },
      { no: 4001, name: 'Trans Logistica International', address: '1562 Tondo Manila', date: '04/14/25', qty: 88, amount: 6509.44, status: 'PENDING' },
      { no: 4000, name: 'HP INC.', address: 'Muralla Intramuros', date: '04/15/25', qty: 121, amount: 288500, status: 'PAID' },
      { no: 3999, name: 'Deli Group Corporation', address: 'Muralla Intramuros', date: '04/15/25', qty: 5, amount: 5000, status: 'PAID' },
      { no: 3998, name: 'Brothers', address: 'Muralla Intramuros', date: '04/15/25', qty: 3, amount: 450, status: 'PAID' },
    ])
  }, [])

  if (!data) return null

  const filteredTx = transactions.filter((tx) =>
    tx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.no.toString().includes(searchTerm)
  )

  const sortedTx = [...filteredTx].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aValue = a[sortConfig.key as keyof Transaction]
    const bValue = b[sortConfig.key as keyof Transaction]
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: string, direction: 'asc' | 'desc') => setSortConfig({ key, direction })

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <main className={s.mainContent}>
        {/* Top Cards */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Sales</p>
            <h2 className={s.bigNumber}>{data.totalSales.toLocaleString()}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              <span className={s.pill}>↗ {data.totalSalesChange}%</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Sales Report</p>
            <div className={s.list}>
              <div className={s.listRow}><span>Weekly Sales</span><span className={s.green}>{data.weeklySales.toLocaleString()}</span></div>
              <div className={`${s.listRow} ${s.altRow}`}><span>Monthly Sales</span><span className={s.red}>{data.monthlySales.toLocaleString()}</span></div>
              <div className={s.listRow}><span>Yearly Sales</span><span className={s.blue}>{data.yearlySales.toLocaleString()}</span></div>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Top Client</p>
            <h2 className={s.bigNumber}>{data.topClientSales.toLocaleString()}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>{data.topClientName}</span>
              <span className={s.pill}>↗ {data.topClientChange}%</span>
            </div>
          </section>
        </div>

        {/* Transactions Table */}
        <div className={s.tableContainer}>
          {/* HEADER: SEARCH */}
          <div className={s.header}>
            <h1 className={s.title}>Transactions</h1>
            <div className={s.controls}>
              <button className={s.archiveIconBtn} title="View Archive"><LuArchive size={20} /></button>
              <div className={s.searchWrapper}>
                <input
                  type="text"
                  placeholder="Search..."
                  className={s.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <LuSearch size={18} color="#5f6368" />
              </div>
            </div>
          </div>

          {/* TABLE */}
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
                  { label: 'STATUS', key: 'status' },
                ].map(col => (
                  <th key={col.key}>
                    <div className={s.sortableHeader}>
                      <span className={s.columnLabel}>{col.label}</span>
                      <div className={s.sortIconsStack}>
                        <span
                          className={`${s.arrowBtn} ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}`}
                          onClick={() => requestSort(col.key, 'asc')}
                        ><LuChevronUp size={12} /></span>
                        <span
                          className={`${s.arrowBtn} ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}`}
                          onClick={() => requestSort(col.key, 'desc')}
                        ><LuChevronDown size={12} /></span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className={s.actionHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedTx.map((tx, index) => (
                <tr key={tx.no} className={index % 2 !== 0 ? s.rowOdd : ''}>
                  <td>{tx.no}</td>
                  <td style={{ fontWeight: 600 }}>{tx.name}</td>
                  <td>{tx.address}</td>
                  <td>{tx.date}</td>
                  <td>{tx.qty}</td>
                  <td>₱ {tx.amount.toLocaleString()}</td>
                  <td className={tx.status === 'PAID' ? s.statusPaid : s.statusPending}>{tx.status}</td>
                  <td className={s.actionCell}>
                    <div className={s.moreIcon} onClick={() => setOpenMenuId(openMenuId === tx.no ? null : tx.no)}>
                      <LuEllipsisVertical size={20} />
                    </div>
                    {openMenuId === tx.no && (
                      <div className={s.popupMenu}>
                        <button className={s.popBtnArchive}>Archive</button>
                        <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FOOTER - PAGINATION */}
          <div className={s.footer}>
            <div className={s.showDataText}>
              Show data <span className={s.countBadge}>{sortedTx.length}</span> of {transactions.length}
            </div>
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
      </main>
    </div>
  )
}
