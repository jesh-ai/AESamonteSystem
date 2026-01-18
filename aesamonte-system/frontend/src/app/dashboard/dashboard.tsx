"use client";

import styles from "@/css/dashboard.module.css";
import TopHeader from "@/components/layout/TopHeader";

interface DashboardProps {
  role?: string;
  onLogout: () => void;
}

export default function Dashboard({role = "Admin", onLogout }: DashboardProps) {
  const stats = [
    { title: "Sales Today", value: "₱ 23,840", change: "+7.2%", positive: true },
    { title: "Orders", value: "72", change: "+2.8%", positive: true },
    { title: "Low Stock", value: "10 SKUs", change: "+2.8%", positive: false }, 
  ];

return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardContainer}>
        <TopHeader role={role} onLogout={onLogout} />
      <div className={styles.mainContent}>
        {/* Stats Section */}
        <div className={styles.statsGrid}>
          {stats.map((item) => (
            <div key={item.title} className={styles.statCard}>
              <p className={styles.statTitle}>{item.title}</p>
              <h2 className={styles.statValue}>{item.value}</h2>
              <span className={`${styles.statChange} ${item.positive ? styles.positive : styles.negative}`}>
                {item.change}
              </span>
            </div>
          ))}
        </div>

        {/* Panels Section */}
        <div className={styles.panelsGrid}>
          
          {/* Forecasting and Revenue */}
          <div className={styles.column}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Sales Forecasting</h3>
              <div className={styles.placeholder}>📊 [Weekly/Quarterly Chart]</div>
            </div>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Forecast Revenue</h3>
              <div className={styles.placeholder}>📈 [Revenue Line Graph]</div>
            </div>
          </div>

          {/* Quick POS and Goal/Sales */}
          <div className={styles.column}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Quick POS</h3>
              <div className={styles.placeholder}>🧾 [Table Placeholder]</div>
            </div>
            
            <div className={styles.bottomRow}>
              <div className={styles.miniPanel}>
                <h3 className={styles.panelTitle}>Goal</h3>
                <div className={styles.placeholder}>🎯 [60%]</div>
              </div>
              <div className={styles.miniPanel}>
                <h3 className={styles.panelTitle}>Top Yearly Sales</h3>
                <div className={styles.placeholder}>🏆 [List]</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}