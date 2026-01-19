'use client'

import { useEffect, useState } from 'react'
import styles from '@/css/sales.module.css'
import TopHeader from '@/components/layout/TopHeader'
import ExportButton from '@/components/features/ExportButton'


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

interface SalesProps {
  role?: string
  onLogout: () => void
}

export default function SalesPage({ role = 'Admin', onLogout }: SalesProps) {
  const [data, setData] = useState<SalesSummary | null>(null)

  useEffect(() => {
    // Replace with API
    const fetchSalesSummary = async () => {
      const response: SalesSummary = {
        totalSales: 21059,
        totalSalesChange: 5,
        weeklySales: 903,
        monthlySales: 5029,
        yearlySales: 21095,
        topClientName: 'Trans Logistica',
        topClientSales: 5520,
        topClientChange: 11,
      }

      setData(response)
    }

    fetchSalesSummary()
  }, [])

  if (!data) return null

  return (
    <div className={styles.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <main className={styles.mainContent}>
        <div className={styles.headerActions}>
          <ExportButton />
        </div>

        <div className={styles.topGrid}>

          {/* Total Sales */}
          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Total Sales</p>
            <h2 className={styles.bigNumber}>
              {data.totalSales.toLocaleString()}
            </h2>
            <div className={styles.cardFooter}>
              <span className={styles.subText}>vs last month</span>
              <span className={styles.pill}>
                ↗ {data.totalSalesChange}%
              </span>
            </div>
          </section>

          {/* Sales Report */}
          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Sales Report</p>

            <div className={styles.list}>
              <div className={styles.listRow}>
                <span>Weekly Sales</span>
                <span className={styles.green}>
                  {data.weeklySales}
                </span>
              </div>

              <div className={`${styles.listRow} ${styles.altRow}`}>
                <span>Monthly Sales</span>
                <span className={styles.red}>
                  {data.monthlySales}
                </span>
              </div>

              <div className={styles.listRow}>
                <span>Yearly Sales</span>
                <span className={styles.blue}>
                  {data.yearlySales}
                </span>
              </div>
            </div>
          </section>

          {/* Top Client */}
          <section className={styles.statCard}>
            <p className={styles.cardTitle}>Top Client</p>
            <h2 className={styles.bigNumber}>
              {data.topClientSales.toLocaleString()}
            </h2>
            <div className={styles.cardFooter}>
              <span className={styles.subText}>
                {data.topClientName}
              </span>
              <span className={styles.pill}>
                ↗ {data.topClientChange}%
              </span>
            </div>
          </section>












        </div>
      </main>
    </div>
  )
}
