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

export default function ReportsPage({ role = "Admin", onLogout }: { role?: string, onLogout: () => void }) {
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/reports/sales", { cache: 'no-store' });
        if (res.ok) {
          setSalesData(await res.json());
        } else {
          const err = await res.json();
          setErrorMsg(err.error || "Failed to load report data.");
        }
      } catch (e) {
        setErrorMsg("Network error. Is Flask running?");
      }
    };
    fetchSales();
  }, []);

  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <main className={styles.mainContent} style={{ padding: '30px' }}>
        <div className={styles.headerActions} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <ExportButton />
        </div>

        {errorMsg ? (
          <div style={{ color: '#ef4444', padding: '20px', backgroundColor: '#fee2e2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
            <strong>Database Error:</strong> {errorMsg}
          </div>
        ) : !salesData ? (
          <div style={{ color: '#64748b' }}>Loading Sales Data...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            
            {/* EXACT MATCH: SALES REPORT CARD */}
            <section style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 400, color: '#1e3a5f' }}>Sales Report</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px' }}>
                  <span style={{ color: '#475569', fontSize: '0.95rem' }}>Weekly Sales</span> 
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{salesData.weekly.toLocaleString()}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                  <span style={{ color: '#475569', fontSize: '0.95rem' }}>Monthly Sales</span> 
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>{salesData.monthly.toLocaleString()}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px' }}>
                  <span style={{ color: '#475569', fontSize: '0.95rem' }}>Yearly Sales</span> 
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{salesData.yearly.toLocaleString()}</span>
                </div>
              </div>
            </section>

            {/* We will add the other cards here next! */}

          </div>
        )}
      </main>
    </div>
  );
}