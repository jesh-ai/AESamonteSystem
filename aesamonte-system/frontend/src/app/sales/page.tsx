'use client'

import React, { useState, useEffect } from 'react'
import styles from '@/css/sales.module.css'
import TopHeader from '@/components/layout/TopHeader'
import ExportButton from '@/components/features/ExportButton'
import ExportModal from './exportModal' 
import ArchiveTable from './archiveSalesModal'
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
  is_archived?: boolean // Add this flag
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
  const [showExportModal, setShowExportModal] = useState(false)
  const [isArchiveView, setIsArchiveView] = useState(false)
  
  // States for Alert Modal
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isError, setIsError] = useState(false) // Track if it's an error pop-up

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

  const handleToggleArchive = async (txNo: number) => {
    try {
      // 1. Send the command to the Python Database
      const response = await fetch(`http://127.0.0.1:5000/api/sales/archive/${txNo}`, {
        method: 'PUT',
      });

      if (response.ok) {
        const data = await response.json();
        
        // 2. Update the React state with the TRUE database status
        setTransactions(prev => 
          prev.map(tx => 
            tx.no === txNo ? { ...tx, is_archived: data.is_archived, status: data.new_status } : tx
          )
        );

        // 3. Show Success Message
        const actionMsg = data.is_archived ? "Moved to Archive" : "Restored from Archive";
        handleExportSuccess(actionMsg, 'success');
      } else {
        handleExportSuccess("Failed to update archive status in database.", "error");
      }
    } catch (error) {
      console.error(error);
      handleExportSuccess("Network error. Is Flask running?", "error");
    }

  const targetTx = transactions.find(t => t.no === txNo);
  
  const actionMsg = targetTx?.is_archived ? "Restored from Archive" : "Moved to Archive";
  handleExportSuccess(actionMsg);
};


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
    const matchesArchiveView = isArchiveView ? tx.is_archived === true : !tx.is_archived;

    const searchStr = `${tx.no} ${tx.name} ${tx.address}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());

    return matchesArchiveView && matchesSearch;
  });

  const sortedTx = [...filteredTx].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    
    const aVal = a[sortConfig.key] ?? '';
    const bVal = b[sortConfig.key] ?? '';

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: keyof Transaction, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  };

  /* ================= UI ================= */

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {/* DYNAMIC ALERT POP-UP (Success/Error) */}
      {showToast && (
        <div className={s.toastOverlay}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
                {isError ? '!' : '✓'}
              </div>
            </div>
            
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>
              <button 
                className={`${s.okButton} ${isError ? s.okButtonError : ''}`} 
                onClick={() => setShowToast(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={s.mainContent}>
        <div className={s.headerActions}>
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
        {/* ================= CONDITIONAL TABLE RENDERING ================= */}
        
        {isArchiveView ? (
          
          <ArchiveTable 
            transactions={transactions} 
            onRestore={handleToggleArchive} 
            onBack={() => setIsArchiveView(false)} 
          />

        ) : (
          
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h1 className={s.title}>Transactions</h1>

              <div className={s.controls}>
                {/* YOUR SPECIFIC BUTTON TRIGGERS THE COMPONENT */}
                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives">
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
                            onClick={() => handleToggleArchive(tx.no)}
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
                      No active transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className={s.footer}>
              Showing {sortedTx.length} active transactions
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