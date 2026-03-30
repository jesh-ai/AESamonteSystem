/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import styles from '@/css/sales.module.css'
import TopHeader from '@/components/layout/TopHeader'
import ExportButton from '@/components/features/ExportButton'
import ExportModal from './exportModal'
import ExportRequestModal from '@/components/features/ExportRequestModal'
import ArchiveTable from './archiveSalesModal'
import {
  LuSearch, LuChevronUp, LuChevronDown, LuChevronLeft, LuChevronRight,
  LuArchive, LuX, LuPrinter
} from 'react-icons/lu'
import { printSalesInvoice, printDeliveryReceipt } from './salesPrint'

interface SalesSummary {
  totalSales: number; totalSalesChange: number
  weeklySales: number; monthlySales: number; yearlySales: number
  topClientName: string; topClientSales: number; topClientChange: number
}

interface Transaction {
  no: string; name: string; address: string; date: string
  qty: number; amount: number
  status: 'PAID' | 'PENDING' | 'INACTIVE'
  paymentMethod: string; is_archived?: boolean
  tin?: string; contact?: string; poNo?: string; terms?: string
  registeredName?: string; items?: TransactionItem[]
}

interface TransactionItem {
  description: string; qty: number; unit: string; unitCost: number; amount: number
}

interface SalesProps {
  role?: string; employeeId?: number
  onLogout: () => void; initialSearch?: string
}

