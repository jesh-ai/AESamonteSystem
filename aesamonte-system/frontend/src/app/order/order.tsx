'use client'

import React, { useState, useEffect } from 'react'
import styles from '@/css/order.module.css'
import TopHeader from '@/components/layout/TopHeader'
import { 
  LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown, 
  LuChevronRight, LuArchive, LuTruck, LuPencil, LuDownload 
} from 'react-icons/lu'

interface OrderSummary {
  shippedToday: { current: number; total: number; yesterday: number };
  cancelled: { current: number; yesterday: number };
  totalOrders: { count: number; growth: number };
}

interface OrderItem {
  no: number
  item: string
  brand: string
  date: string
  qty: number
  unitPrice: number
  status: 'TO SHIP' | 'RECEIVED'
}

interface OrderProps {
  role?: string
  onLogout: () => void
}

export default function OrderPage({ role = 'Admin', onLogout }: OrderProps) {
  const s = styles as Record<string, string>
  const [summary, setSummary] = useState<OrderSummary | null>(null)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null) // State for the popup menu
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })

  useEffect(() => {
    setSummary({
      shippedToday: { current: 5, total: 6, yesterday: 40 },
      cancelled: { current: 1, yesterday: 10 },
      totalOrders: { count: 22013, growth: 3.1 }
    })

    setOrders([
      { no: 4002, item: 'JOY Company Incorporation', brand: 'Muralla Intramuros', date: '04/15/25', qty: 10, unitPrice: 5000, status: 'TO SHIP' },
      { no: 4001, item: 'Trans Logistica International...', brand: '1562 Tondo Manila', date: '04/14/25', qty: 88, unitPrice: 19000, status: 'TO SHIP' },
      { no: 4000, item: 'HP INC.', brand: 'Muralla Intramuros', date: '04/15/25', qty: 121, unitPrice: 288500, status: 'RECEIVED' },
      { no: 3999, item: 'Deli Group Corporation', brand: 'Muralla Intramuros', date: '04/15/25', qty: 5, unitPrice: 5000, status: 'RECEIVED' },
      { no: 3998, item: 'Brothers', brand: 'Muralla Intramuros', date: '04/15/25', qty: 3, unitPrice: 450, status: 'RECEIVED' },
      { no: 3997, item: 'DONG-A', brand: 'Muralla Intramuros', date: '04/15/25', qty: 10, unitPrice: 5000, status: 'RECEIVED' },
      { no: 3996, item: 'JOY Company Incorporation', brand: 'Muralla Intramuros', date: '04/15/25', qty: 3, unitPrice: 450, status: 'RECEIVED' },
    ])
  }, [])

  const requestSort = (key: string, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  }

  const filteredOrders = orders.filter((o) =>
    o.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.no.toString().includes(searchTerm)
  )

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aValue = a[sortConfig.key as keyof OrderItem];
    const bValue = b[sortConfig.key as keyof OrderItem];

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (!summary) return null

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <main className={s.mainContent}>
        {/* Top Cards Section */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Shipped Today</p>
            <div className={s.cardMainRow}>
              <LuTruck className={s.cardIcon} size={32} />
              <h2 className={s.bigNumber}>
                <span className={s.greenText}>{summary.shippedToday.current}</span>/{summary.shippedToday.total}
              </h2>
            </div>
            <div className={s.cardFooter}>
              <span>Shipped Yesterday</span>
              <span className={s.greenText}>{summary.shippedToday.yesterday}/{summary.shippedToday.yesterday}</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Orders Cancelled</p>
            <h2 className={`${s.bigNumber} ${s.redText} ${s.textCenter}`}>{summary.cancelled.current}</h2>
            <div className={s.cardFooter}>
              <span>Cancelled Yesterday</span>
              <span className={s.redText}>{summary.cancelled.yesterday}</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Orders</p>
            <h2 className={`${s.bigNumber} ${s.yellowText} ${s.textCenter}`}>{summary.totalOrders.count}</h2>
            <div className={s.cardFooter}>
              <span>vs last month</span>
              <span className={s.pill}><LuChevronUp /> {summary.totalOrders.growth}%</span>
            </div>
          </section>
        </div>

        {/* Orders Table Container */}
        <div className={s.tableCard}>
          <div className={s.tableHeader}>
            <h1 className={s.title}>Orders</h1>
            <div className={s.headerControls}>
              <button className={s.archiveIconBtn} title="View Archive"><LuArchive size={20} /></button>
              <div className={s.searchWrapper}>
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className={s.searchInput} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <LuSearch className={s.searchIcon} />
              </div>
              <button className={s.addButton}>ADD</button>
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                {[
                  { label: 'No.', key: 'no' },
                  { label: 'ITEM', key: 'item' },
                  { label: 'BRAND', key: 'brand' },
                  { label: 'DATE', key: 'date' },
                  { label: 'QTY', key: 'qty' },
                  { label: 'UNIT PRICE', key: 'unitPrice' },
                  { label: 'PRICE', key: 'status' }
                ].map((col) => (
                  <th key={col.label}>
                    <div className={s.sortableHeader}>
                      <span className={s.columnLabel}>{col.label}</span>
                      <div className={s.sortIconsStack}>
                        <span 
                          className={`${s.arrowBtn} ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}`} 
                          onClick={() => requestSort(col.key, 'asc')}
                        >
                          <LuChevronUp size={12}/>
                        </span>
                        <span 
                          className={`${s.arrowBtn} ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}`} 
                          onClick={() => requestSort(col.key, 'desc')}
                        >
                          <LuChevronDown size={12}/>
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
                <th className={s.actionHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order, idx) => (
                <tr key={order.no} className={idx % 2 !== 0 ? s.rowOdd : ''}>
                  <td>{order.no}</td>
                  <td className={s.boldText}>{order.item}</td>
                  <td>{order.brand}</td>
                  <td>{order.date}</td>
                  <td>{order.qty}</td>
                  <td>₱ {order.unitPrice.toLocaleString()}</td>
                  <td className={order.status === 'TO SHIP' ? s.statusToShip : s.statusReceived}>
                    {order.status}
                  </td>
                  <td className={s.actionCell}>
                    <div className={s.moreIcon} onClick={() => setOpenMenuId(openMenuId === order.no ? null : order.no)}>
                      <LuEllipsisVertical size={20} />
                    </div>
                    {openMenuId === order.no && (
                      <div className={s.popupMenu}>
                        <button className={s.popBtnAdd}>ADD</button>
                        <button className={s.popBtnEdit}><LuPencil size={14} /> Edit</button>
                        <button className={s.popBtnArchive}><LuDownload size={14} /> Archive</button>
                        <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer & Pagination */}
          <div className={s.footer}>
            <div className={s.showData}>
              Show data <span className={s.badge}>{sortedOrders.length}</span> of {orders.length}
            </div>
            <div className={s.pagination}>
              <button className={s.pageCircleActive}>1</button>
              <button className={s.pageCircle}>2</button>
              <button className={s.pageCircle}>3</button>
              <button className={s.nextBtn}>
                Next <LuChevronRight />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}