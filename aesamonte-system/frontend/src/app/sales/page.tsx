/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import styles from '@/css/sales.module.css'
import TopHeader from '@/components/layout/TopHeader'
import ExportModal from './exportModal' 
import ArchiveTable from './archiveSalesModal'
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuChevronRight,
  LuArchive,
  LuDownload
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

interface SalesProps {
  role?: string
  onLogout: () => void
}

export default function SalesPage({ role = 'Admin', onLogout }: SalesProps) {
  const s = styles as Record<string, string>

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [isArchiveView, setIsArchiveView] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const [sortConfig, setSortConfig] = useState<{
    key: keyof Transaction | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  /* ================= HANDLERS ================= */

  const handleExportSuccess = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg)
    setIsError(type === 'error')
    setShowToast(true)
  }

  // THE FIX: Added 'isBackground' to prevent screen flashes, and a cache-busting timestamp!
  const fetchSalesData = async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true)
      
      const t = new Date().getTime(); // Forces browser to pull fresh DB data
      
      const [summaryRes, transRes] = await Promise.all([
        fetch(`http://127.0.0.1:5000/api/sales/summary?t=${t}`, { cache: 'no-store' }),
        fetch(`http://127.0.0.1:5000/api/sales/transactions?t=${t}`, { cache: 'no-store' })
      ])
      
      if (summaryRes.ok && transRes.ok) {
        setSummary(await summaryRes.json())
        setTransactions(await transRes.json())
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      if (!isBackground) setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSalesData()
  }, [])

  const handleTogglePaymentStatus = async (tx: Transaction) => {
    if (!tx.paymentMethod?.toLowerCase().includes('bank')) return;
    if (tx.status === 'INACTIVE' || tx.is_archived) return;

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/sales/toggle-status/${tx.no}`, {
        method: 'PUT',
      });

      if (response.ok) {
        const data = await response.json();
        handleExportSuccess(data.message, 'success');
        
        // THE FIX: Refresh in background! (True = no loading screen flash)
        await fetchSalesData(true);
      } else {
        const errorData = await response.json();
        handleExportSuccess(errorData.error || "Failed to update status.", "error");
      }
    } catch (error) {
      handleExportSuccess("Network error. Is Flask running?", "error");
    }
  };

  const handleToggleArchive = async (txNo: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/sales/archive/${txNo}`, {
        method: 'PUT',
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(prev => 
          prev.map(tx => 
            tx.no === txNo ? { ...tx, is_archived: data.is_archived, status: data.new_status } : tx
          )
        );
        const actionMsg = data.is_archived ? "Moved to Archive" : "Restored from Archive";
        handleExportSuccess(actionMsg, 'success');
        
        // THE FIX: Refresh cards in background!
        await fetchSalesData(true); 
      } else {
        handleExportSuccess("Failed to update archive status.", "error");
      }
    } catch (error) {
      handleExportSuccess("Network error. Is Flask running?", "error");
    }
  };

  /* ================= FILTER + SORT + PAGINATION ================= */

  const filteredTx = transactions.filter(tx => {
    const matchesArchiveView = isArchiveView ? tx.is_archived === true : !tx.is_archived;
    const searchStr = `${tx.no} ${tx.name} ${tx.address} ${tx.paymentMethod || ''}`.toLowerCase();
    return matchesArchiveView && searchStr.includes(searchTerm.toLowerCase());
  });

  const sortedTx = [...filteredTx].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aVal = a[sortConfig.key] ?? '';
    const bVal = b[sortConfig.key] ?? '';
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedTx.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedTx = sortedTx.slice(startIndex, startIndex + itemsPerPage)

  const requestSort = (key: keyof Transaction, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  };

  if (isLoading) return <div className={s.loadingContainer}>Connecting to database...</div>

  const safeSummary = summary || { totalSales: 0, totalSalesChange: 0, weeklySales: 0, monthlySales: 0, yearlySales: 0, topClientName: 'None', topClientSales: 0, topClientChange: 0 }

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {showToast && (
        <div className={s.toastOverlay} style={{ zIndex: 10000 }}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
                {isError ? '!' : '✓'}
              </div>
            </div>
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>
              <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      <main className={s.mainContent}>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '20px' }}>
          <button 
            onClick={() => setShowExportModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e3a8a', 
              color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', 
              cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <LuDownload size={18} /> Export
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Sales</p>
            <h2 className={s.bigNumber}>₱ {safeSummary.totalSales.toLocaleString()}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              <span className={s.pill}>↗ {safeSummary.totalSalesChange}%</span>
            </div>
          </section>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Sales Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}><span>Weekly</span><span className={s.green}>₱ {safeSummary.weeklySales.toLocaleString()}</span></div>
              <div className={s.listRow}><span>Monthly</span><span className={s.red}>₱ {safeSummary.monthlySales.toLocaleString()}</span></div>
              <div className={`${s.listRow} ${s.altRow}`}><span>Yearly</span><span className={s.blue}>₱ {safeSummary.yearlySales.toLocaleString()}</span></div>
            </div>
          </section>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Top Client</p>
            <h2 className={s.bigNumber}>₱ {safeSummary.topClientSales.toLocaleString()}</h2>
            <div className={s.cardFooter}><span className={s.subText}>{safeSummary.topClientName}</span><span className={s.pill}>↗ {safeSummary.topClientChange}%</span></div>
          </section>
        </div>

        {isArchiveView ? (
          <ArchiveTable transactions={transactions} onRestore={handleToggleArchive} onBack={() => setIsArchiveView(false)} />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h1 className={s.title}>Transactions</h1>
              <div className={s.controls}>
                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives"><LuArchive size={20} /></button>
                <div className={s.searchWrapper}>
                  <input className={s.searchInput} placeholder="Search..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} />
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
                    { label: 'PAYMENT', key: 'paymentMethod' },
                    { label: 'STATUS', key: 'status' }
                  ].map((col) => (
                    <th key={col.key}>
                      <div className={s.sortableHeader}>
                        <span>{col.label}</span>
                        <div className={s.sortIconsStack}>
                          <LuChevronUp size={12} className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} onClick={() => requestSort(col.key as any, 'asc')} />
                          <LuChevronDown size={12} className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} onClick={() => requestSort(col.key as any, 'desc')} />
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className={s.actionHeader}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTx.map((tx, i) => {
                  const isBank = tx.paymentMethod?.toLowerCase().includes('bank');
                  
                  return (
                    <tr key={tx.no} className={i % 2 !== 0 ? s.rowOdd : ''}>
                      <td>{tx.no}</td>
                      <td style={{ fontWeight: 600 }}>{tx.name}</td>
                      <td>{tx.address}</td>
                      <td>{tx.date}</td>
                      <td>{tx.qty}</td>
                      <td>₱ {tx.amount.toLocaleString()}</td>
                      <td style={{ color: '#64748b' }}>{tx.paymentMethod}</td>
                      <td>
                        <span 
                          className={tx.status === 'PAID' ? s.statusPaid : s.statusPending}
                          style={{
                            cursor: isBank ? 'pointer' : 'default',
                            textDecoration: isBank && tx.status === 'PENDING' ? 'underline' : 'none',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => handleTogglePaymentStatus(tx)}
                          title={isBank ? "Click to toggle payment status" : "Non-bank payments process automatically"}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className={s.actionCell}>
                        <div className={s.actionWrapper}>
                          <button className={s.archiveBtn} onClick={() => handleToggleArchive(tx.no)}>
                            <LuArchive size={16} />
                            <span>Archive</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            <div className={s.footer}>
              <div className={s.showDataText}>
                Showing <span className={s.countBadge}>{paginatedTx.length}</span> of {filteredTx.length}
              </div>
              <div className={s.pagination}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button 
                    key={i + 1} 
                    className={currentPage === i + 1 ? s.pageCircleActive : s.pageCircle}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  className={s.nextBtn} 
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  <LuChevronRight />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        onSuccess={handleExportSuccess} 
      />
    </div>
  )
}