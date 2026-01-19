'use client';

import styles from "@/css/reports.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from "@/components/features/ExportButton";

interface ReportsPageProps {
  role?: string;
  onLogout: () => void;
}

export default function ReportsPage({ role = "Admin", onLogout }: ReportsPageProps) {
  return (
    <div className={styles.container}>
      {/* Use roleOrName to match TopHeader internal prop requirements */}
      <TopHeader role={role} onLogout={onLogout} />

      <main className={styles.mainContent}>
        <div className={styles.headerActions}>
          <div className={styles.pageTitle}></div>
          <ExportButton />
        </div>

        <div className={styles.reportsGrid}>
          {/* Row 1 */}
          <section className={styles.reportCard}>
            <h3>Sales Report</h3>
            <div className={styles.placeholderList}>
              <div className={styles.row}><span>Weekly Sales</span> <span style={{color: '#d9534f'}}>0</span></div>
              <div className={styles.row} style={{backgroundColor: '#f1f5f9'}}><span>Monthly Sales</span> <span>0</span></div>
              <div className={styles.row}><span>Yearly Sales</span> <span style={{color: '#f0ad4e'}}>0</span></div>
            </div>
          </section>

          <section className={styles.reportCard}>
            <h3>Inventory Report</h3>
            <div className={styles.placeholderList}>
              <div className={styles.row}><span>Weekly Inventory</span> <span>0</span></div>
              <div className={styles.row} style={{backgroundColor: '#f1f5f9'}}><span>Monthly Inventory</span> <span>0</span></div>
              <div className={styles.row}><span>Yearly Inventory</span> <span>0</span></div>
            </div>
          </section>

          <div className={styles.statsColumn}>
            <div className={styles.miniCard}>
              <p>Total Orders</p>
              <h2>0 <span className={styles.pill}>+0%</span></h2>
            </div>
            <div className={styles.miniCard}>
              <p>Total Sales</p>
              <h2 style={{color: '#f0ad4e'}}>0 <span className={styles.pill}>+0%</span></h2>
            </div>
          </div>

          {/* Row 2: Top Clients Ordered */}
          <section className={`${styles.reportCard} ${styles.spanTwo}`}>
            <h3>Top Clients Ordered</h3>
            <div className={styles.chartPlaceholder}>[Bar Chart Placeholder]</div>
          </section>

          {/* Tall Card Spanning Row 2 and 3 */}
          <section className={`${styles.reportCard} ${styles.tallCard}`}>
            <h3>Yearly Sales</h3>
            <div className={styles.yearlyList}>
              {[2024, 2023, 2022, 2021, 2020].map(year => (
                <div key={year} className={styles.yearRow}>
                  <strong>{year}</strong> <span>₱0.00</span>
                </div>
              ))}
            </div>
          </section>

          {/* Row 3: Most Stock Items */}
          <section className={`${styles.reportCard} ${styles.spanTwo}`}>
            <h3>Most Stock Items</h3>
            <div className={styles.chartPlaceholder}>[Stock Levels Bar Chart]</div>
          </section>
        </div>
      </main>
    </div>
  );
}