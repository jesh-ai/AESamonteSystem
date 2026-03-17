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
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuArchive,
  LuX,
  LuPrinter
} from 'react-icons/lu'
import { printSalesInvoice, printDeliveryReceipt } from './salesPrint'

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
  tin?: string
  contact?: string
  poNo?: string
  terms?: string
  registeredName?: string
  items?: TransactionItem[]
}

interface TransactionItem {
  description: string
  qty: number
  unit: string
  unitCost: number
  amount: number
}

interface SalesProps {
  role?: string
  department?: string | null
  employeeId?: number
  onLogout: () => void
  initialSearch?: string
}

export default function SalesPage({ role = 'Admin', department, employeeId = 0, onLogout, initialSearch }: SalesProps) {
  const s = styles as Record<string, string>

  const isSalesHead       = role === 'Head' && department === 'Sales'
  const isInventoryHead   = role === 'Head' && department === 'Inventory'
  const canExport         = ['Admin', 'Manager'].includes(role) || isSalesHead
  const mustRequestExport = isInventoryHead

  const [showExportRequestModal, setShowExportRequestModal] = useState(false)
  const [summary, setSummary]           = useState<SalesSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [searchTerm, setSearchTerm]     = useState(initialSearch ?? '')

  useEffect(() => {
    if (initialSearch) setSearchTerm(initialSearch)
  }, [initialSearch])
  const [showExportModal, setShowExportModal] = useState(false)
  const [isArchiveView, setIsArchiveView]     = useState(false)
  const [currentPage, setCurrentPage]         = useState(1)
  const itemsPerPage = 10
  const [showToast, setShowToast]       = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isError, setIsError]           = useState(false)

  const [sortConfig, setSortConfig] = useState<{
    key: keyof Transaction | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedTx, setSelectedTx]       = useState<Transaction | null>(null)
  const [activeTab, setActiveTab]         = useState<'invoice' | 'delivery'>('invoice')

  /* ================= HANDLERS ================= */

  const handleExportSuccess = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg)
    setIsError(type === 'error')
    setShowToast(true)
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
    } catch (error) {
      console.error('Error:', error)
    } finally {
      if (!isBackground) setIsLoading(false)
    }
  }

  useEffect(() => { fetchSalesData() }, [])

  const handleTogglePaymentStatus = async (tx: Transaction) => {
    if (!tx.paymentMethod?.toLowerCase().includes('bank')) return
    if (tx.status === 'INACTIVE' || tx.is_archived) return
    try {
      const response = await fetch(`/api/sales/toggle-status/${tx.no}`, { method: 'PUT' })
      if (response.ok) {
        const data = await response.json()
        handleExportSuccess(data.message, 'success')
        await fetchSalesData(true)
      } else {
        const errorData = await response.json()
        handleExportSuccess(errorData.error || 'Failed to update status.', 'error')
      }
    } catch {
      handleExportSuccess('Network error. Is Flask running?', 'error')
    }
  }

  const handleToggleArchive = async (txNo: string) => {
    try {
      const response = await fetch(`/api/sales/archive/${txNo}`, { method: 'PUT' })
      if (response.ok) {
        const data = await response.json()
        setTransactions(prev =>
          prev.map(tx => tx.no === txNo ? { ...tx, is_archived: data.is_archived, status: data.new_status } : tx)
        )
        handleExportSuccess(data.is_archived ? 'Moved to Archive' : 'Restored from Archive', 'success')
        await fetchSalesData(true)
      } else {
        handleExportSuccess('Failed to update archive status.', 'error')
      }
    } catch {
      handleExportSuccess('Network error. Is Flask running?', 'error')
    }
  }

  const handleOpenView = async (tx: Transaction) => {
    setSelectedTx(tx)
    setActiveTab('invoice')
    setShowViewModal(true)

    try {
      const res = await fetch(`/api/orders/list`)
      if (!res.ok) return
      const orders = await res.json()

      const matched =
        orders.find((o: any) =>
          o.customer?.toLowerCase() === tx.name?.toLowerCase() && o.date === tx.date
        ) ||
        orders.find((o: any) =>
          o.customer?.toLowerCase() === tx.name?.toLowerCase()
        )

      if (!matched || !matched.items?.length) return

      const totalQty = matched.items.reduce((sum: number, i: any) => sum + i.order_quantity, 0) || 1
      const unitCost = tx.amount / totalQty

      setSelectedTx(prev =>
        prev ? {
          ...prev,
          registeredName: prev.registeredName || matched.customer,
          address:        prev.address        || matched.address,
          contact:        prev.contact        || matched.contact || '—',
          items: matched.items.map((i: any) => ({
            description: i.item_name || `Item #${i.inventory_id}`,
            qty:         i.order_quantity,
            unit:        i.uom || i.item_status || 'PCS',
            unitCost:    parseFloat(unitCost.toFixed(2)),
            amount:      parseFloat((unitCost * i.order_quantity).toFixed(2)),
          })),
        } : null
      )
    } catch (e) {
      console.error('Could not fetch item details from orders:', e)
    }
  }

  const closeViewModal = () => {
    setShowViewModal(false)
    setSelectedTx(null)
  }

  /* ================= FILTER + SORT + PAGINATION ================= */

  const filteredTx = transactions.filter(tx => {
    const matchesArchiveView = isArchiveView ? tx.is_archived === true : !tx.is_archived
    const searchStr = `${tx.no} ${tx.name} ${tx.address} ${tx.paymentMethod || ''}`.toLowerCase()
    return matchesArchiveView && searchStr.includes(searchTerm.toLowerCase())
  })

  // 1. Updated requestSort to toggle automatically
  const requestSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // 2. Updated sorting logic to handle all data and parse numbers perfectly
  const sortedTx = useMemo(() => {
    const arr = [...filteredTx];
    if (!sortConfig.key || !sortConfig.direction) {
      return arr; // Default order
    }
    
    const key = sortConfig.key as keyof Transaction;
    return arr.sort((a, b) => {
      const A = a[key];
      const B = b[key];
      
      // Explicitly convert QTY and AMOUNT to numbers so they don't sort alphabetically
      if (key === 'qty' || key === 'amount') {
        const numA = Number(A) || 0;
        const numB = Number(B) || 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }
      
      // Handle String Columns (NAME, ADDRESS, STATUS, etc)
      const strA = String(A ?? '').toLowerCase();
      const strB = String(B ?? '').toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTx, sortConfig]);

  const totalPages  = Math.ceil(sortedTx.length / itemsPerPage)
  const startIndex  = (currentPage - 1) * itemsPerPage
  const paginatedTx = sortedTx.slice(startIndex, startIndex + itemsPerPage)

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', margin: 0 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>SALES</h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
            Track, manage, and export all sales transactions and invoices.
          </p>
        </div>
          {canExport && (
            <div onClick={() => setShowExportModal(true)}>
              <ExportButton />
            </div>
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
            <div className={s.cardFooter}>
              <span className={s.subText}>{safeSummary.topClientName}</span>
              <span className={s.pill}>↗ {safeSummary.topClientChange}%</span>
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
                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives"><LuArchive size={20} /></button>
                <div className={s.searchWrapper}>
                  <input className={s.searchInput} placeholder="Search..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }} />
                  <LuSearch size={18} />
                </div>
              </div>
            </div>

            <div className={s.tableResponsive}>
              <table className={s.table}>
                <thead>
                  <tr>
                    {[
                      { label: 'No.',     key: 'no' },
                      { label: 'NAME',    key: 'name' },
                      { label: 'ADDRESS', key: 'address' },
                      { label: 'DATE',    key: 'date' },
                      { label: 'QTY',     key: 'qty' },
                      { label: 'AMOUNT',  key: 'amount' },
                      { label: 'PAYMENT', key: 'paymentMethod' },
                      { label: 'STATUS',  key: 'status' }
                    ].map((col) => (
                      <th key={col.key} onClick={() => requestSort(col.key as keyof Transaction)}>
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
        )}
      </main>

      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onSuccess={handleExportSuccess} data={transactions.filter(tx => !tx.is_archived)} summary={safeSummary} />
      <ExportRequestModal isOpen={showExportRequestModal} onClose={() => setShowExportRequestModal(false)} targetModule="Sales" requesterId={employeeId} onSuccess={(msg) => handleExportSuccess(msg, 'success')} />

      {/* ===== VIEW MODAL ===== */}
      {showViewModal && selectedTx && (
        <div className={s.viewBackdrop} onClick={closeViewModal}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()}>

            {/* ── HEADER ── */}
            <div className={s.viewModalHeader}>
              <div className={s.viewModalHeaderLeft}>
                <h2 className={s.viewCompanyName}>AE Samonte Merchandise</h2>
                <p className={s.viewOrderNumber}>No. {selectedTx.no}</p>
              </div>
              <div className={s.viewModalHeaderRight}>
                <span className={selectedTx.status === 'PAID' ? s.viewStatusPaid : s.viewStatusPending}>
                  {selectedTx.status}
                </span>
                <button className={s.viewCloseBtn} onClick={closeViewModal}>
                  <LuX size={20} />
                </button>
              </div>
            </div>

            {/* ── DATE ROW ── */}
            <div className={s.viewDateRow}>DATE: {selectedTx.date}</div>

            {/* ── TABS ── */}
            <div className={s.viewTabs}>
              <button
                className={`${s.viewTab} ${activeTab === 'invoice' ? s.viewTabActive : ''}`}
                onClick={() => setActiveTab('invoice')}
              >
                Sales Invoice
              </button>
              <button
                className={`${s.viewTab} ${activeTab === 'delivery' ? s.viewTabActive : ''}`}
                onClick={() => setActiveTab('delivery')}
              >
                Delivery Receipt
              </button>
            </div>

            {/* ── SCROLLABLE BODY ── */}
            <div className={s.viewPrintBody}>

              {/* SALES INVOICE TAB */}
              {activeTab === 'invoice' && (
                <>
                  {/* Customer Details */}
                  <div className={s.viewCustomerSection}>
                    <p className={s.viewSectionTitle}>CUSTOMER DETAILS</p>
                    <div className={s.viewCustomerGrid}>
                      <div>
                        <p className={s.viewInfoLabel}>Contact Number</p>
                        <p className={s.viewInfoValue}>{selectedTx.contact || '—'}</p>
                      </div>
                      <div>
                        <p className={s.viewInfoLabel}>Address</p>
                        <p className={s.viewInfoValue}>{selectedTx.address}</p>
                      </div>
                      <div>
                        <p className={s.viewInfoLabel}>Payment Method</p>
                        <p className={s.viewInfoValue}>{selectedTx.paymentMethod}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className={s.viewItemsTable}>
                    <thead>
                      <tr>
                        <th>ITEM DESCRIPTION</th>
                        <th>QTY</th>
                        <th>UNIT COST</th>
                        <th>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTx.items && selectedTx.items.length > 0 ? (
                        selectedTx.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <p className={s.viewItemName}>{item.description}</p>
                              {item.unit && <p className={s.viewItemUnit}>{item.unit}</p>}
                            </td>
                            <td>{item.qty}</td>
                            <td>₱ {item.unitCost.toFixed(2)}</td>
                            <td>₱ {item.amount.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className={s.viewEmptyRow}>
                          <td colSpan={4}>No item details available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className={s.viewTotalsWrapper}>
                    <div className={s.viewTotalsBox}>
                      <div className={s.viewTotalLine}>
                        <span>VATable Sales</span>
                        <span>₱ {netOfVat.toFixed(2)}</span>
                      </div>
                      <div className={s.viewTotalLine}>
                        <span>VAT Amount (12%)</span>
                        <span>₱ {lessVat.toFixed(2)}</span>
                      </div>
                      <div className={s.viewTotalFinal}>
                        <span>Total</span>
                        <span>₱ {totalAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* DELIVERY RECEIPT TAB */}
              {activeTab === 'delivery' && (
                <>
                  <div className={s.viewCustomerSection}>
                    <p className={s.viewSectionTitle}>DELIVERY DETAILS</p>
                    <div className={s.viewCustomerGrid}>
                      <div>
                        <p className={s.viewInfoLabel}>Delivered To</p>
                        <p className={s.viewInfoValue}>{selectedTx.registeredName || selectedTx.name}</p>
                      </div>
                      <div>
                        <p className={s.viewInfoLabel}>Address</p>
                        <p className={s.viewInfoValue}>{selectedTx.address}</p>
                      </div>
                      <div>
                        <p className={s.viewInfoLabel}>P.O. No.</p>
                        <p className={s.viewInfoValue}>{selectedTx.poNo || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <table className={s.viewItemsTable}>
                    <thead>
                      <tr>
                        <th>ITEM</th>
                        <th>QTY</th>
                        <th>UNIT</th>
                        <th>ARTICLES / PARTICULARS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTx.items && selectedTx.items.length > 0 ? (
                        selectedTx.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{item.qty}</td>
                            <td>{item.unit || 'PCS'}</td>
                            <td style={{ textAlign: 'left' }}>
                              <p className={s.viewItemName}>{item.description}</p>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className={s.viewEmptyRow}>
                          <td colSpan={4}>No item details available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {/* ── FOOTER ── */}
            <div className={s.viewModalFooter}>
              <button
                className={s.viewBtnPrint}
                onClick={() => activeTab === 'invoice' ? printSalesInvoice(selectedTx) : printDeliveryReceipt(selectedTx)}
              >
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