/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import styles from "@/css/reports.module.css";
import exportStyles from "../../css/exportReports.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from "@/components/features/ExportButton";
import ExportReportsModal from './exportReports';

interface SalesReportData {
  weekly: number;
  monthly: number;
  yearly: number;
}

interface InventoryReportData {
  weekly: number;
  monthly: number;
  yearly: number;
}

interface ExtraReportData {
  totals: {
    orders: number;
    ordersGrowth: number;
    sales: number;
    salesGrowth: number;
  };
  topClients: {
    name: string;
    orders: number;
    percentage: number;
  }[];
  mostStock: {
    name: string;
    qty: number;
    percentage: number;
  }[];
  yearlyHistory: {
    year: number;
    sales: number;
    percentage: number;
  }[];
}

const TOP_CLIENT_COLORS = ["#1e3a5f", "#ef4444", "#facc15"];

export default function ReportsPage({ role = "Admin", onLogout }: { role?: string; onLogout: () => void }) {
  const [salesData,     setSalesData]     = useState<SalesReportData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null);
  const [extraData,     setExtraData]     = useState<ExtraReportData | null>(null);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [toastMessage,    setToastMessage]    = useState('');
  const [isError,         setIsError]         = useState(false);
  const [showToast,       setShowToast]       = useState(false);

  const handleExportSuccess = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setIsError(type === 'error');
    setShowToast(true);
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const t = new Date().getTime();

        const salesRes = await fetch(`/api/reports/sales?t=${t}`, { cache: 'no-store' });
        if (salesRes.ok) setSalesData(await salesRes.json());
        else throw new Error("Failed to load sales report.");

        const extraRes = await fetch(`/api/reports/extra?t=${t}`, { cache: 'no-store' });
        if (extraRes.ok) setExtraData(await extraRes.json());
        else throw new Error("Failed to load extra report data.");

        try {
          const invRes = await fetch(`/api/inventory/summary?t=${t}`, { cache: 'no-store' });
          if (invRes.ok) {
            const data = await invRes.json();
            setInventoryData({ weekly: data.weekly || 0, monthly: data.monthly || 0, yearly: data.yearly || 0 });
          } else {
            setInventoryData({ weekly: 0, monthly: 0, yearly: 0 });
          }
        } catch {
          setInventoryData({ weekly: 0, monthly: 0, yearly: 0 });
        }

      } catch (e: any) {
        setErrorMsg(e.message || "Network error. Is Flask running?");
      }
    };

    fetchReports();
  }, []);

  const maxOrders = extraData && extraData.topClients.length > 0
    ? Math.max(...extraData.topClients.map(c => c.orders))
    : 100;

  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {/* ══════════ TOAST ══════════ */}
      {showToast && (
        <div className={exportStyles.toastBackdrop}>
          <div className={exportStyles.toastCard}>
            <div className={`${exportStyles.toastBand} ${isError ? exportStyles.toastBandError : exportStyles.toastBandSuccess}`}>
              <div className={exportStyles.toastIcon}>
                {isError ? (
                  <span className={exportStyles.toastIconExclaim}>!</span>
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className={exportStyles.toastBody}>
              <h2 className={exportStyles.toastTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={exportStyles.toastMessage}>{toastMessage}</p>
              <button
                onClick={() => setShowToast(false)}
                className={`${exportStyles.toastOkBtn} ${isError ? exportStyles.toastOkBtnError : exportStyles.toastOkBtnSuccess}`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={styles.mainContent}>

        {/* ── HEADER ROW: Title + Export ── */}
        <div className={styles.headerActions}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>REPORTS</h1>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
              View sales, inventory, and client performance data.
            </p>
          </div>
          <div>
            {['Admin', 'Manager'].includes(role ?? '') && (
              <div onClick={() => setShowExportModal(true)}>
                <ExportButton />
              </div>
            )}
          </div>
        </div>

        {errorMsg ? (
          <div style={{ color: '#ef4444', padding: '20px', backgroundColor: '#fee2e2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
            <strong>Database Error:</strong> {errorMsg}
          </div>
        ) : !salesData || !inventoryData || !extraData ? (
          <div style={{ color: '#64748b' }}>Loading Dashboard Data...</div>
        ) : (

          <div className={styles.reportsGrid}>

            {/* ── Row 1, Col 1 — Sales Report ── */}
            <div className={`${styles.reportCard} ${styles.salesCard}`}>
              <p className={styles.cardTitle}>Sales Report</p>
              <div className={styles.listGroup}>
                <div className={styles.listRow}>
                  <span className={styles.listLabel}>Weekly Sales</span>
                  <span className={styles.valRed}>{salesData.weekly.toLocaleString()}</span>
                </div>
                <div className={`${styles.listRow} ${styles.listRowAlt}`}>
                  <span className={styles.listLabel}>Monthly Sales</span>
                  <span className={styles.valBlue}>{salesData.monthly.toLocaleString()}</span>
                </div>
                <div className={styles.listRow}>
                  <span className={styles.listLabel}>Yearly Sales</span>
                  <span className={styles.valYellow}>{salesData.yearly.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* ── Row 1, Col 2 — Inventory Report ── */}
            <div className={`${styles.reportCard} ${styles.inventoryCard}`}>
              <p className={styles.cardTitle}>Inventory Report</p>
              <div className={styles.listGroup}>
                <div className={`${styles.listRow} ${styles.listRowAlt}`}>
                  <span className={styles.listLabel}>Weekly Inventory</span>
                  <span className={styles.valDark}>{inventoryData.weekly.toLocaleString()}</span>
                </div>
                <div className={styles.listRow}>
                  <span className={styles.listLabel}>Monthly Inventory</span>
                  <span className={styles.valDark}>{inventoryData.monthly.toLocaleString()}</span>
                </div>
                <div className={`${styles.listRow} ${styles.listRowAlt}`}>
                  <span className={styles.listLabel}>Yearly Inventory</span>
                  <span className={styles.valDark}>{inventoryData.yearly.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* ── Right column — Total Orders, Total Sales, Yearly Sales ── */}
            <div className={styles.rightColumn}>

              {/* Total Orders */}
              <div className={`${styles.reportCard} ${styles.totalOrdersCard}`}>
                <p className={styles.miniLabel}>Total Orders</p>
                <div className={styles.miniRow}>
                  <p className={`${styles.bigNum} ${styles.bigNumBlue}`}>
                    {extraData.totals.orders.toLocaleString()}
                  </p>
                  <div className={styles.growthWrap}>
                    <p className={styles.vsLabel}>vs last month</p>
                    <span className={`${styles.badge} ${extraData.totals.ordersGrowth >= 0 ? styles.badgeUp : styles.badgeDown}`}>
                      {extraData.totals.ordersGrowth >= 0 ? '↗' : '↘'} {Math.abs(extraData.totals.ordersGrowth)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Sales */}
              <div className={`${styles.reportCard} ${styles.totalSalesCard}`}>
                <p className={styles.miniLabel}>Total Sales</p>
                <div className={styles.miniRow}>
                  <p className={`${styles.bigNum} ${styles.bigNumYellow}`}>
                    <span style={{ fontSize: '1.5rem', marginRight: '4px' }}>₱</span>
                    {extraData.totals.sales.toLocaleString()}
                  </p>
                  <div className={styles.growthWrap}>
                    <p className={styles.vsLabel}>vs last month</p>
                    <span className={`${styles.badge} ${extraData.totals.salesGrowth >= 0 ? styles.badgeUp : styles.badgeDown}`}>
                      {extraData.totals.salesGrowth >= 0 ? '↗' : '↘'} {Math.abs(extraData.totals.salesGrowth)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Yearly Sales */}
              <div className={`${styles.reportCard} ${styles.yearlyCard}`}>
                <p className={styles.cardTitle}>Yearly Sales</p>
                <p className={styles.cardSubtitle}>Sales from the past years</p>
                <div className={styles.yrArea}>
                  {extraData.yearlyHistory.length > 0 ? extraData.yearlyHistory.map((item, i) => (
                    <div key={i} className={styles.yrRow}>
                      <span className={styles.yrLabel}>{item.year}</span>
                      <div className={styles.yrTrack}>
                        <div className={styles.yrFill} style={{ width: `${Math.max(item.percentage, 2)}%` }} />
                      </div>
                      <span className={styles.yrValue}>{item.sales.toLocaleString()}</span>
                    </div>
                  )) : <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No sales history available.</p>}
                </div>
              </div>

            </div>
            <div className={`${styles.reportCard} ${styles.topClientsCard}`}>
              <p className={styles.cardTitle}>Top Clients Ordered</p>
              <div className={styles.barArea}>
                {extraData.topClients.length > 0 ? extraData.topClients.map((client, i) => (
                  <div key={i} className={styles.barRow}>
                    <span className={styles.barLabel}>{client.name}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${Math.max(client.percentage, 2)}%`,
                          backgroundColor: TOP_CLIENT_COLORS[i % TOP_CLIENT_COLORS.length],
                        }}
                      />
                    </div>
                    <span style={{ width: '32px', textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: '0.88rem' }}>
                      {client.orders}
                    </span>
                  </div>
                )) : <p style={{ color: '#94a3b8' }}>No client data available.</p>}
                <div className={styles.barAxis}>
                  <span>0</span>
                  <span>{Math.ceil(maxOrders * 0.25)}</span>
                  <span>{Math.ceil(maxOrders * 0.50)}</span>
                  <span>{Math.ceil(maxOrders * 0.75)}</span>
                  <span>{maxOrders}</span>
                </div>
              </div>
            </div>

            {/* ── Row 3, Col 1–2 — Most Stock Items ── */}
            <div className={`${styles.reportCard} ${styles.mostStockCard}`}>
              <p className={styles.cardTitle}>Most Stock Items</p>
              <div className={styles.hbarArea}>
                {extraData.mostStock.length > 0 ? extraData.mostStock.map((item, i) => (
                  <div key={i} className={styles.hbarRow}>
                    <span className={styles.hbarLabel}>{item.name}</span>
                    <div className={styles.hbarTrack}>
                      <div className={styles.hbarFill} style={{ width: `${Math.max(item.percentage, 2)}%` }} />
                    </div>
                    <span className={styles.hbarPct}>{Math.round(item.percentage)}%</span>
                  </div>
                )) : <p style={{ color: '#94a3b8' }}>No inventory data available.</p>}
              </div>
            </div>


          </div>
        )}
      </main>

      {/* ── Export Reports Modal ── */}
      <ExportReportsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSuccess={handleExportSuccess}
        salesData={salesData}
        inventoryData={inventoryData}
        extraData={extraData}
      />

    </div>
  );
}