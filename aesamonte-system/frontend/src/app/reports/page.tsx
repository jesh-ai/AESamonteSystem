/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import styles from "@/css/reports.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from "@/components/features/ExportButton";

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

export default function ReportsPage({ role = "Admin", onLogout }: { role?: string, onLogout: () => void }) {
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null);
  const [extraData, setExtraData] = useState<ExtraReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const topClientColors = ["#1e3a5f", "#ef4444", "#facc15"];

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
             setInventoryData({
               weekly: data.weekly || 0,
               monthly: data.monthly || 0,
               yearly: data.yearly || 0
             });
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
    <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* THE FIX: flexShrink: 0 guarantees the header never gets cramped or squished! */}
      <div style={{ flexShrink: 0 }}>
        <TopHeader role={role} onLogout={onLogout} />
      </div>

      <main className={styles.mainContent} style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
        <div className={styles.headerActions} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '30px' }}>
          <ExportButton />
        </div>

        {errorMsg ? (
          <div style={{ color: '#ef4444', padding: '20px', backgroundColor: '#fee2e2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
            <strong>Database Error:</strong> {errorMsg}
          </div>
        ) : !salesData || !inventoryData || !extraData ? (
          <div style={{ color: '#64748b' }}>Loading Dashboard Data...</div>
        ) : (
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'stretch' }}>
            
            {/* ================= LEFT COLUMN ================= */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <section style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', fontWeight: 400, color: '#1e3a5f' }}>Sales Report</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px' }}>
                      <span style={{ color: '#475569', fontSize: '0.95rem' }}>Weekly Sales</span> 
                      <span style={{ color: '#ef4444', fontWeight: 500 }}>{salesData.weekly.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                      <span style={{ color: '#475569', fontSize: '0.95rem' }}>Monthly Sales</span> 
                      <span style={{ color: '#3b82f6', fontWeight: 500 }}>{salesData.monthly.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px' }}>
                      <span style={{ color: '#475569', fontSize: '0.95rem' }}>Yearly Sales</span> 
                      <span style={{ color: '#f59e0b', fontWeight: 500 }}>{salesData.yearly.toLocaleString()}</span>
                    </div>
                  </div>
                </section>

                <section style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', fontWeight: 400, color: '#1e3a5f' }}>Inventory Report</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                      <span style={{ color: '#475569', fontSize: '0.95rem' }}>Weekly Inventory</span>
                      <span style={{ color: '#333', fontWeight: 400 }}>{inventoryData.weekly.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px' }}>
                      <span style={{ color: '#475569', fontSize: '0.95rem' }}>Monthly Inventory</span>
                      <span style={{ color: '#333', fontWeight: 400 }}>{inventoryData.monthly.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                      <span style={{ color: '#475569', fontSize: '0.95rem' }}>Yearly Inventory</span>
                      <span style={{ color: '#333', fontWeight: 400 }}>{inventoryData.yearly.toLocaleString()}</span>
                    </div>
                  </div>
                </section>
              </div>

              <section style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '2.5rem', fontWeight: 400, color: '#1e3a5f' }}>Top Clients Ordered</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  {extraData.topClients.length > 0 ? extraData.topClients.map((client, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '15px', color: '#333', fontSize: '0.95rem' }}>
                        {client.name}
                      </span>
                      <div style={{ flex: 1, paddingRight: '15px' }}>
                         <div style={{ width: '100%', backgroundColor: '#f1f5f9', borderRadius: '6px', height: '32px', position: 'relative' }}>
                           <div style={{ 
                               width: `${Math.max(client.percentage, 2)}%`, 
                               backgroundColor: topClientColors[i % topClientColors.length], 
                               height: '100%', 
                               borderRadius: '6px',
                               transition: 'width 1s ease-in-out'
                             }} />
                         </div>
                      </div>
                      <span style={{ width: '40px', textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: '0.95rem' }}>
                        {client.orders}
                      </span>
                    </div>
                  )) : <p style={{color: '#94a3b8'}}>No client data available.</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '120px', paddingRight: '55px', marginTop: '10px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <span>0</span>
                    <span>{Math.ceil(maxOrders * 0.25)}</span>
                    <span>{Math.ceil(maxOrders * 0.50)}</span>
                    <span>{Math.ceil(maxOrders * 0.75)}</span>
                    <span>{maxOrders}</span>
                  </div>
                </div>
              </section>

              <section style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '2.5rem', fontWeight: 400, color: '#1e3a5f' }}>Most Stock Items</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
                  {extraData.mostStock.length > 0 ? extraData.mostStock.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '15px', color: '#333', fontSize: '0.95rem' }}>
                        {item.name}
                      </span>
                      <div style={{ flex: 1, paddingRight: '15px', display: 'flex', alignItems: 'center' }}>
                         <div style={{ 
                           width: `${Math.max(item.percentage, 2)}%`, 
                           backgroundColor: '#1e63a3', 
                           height: '16px', 
                           borderRadius: '8px',
                           transition: 'width 1s ease-in-out'
                         }} />
                      </div>
                      <span style={{ width: '40px', textAlign: 'right', fontWeight: 400, color: '#475569', fontSize: '0.95rem' }}>
                        {Math.round(item.percentage)}%
                      </span>
                    </div>
                  )) : <p style={{color: '#94a3b8'}}>No inventory data available.</p>}
                </div>
              </section>
            </div>

            {/* ================= RIGHT COLUMN ================= */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
              
              <div style={{ backgroundColor: '#fff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 400, color: '#1e3a5f', margin: '0' }}>Total Orders</h3>
                <div style={{ fontSize: '2.4rem', color: '#1e40af', fontWeight: 300, lineHeight: 1, margin: '16px 0' }}>
                  {extraData.totals.orders.toLocaleString()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>vs last month</span>
                  <span style={{ backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', padding: '2px 8px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {extraData.totals.ordersGrowth >= 0 ? '↗' : '↘'} {Math.abs(extraData.totals.ordersGrowth)}%
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 400, color: '#1e3a5f', margin: '0' }}>Total Sales</h3>
                <div style={{ fontSize: '2.4rem', color: '#facc15', fontWeight: 300, lineHeight: 1, margin: '16px 0' }}>
                  <span style={{ fontSize: '1.6rem', marginRight: '6px', color: '#facc15' }}>₱</span>
                  {extraData.totals.sales.toLocaleString()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>vs last month</span>
                  <span style={{ backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', padding: '2px 8px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {extraData.totals.salesGrowth >= 0 ? '↗' : '↘'} {Math.abs(extraData.totals.salesGrowth)}%
                  </span>
                </div>
              </div>

              <section style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 400, color: '#1e3a5f', margin: '0 0 4px 0' }}>Yearly Sales</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 30px 0' }}>Sales from the past years</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
                  {extraData.yearlyHistory.length > 0 ? extraData.yearlyHistory.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: '45px', color: '#475569', fontSize: '0.9rem' }}>{item.year}</span>
                      <div style={{ flex: 1, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                         <div style={{ 
                           width: `${Math.max(item.percentage, 2)}%`, 
                           backgroundColor: '#3b82f6', 
                           height: '12px', 
                           borderRadius: '6px',
                           transition: 'width 1s ease-in-out'
                         }} />
                      </div>
                      <span style={{ width: '80px', textAlign: 'right', color: '#333', fontSize: '0.85rem', fontWeight: 400 }}>
                        {item.sales.toLocaleString()}
                      </span>
                    </div>
                  )) : <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>No sales history available.</p>}
                </div>
              </section>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}