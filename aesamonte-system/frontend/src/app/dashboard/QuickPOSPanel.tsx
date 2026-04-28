"use client";

import styles from "@/css/dashboard.module.css";
import { PiShoppingBag } from "react-icons/pi";
import { RecentOrder } from "./types";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface QuickPOSPanelProps {
  recentOrders: RecentOrder[];
  loading: boolean;
  onNavigate?: (tab: string) => void;
  onOrderClick: (orderId: number) => void;
}

export default function QuickPOSPanel({
  recentOrders,
  loading,
  onNavigate,
  onOrderClick,
}: QuickPOSPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Quick POS</h3>
          <p className={styles.panelSub}>Recent in-store &amp; online orders at a glance.</p>
        </div>
        <div className={styles.posHeaderRight}>
          <span className={styles.posToday}>Today</span>
          <button
            className={styles.posRedirectBtn}
            onClick={() => onNavigate?.("Orders")}
            title="Go to Orders"
          >
            <PiShoppingBag size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.skeletonBlock} />
      ) : (
        <div className={styles.posGrid}>
          {recentOrders.map((o) => {
            const isPaid = o.status === "PAID" || o.status === "RECEIVED";
            return (
              <div
                key={o.orderId}
                className={styles.posCard}
                onClick={() => onOrderClick(o.orderId)}
              >
                <div className={styles.posCardTop}>
                  <p className={styles.posCustomer}>
                    {o.customerName.length > 14
                      ? o.customerName.slice(0, 13) + ".."
                      : o.customerName}
                  </p>
                  <span
                    className={`${styles.posBadge} ${
                      o.status === "PAID" || o.status === "RECEIVED" ? styles.posBadgePaid :
                      o.status === "PREPARING" ? styles.posBadgePreparing :
                      o.status === "PACKED"    ? styles.posBadgePacked :
                      o.status === "SHIPPING"  ? styles.posBadgeShipping :
                      o.status === "CANCELLED" ? styles.posBadgeCancelled :
                      o.status === "PENDING"   ? styles.posBadgePending :
                      styles.posBadgePending
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                <p className={styles.posOrderId}>No. {o.orderId}</p>
                <p className={styles.posAmount}>{fmt(o.amount)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