export default function SalesPage({ role = 'Admin', employeeId = 0, onLogout, initialSearch }: SalesProps) {
  const s = styles as Record<string, string>

  // ── Permission Logic ──
  const isSalesHead       = role === 'Sales Head'
  const isInventoryHead   = role === 'Inventory Head'
  const canExport         = ['Admin', 'Manager'].includes(role) || isSalesHead
  const mustRequestExport = isInventoryHead || role === 'Staff'

  // ── State ──
  const [showExportRequestModal, setShowExportRequestModal] = useState(false)
  const [summary, setSummary]           = useState<SalesSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [searchTerm, setSearchTerm]     = useState(initialSearch ?? '')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportType, setExportType]     = useState<'pdf' | 'xlsx' | 'csv' | null>(null) // ── ADDED ──
  const [isArchiveView, setIsArchiveView]     = useState(false)
  const [currentPage, setCurrentPage]         = useState(1)
  const itemsPerPage = 10
  const [showToast, setShowToast]   = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isError, setIsError]           = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction | ''; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedTx, setSelectedTx]       = useState<Transaction | null>(null)
  const [activeTab, setActiveTab]         = useState<'invoice' | 'delivery'>('invoice')
  const [statusFilter, setStatusFilter] = useState<'all' | 'cash' | 'e-wallet' | 'card'>('all')
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false)

  useEffect(() => { if (initialSearch) setSearchTerm(initialSearch) }, [initialSearch])

  const getDateRangeLabel = () => {
    if (!fromDate && !toDate) return 'Date Range'
    if (fromDate && toDate) return `${fromDate} to ${toDate}`
    if (fromDate) return `From ${fromDate}`
    if (toDate) return `Until ${toDate}`
    return 'Date Range'
  }

  const handleClearDateFilter = () => {
    setFromDate('')
    setToDate('')
    setCurrentPage(1)
  }

  const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null
  // Handle YYYY-MM-DD (from date input)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }
  // Handle MM/DD/YY (from transactions)
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    const year = parseInt(parts[2]) + 2000
    return new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]))
  }
  return null
}

  const isDateInRange = (txDate: string): boolean => {
    if (!fromDate && !toDate) return true
    const tx = parseDate(txDate)
    if (!tx) return true
    if (fromDate) {
      const from = parseDate(fromDate)
      if (from && tx < from) return false
    }
    if (toDate) {
      const to = parseDate(toDate)
      if (to && tx > to) return false
    }
    return true
  }

  const getStatusBadgeColor = (status: 'all' | 'cash' | 'e-wallet' | 'card') => {
  switch(status) {
    case 'cash': return '#10b981'
    case 'e-wallet': return '#3b82f6'
    case 'card': return '#8b5cf6'
    case 'all': return '#9ca3af'
    default: return '#9ca3af'
  }
}

  const getStatusLabel = (status: 'all' | 'cash' | 'e-wallet' | 'card') => {
  switch(status) {
    case 'cash': return 'Cash'
    case 'e-wallet': return 'E-Wallet'
    case 'card': return 'Card'
    case 'all': return 'All Methods'
    default: return 'All Methods'
  }
}

  const handleExportSuccess = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg); setIsError(type === 'error'); setShowToast(true)
  }

  const fetchSalesData = async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true)
      const t = new Date().getTime()
      const [summaryRes, transRes] = await Promise.all([
        fetch(`/api/sales/summary?t=${t}`, { cache: 'no-store' }),
        fetch(`/api/sales/transactions?t=${t}`, { cache: 'no-store' })
      ])
      if (summaryRes.ok && transRes.ok) {
        setSummary(await summaryRes.json())
        setTransactions(await transRes.json())
      }
    } catch (error) { console.error('Error:', error) }
    finally { if (!isBackground) setIsLoading(false) }
  }

  useEffect(() => { fetchSalesData() }, [])

  const handleTogglePaymentStatus = async (tx: Transaction) => {
    if (!tx.paymentMethod?.toLowerCase().includes('bank')) return
    if (tx.status === 'INACTIVE' || tx.is_archived) return
    try {
      const response = await fetch(`/api/sales/toggle-status/${tx.no}`, { method: 'PUT' })
      if (response.ok) { const data = await response.json(); handleExportSuccess(data.message, 'success'); await fetchSalesData(true) }
      else { const errorData = await response.json(); handleExportSuccess(errorData.error || 'Failed to update status.', 'error') }
    } catch { handleExportSuccess('Network error. Is Flask running?', 'error') }
  }

  const handleToggleArchive = async (txNo: string) => {
    try {
      const response = await fetch(`/api/sales/archive/${txNo}`, { method: 'PUT' })
      if (response.ok) {
        const data = await response.json()
        setTransactions(prev => prev.map(tx => tx.no === txNo ? { ...tx, is_archived: data.is_archived, status: data.new_status } : tx))
        handleExportSuccess(data.is_archived ? 'Moved to Archive' : 'Restored from Archive', 'success')
        await fetchSalesData(true)
      } else { handleExportSuccess('Failed to update archive status.', 'error') }
    } catch { handleExportSuccess('Network error. Is Flask running?', 'error') }
  }

  const handleOpenView = async (tx: Transaction) => {
    setSelectedTx(tx); setActiveTab('invoice'); setShowViewModal(true)
    try {
      const res = await fetch(`/api/orders/list`)
      if (!res.ok) return
      const orders = await res.json()
      const matched =
        orders.find((o: any) => o.customer?.toLowerCase() === tx.name?.toLowerCase() && o.date === tx.date) ||
        orders.find((o: any) => o.customer?.toLowerCase() === tx.name?.toLowerCase())
      if (!matched || !matched.items?.length) return
      const totalQty = matched.items.reduce((sum: number, i: any) => sum + i.order_quantity, 0) || 1
      const unitCost = tx.amount / totalQty
      setSelectedTx(prev => prev ? {
        ...prev,
        registeredName: prev.registeredName || matched.customer,
        address: prev.address || matched.address,
        contact: prev.contact || matched.contact || '—',
        items: matched.items.map((i: any) => ({
          description: i.item_name || `Item #${i.inventory_id}`,
          qty: i.order_quantity, unit: i.uom || i.item_status || 'PCS',
          unitCost: parseFloat(unitCost.toFixed(2)),
          amount: parseFloat((unitCost * i.order_quantity).toFixed(2)),
        })),
      } : null)
    } catch (e) { console.error('Could not fetch item details from orders:', e) }
  }

  const closeViewModal = () => { setShowViewModal(false); setSelectedTx(null) }

  const filteredTx = transactions.filter(tx => {
    console.log('tx.date:', tx.date);
    const matchesArchiveView = isArchiveView ? tx.is_archived === true : !tx.is_archived
    const searchStr = `${tx.no} ${tx.name} ${tx.address} ${tx.paymentMethod || ''}`.toLowerCase()
    const matchesStatus = statusFilter === 'all' || 
    tx.paymentMethod?.toLowerCase().includes(statusFilter.toLowerCase())
    const matchesDateRange = isDateInRange(tx.date)
    return matchesArchiveView && searchStr.includes(searchTerm.toLowerCase()) && matchesStatus && matchesDateRange
  })

  const requestSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const sortedTx = useMemo(() => {
    const arr = [...filteredTx]
    if (!sortConfig.key || !sortConfig.direction) return arr
    const key = sortConfig.key as keyof Transaction
    return arr.sort((a, b) => {
      const A = a[key]; const B = b[key]
      if (key === 'qty' || key === 'amount') {
        return sortConfig.direction === 'asc' ? (Number(A) || 0) - (Number(B) || 0) : (Number(B) || 0) - (Number(A) || 0)
      }
      const strA = String(A ?? '').toLowerCase(); const strB = String(B ?? '').toLowerCase()
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredTx, sortConfig])

  const totalPages  = Math.ceil(sortedTx.length / itemsPerPage)
  const paginatedTx = sortedTx.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  if (isLoading) return <div className={s.loadingContainer}>Connecting to database...</div>

  const safeSummary = summary || {
    totalSales: 0, totalSalesChange: 0, weeklySales: 0, monthlySales: 0,
    yearlySales: 0, topClientName: 'None', topClientSales: 0, topClientChange: 0
  }

  const vatRate  = 0.12
  const totalAmt = selectedTx?.amount ?? 0
  const lessVat  = totalAmt - totalAmt / (1 + vatRate)
  const netOfVat = totalAmt / (1 + vatRate)

  const renderPageNumbers = () => {
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - 2)
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1)
    const pages = []
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button key={i} className={currentPage === i ? s.pageCircleActive : s.pageCircle} onClick={() => setCurrentPage(i)}>
          {i}
        </button>
      )
    }
    return pages
  }

  const renderGrowthPill = (value: number) => {
    let icon = '—'; // Neutral dash
    let textColor = '#ca8a04'; // Yellow-600
    let bgColor = '#fef08a'; // Yellow-200

    if (value > 0) {
      icon = '↗';
      textColor = '#15803d'; // Green-700
      bgColor = '#dcfce7'; // Green-100
    } else if (value < 0) {
      icon = '↘';
      textColor = '#b91c1c'; // Red-700
      bgColor = '#fee2e2'; // Red-100
    }

    // Use Math.abs so it shows "↘ 92.6%" instead of "↘ -92.6%"
    const displayValue = Math.abs(value);

    return (
      <span 
        className={s.pill} 
        style={{ 
          color: textColor, 
          backgroundColor: bgColor,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {icon} {displayValue}%
      </span>
    );
  }

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {showToast && (
        <div className={s.toastOverlay} style={{ zIndex: 10000 }}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>{isError ? '!' : '✓'}</div>
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

        {/* ── HEADER ROW ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', margin: 0 }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>SALES</h1>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
              Track, manage, and export all sales transactions and invoices.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {canExport && (
              <ExportButton onSelect={(type) => {
                setExportType(type)
                setShowExportModal(true)
              }} />
            )}
            {mustRequestExport && (
              <button
                onClick={() => setShowExportRequestModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#475569', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                Request Export
              </button>
            )}
          </div>
        </div>{/* ── END HEADER ROW ── */}

        {/* Summary Cards */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Sales</p>
            <h2 className={s.bigNumber}>₱ {safeSummary.totalSales.toLocaleString()}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              {/* Replaced static pill with dynamic function */}
              {renderGrowthPill(safeSummary.totalSalesChange)}
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
            <div className={s.cardFooter}>
              <span className={s.subText}>{safeSummary.topClientName}</span>
              {/* ✅ Replaced static pill with dynamic function */}
              {renderGrowthPill(safeSummary.topClientChange)}
            </div>
          </section>
        </div>

        {isArchiveView ? (
          <ArchiveTable transactions={transactions} onRestore={handleToggleArchive} onBack={() => setIsArchiveView(false)} />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h1 className={s.title}>Transactions</h1>
              <div className={s.controls}>
                <div className={s.dateFilterContainer}>
                  <button
                    className={`${s.dateFilterTrigger} ${isDateFilterOpen ? s.dateFilterTriggerOpen : ''} ${(fromDate || toDate) ? s.dateFilterTriggerActive : ''}`}
                    onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span className={s.dateFilterLabel}>{getDateRangeLabel()}</span>
                    <svg className={`${s.dateFilterChevron} ${isDateFilterOpen ? s.dateFilterChevronOpen : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {isDateFilterOpen && (
                    <div className={s.dateFilterMenu}>
                      <div className={s.dateFilterInputGroup}>
                        <label htmlFor="fromDate" className={s.dateFilterLabel}>From</label>
                        <input
                          id="fromDate"
                          type="date"
                          value={fromDate}
                          onChange={e => { setFromDate(e.target.value); setCurrentPage(1) }}
                          className={s.dateFilterInput}
                        />
                      </div>
                      <div className={s.dateFilterInputGroup}>
                        <label htmlFor="toDate" className={s.dateFilterLabel}>To</label>
                        <input
                          id="toDate"
                          type="date"
                          value={toDate}
                          onChange={e => { setToDate(e.target.value); setCurrentPage(1) }}
                          className={s.dateFilterInput}
                        />
                      </div>
                      {(fromDate || toDate) && (
                        <button className={s.dateFilterClear} onClick={handleClearDateFilter}>
                          Clear Dates
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className={s.statusFilterContainer}>
                  <button
                    className={`${s.statusFilterTrigger} ${isStatusDropdownOpen ? s.statusFilterTriggerOpen : ''}`}
                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  >
                    <span className={s.statusBadge} style={{ backgroundColor: getStatusBadgeColor(statusFilter) }}></span>
                    <span className={s.statusFilterLabel}>{getStatusLabel(statusFilter)}</span>
                    <svg className={`${s.statusFilterChevron} ${isStatusDropdownOpen ? s.statusFilterChevronOpen : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {isStatusDropdownOpen && (
                    <div className={s.statusFilterMenu}>
                     {(['all', 'cash', 'e-wallet', 'card'] as const).map(option => (   <button
                          key={option}
                          className={`${s.statusFilterMenuItem} ${statusFilter === option ? s.statusFilterMenuItemActive : ''}`}
                          onClick={() => {
                            setStatusFilter(option)
                            setIsStatusDropdownOpen(false)
                            setCurrentPage(1)
                          }}
                        >
                          <span className={s.statusMenuBadge} style={{ backgroundColor: getStatusBadgeColor(option) }}></span>
                          <span>{getStatusLabel(option)}</span>
                          {statusFilter === option && <svg className={s.statusFilterCheckmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives"><LuArchive size={20} /></button>
                <div className={s.searchWrapper}>
                  <LuSearch size={18} className={s.searchIcon} />
                  <input className={s.searchInput} placeholder="Search by No. or by Name" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }} />
                </div>
              </div>
            </div>

            <div className={s.tableResponsive}>
              <table className={s.table}>
                <thead>
                  <tr>
                    {[
                      { label: 'No.', key: 'no' }, { label: 'NAME', key: 'name' },
                      { label: 'ADDRESS', key: 'address' }, { label: 'DATE', key: 'date' },
                      { label: 'QTY', key: 'qty' }, { label: 'AMOUNT', key: 'amount' },
                      { label: 'PAYMENT', key: 'paymentMethod' }, { label: 'STATUS', key: 'status' }
                    ].map(col => {
                      const isSortable = col.key === 'no' || col.key === 'name'
                      return (
                        <th key={col.key} onClick={() => isSortable && requestSort(col.key as keyof Transaction)} style={{ cursor: isSortable ? 'pointer' : 'default' }}>
                          <div className={isSortable ? s.sortableHeader : s.nonSortableHeader}>
                            <span>{col.label}</span>
                            {isSortable && (
                              <div className={s.sortIconsStack}>
                                <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                                <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                              </div>
                            )}
                          </div>
                        </th>
                      )
                    })}
                    <th className={s.actionHeader}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTx.map((tx, i) => {
                    const isBank = tx.paymentMethod?.toLowerCase().includes('bank')
                    return (
                      <tr key={tx.no} className={i % 2 !== 0 ? s.rowOdd : ''} onClick={() => handleOpenView(tx)} style={{ cursor: 'pointer' }}>
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
                            style={{ cursor: isBank ? 'pointer' : 'default', textDecoration: isBank && tx.status === 'PENDING' ? 'underline' : 'none', transition: 'all 0.2s' }}
                            onClick={e => { e.stopPropagation(); handleTogglePaymentStatus(tx) }}
                            title={isBank ? 'Click to toggle payment status' : 'Non-bank payments process automatically'}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className={s.actionCell} onClick={e => e.stopPropagation()}>
                          <div className={s.actionWrapper}>
                            <button className={s.archiveBtn} onClick={() => handleToggleArchive(tx.no)}>
                              <LuArchive size={16} /><span>Archive</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className={s.footer}>
              <div className={s.showDataText}>
                Showing <span className={s.countBadge}>{paginatedTx.length}</span> of {filteredTx.length}
              </div>
              <div className={s.pagination}>
                <button className={s.nextBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><LuChevronLeft /></button>
                {renderPageNumbers()}
                <button className={s.nextBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><LuChevronRight /></button>
              </div>
            </div>
          </div>
        )}
      </main>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => { setShowExportModal(false); setExportType(null) }}
        onSuccess={handleExportSuccess}
        data={transactions.filter(tx => !tx.is_archived)}
        summary={safeSummary}
        exportType={exportType}
      />

      <ExportRequestModal
        isOpen={showExportRequestModal}
        onClose={() => setShowExportRequestModal(false)}
        targetModule="Sales"
        requesterId={employeeId}
        onSuccess={(msg, type) => handleExportSuccess(msg, type)}
      />

      {showViewModal && selectedTx && (
        <div className={s.viewBackdrop} onClick={closeViewModal}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()}>
            <div className={s.viewModalHeader}>
              <div className={s.viewModalHeaderLeft}>
                <h2 className={s.viewCompanyName}>AE Samonte Merchandise</h2>
                <p className={s.viewOrderNumber}>No. {selectedTx.no}</p>
              </div>
              <div className={s.viewModalHeaderRight}>
                <span className={selectedTx.status === 'PAID' ? s.viewStatusPaid : s.viewStatusPending}>{selectedTx.status}</span>
                <button className={s.viewCloseBtn} onClick={closeViewModal}><LuX size={20} /></button>
              </div>
            </div>

            <div className={s.viewDateRow}>DATE: {selectedTx.date}</div>

            <div className={s.viewTabs}>
              <button className={`${s.viewTab} ${activeTab === 'invoice' ? s.viewTabActive : ''}`} onClick={() => setActiveTab('invoice')}>Sales Invoice</button>
              <button className={`${s.viewTab} ${activeTab === 'delivery' ? s.viewTabActive : ''}`} onClick={() => setActiveTab('delivery')}>Delivery Receipt</button>
            </div>

            <div className={s.viewPrintBody}>
              {activeTab === 'invoice' && (
                <>
                  <div className={s.viewCustomerSection}>
                    <p className={s.viewSectionTitle}>CUSTOMER DETAILS</p>
                    <div className={s.viewCustomerGrid}>
                      <div><p className={s.viewInfoLabel}>Contact Number</p><p className={s.viewInfoValue}>{selectedTx.contact || '—'}</p></div>
                      <div><p className={s.viewInfoLabel}>Address</p><p className={s.viewInfoValue}>{selectedTx.address}</p></div>
                      <div><p className={s.viewInfoLabel}>Payment Method</p><p className={s.viewInfoValue}>{selectedTx.paymentMethod}</p></div>
                    </div>
                  </div>
                  <table className={s.viewItemsTable}>
                    <thead><tr><th>ITEM DESCRIPTION</th><th>QTY</th><th>UNIT COST</th><th>AMOUNT</th></tr></thead>
                    <tbody>
                      {selectedTx.items && selectedTx.items.length > 0 ? (
                        selectedTx.items.map((item, idx) => (
                          <tr key={idx}>
                            <td><p className={s.viewItemName}>{item.description}</p>{item.unit && <p className={s.viewItemUnit}>{item.unit}</p>}</td>
                            <td>{item.qty}</td>
                            <td>₱ {item.unitCost.toFixed(2)}</td>
                            <td>₱ {item.amount.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className={s.viewEmptyRow}><td colSpan={4}>No item details available</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div className={s.viewTotalsWrapper}>
                    <div className={s.viewTotalsBox}>
                      <div className={s.viewTotalLine}><span>VATable Sales</span><span>₱ {netOfVat.toFixed(2)}</span></div>
                      <div className={s.viewTotalLine}><span>VAT Amount (12%)</span><span>₱ {lessVat.toFixed(2)}</span></div>
                      <div className={s.viewTotalFinal}><span>Total</span><span>₱ {totalAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'delivery' && (
                <>
                  <div className={s.viewCustomerSection}>
                    <p className={s.viewSectionTitle}>DELIVERY DETAILS</p>
                    <div className={s.viewCustomerGrid}>
                      <div><p className={s.viewInfoLabel}>Delivered To</p><p className={s.viewInfoValue}>{selectedTx.registeredName || selectedTx.name}</p></div>
                      <div><p className={s.viewInfoLabel}>Address</p><p className={s.viewInfoValue}>{selectedTx.address}</p></div>
                      <div><p className={s.viewInfoLabel}>P.O. No.</p><p className={s.viewInfoValue}>{selectedTx.poNo || '—'}</p></div>
                    </div>
                  </div>
                  <table className={s.viewItemsTable}>
                    <thead><tr><th>ITEM</th><th>QTY</th><th>UNIT</th><th>ARTICLES / PARTICULARS</th></tr></thead>
                    <tbody>
                      {selectedTx.items && selectedTx.items.length > 0 ? (
                        selectedTx.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td><td>{item.qty}</td><td>{item.unit || 'PCS'}</td>
                            <td style={{ textAlign: 'left' }}><p className={s.viewItemName}>{item.description}</p></td>
                          </tr>
                        ))
                      ) : (
                        <tr className={s.viewEmptyRow}><td colSpan={4}>No item details available</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className={s.viewModalFooter}>
              <button className={s.viewBtnPrint} onClick={() => activeTab === 'invoice' ? printSalesInvoice(selectedTx) : printDeliveryReceipt(selectedTx)}>
                <LuPrinter size={15} />
                Print {activeTab === 'invoice' ? 'Invoice' : 'Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}