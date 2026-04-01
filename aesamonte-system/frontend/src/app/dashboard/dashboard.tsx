/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import styles from "@/css/dashboard.module.css";
import TopHeader from "@/components/layout/TopHeader";
import StatsGrid from "./StatsGrid";
import ForecastingPanel from "./ForecastingPanel";
import ForecastRevenuePanel from "./ForecastRevenuePanel";
import QuickPOSPanel from "./QuickPOSPanel";
import GoalPanel from "./GoalPanel";
import YearlySalesPanel from "./YearlySalesPanel";
import ReceiptModal from "./ReceiptModal";
import {
  Metrics,
  RecentOrder,
  ChartsData,
  InsightsData,
  OrderReceipt,
} from "./types";

interface LowStockItem {
  inventory_id: number;
  item_name: string;
  sku: string;
  current_qty: number;
  uom: string;
  reorder_qty: number;
  brand?: string;
  description?: string;
  unit_price?: number;
  selling_price?: number;
  status?: string;
  supplier_name?: string;
}

interface DashboardProps {
  role?: string;
  onLogout: () => void;
  onNavigate?: (tab: string) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export default function Dashboard({ role = "Admin", onLogout, onNavigate }: DashboardProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    const fetchData = () => {
      Promise.all([
        fetch(`${API}/api/dashboard/all`, { credentials: "include" }).then((r) => r.json()),
        fetch(`/api/inventory`, { headers: { "Cache-Control": "no-cache" } }).then((r) => r.json()),
      ])
        .then(([dashData, inventoryData]) => {
          const { metrics: m, recentOrders: ro, charts: ch, insights: ins, lowStockItems: dashLowStock } = dashData;

          if (ch && !ch.error) setCharts(ch);
          if (ins && !ins.error) setInsights(ins);
          if (Array.isArray(ro)) setRecentOrders(ro);

          // Build lookup maps using String keys to avoid NaN issues
          // dashLowStock has supplier_name because Flask joins the supplier table
          const supplierMap = new Map<string, string>();
          const unitPriceMap = new Map<string, number>();
          const sellingPriceMap = new Map<string, number>();
          const reorderMap = new Map<string, number>();

          if (Array.isArray(dashLowStock)) {
            for (const item of dashLowStock) {
              const key = String(item.inventory_id);
              if (item.supplier_name) supplierMap.set(key, item.supplier_name);
              if (item.unit_price)    unitPriceMap.set(key, item.unit_price);
              if (item.selling_price) sellingPriceMap.set(key, item.selling_price);
              if (item.reorder_qty)   reorderMap.set(key, item.reorder_qty);
            }
          }

          // Build stock alerts from full inventory list (for correct count)
          let stockAlerts: LowStockItem[] = [];
          if (Array.isArray(inventoryData)) {
            const activeProducts = inventoryData.filter((p: any) => !p.is_archived);

            stockAlerts = activeProducts
              .filter((p: any) =>
                p.qty === 0 ||
                p.status?.toLowerCase().includes("out of stock") ||
                p.status?.toLowerCase().includes("low stock")
              )
              .map((p: any) => {
                const key = String(p.id); // use String to avoid NaN
                return {
                  inventory_id: p.id,     // keep original value — no Number() conversion
                  item_name:    p.item_name,
                  sku:          p.sku,
                  current_qty:  p.qty,
                  uom:          p.uom,
                  status:       p.status,
                  brand:        p.brand,
                  description:  p.item_description,
                  supplier_name:  supplierMap.get(key) || "",
                  unit_price:     unitPriceMap.get(key)    ?? p.unitPrice  ?? 0,
                  selling_price:  sellingPriceMap.get(key) ?? p.price      ?? 0,
                  reorder_qty:    reorderMap.get(key)      ?? p.reorderPoint ?? 0,
                };
              });

            setLowStockItems(stockAlerts);
          }

          // Override metrics.lowStock with the real count so badge matches popup
          if (m && !m.error) {
            setMetrics({ ...m, lowStock: stockAlerts.length });
          }
        })
        .catch((e) => console.error("Dashboard fetch error:", e))
        .finally(() => setLoading(false));
    };

    fetchData(); // run on mount

    const interval = setInterval(fetchData, 30_000); // re-fetch every 30s
    return () => clearInterval(interval);
  }, []);

  const handleOrderClick = async (orderId: number) => {
    setReceiptLoading(true);
    setReceipt({
      orderId,
      customerName: "",
      customerAddress: "",
      orderDate: "",
      totalAmount: 0,
      status: "",
      paymentMethod: "",
      items: [],
    });
    try {
      const res = await fetch(`${API}/api/dashboard/order-receipt/${orderId}`, {
        credentials: "include",
      });
      const data = JSON.parse(await res.text());
      setReceipt(data);
    } catch (err) {
      console.error("Receipt fetch error:", err);
      setReceipt(null);
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <TopHeader role={role} onLogout={onLogout} />
      <div className={styles.mainContent}>

        <StatsGrid
          metrics={metrics}
          loading={loading}
          onNavigate={onNavigate}
          insights={insights}
          lowStockItems={lowStockItems}
        />

        <div className={styles.panelsGrid}>

          {/* Left column */}
          <div className={styles.column}>
            <ForecastingPanel charts={charts} insights={insights} loading={loading} />
            <ForecastRevenuePanel charts={charts} metrics={metrics} loading={loading} />
          </div>

          {/* Right column */}
          <div className={styles.column}>
            <QuickPOSPanel
              recentOrders={recentOrders}
              loading={loading}
              onNavigate={onNavigate}
              onOrderClick={handleOrderClick}
            />
            <div className={styles.bottomRow}>
              <GoalPanel goalPercent={charts?.goalPercent ?? 0} loading={loading} />
              <YearlySalesPanel yearlySales={charts?.yearlySales} loading={loading} />
            </div>
          </div>

        </div>
      </div>

      {receipt && (
        <ReceiptModal
          receipt={receipt}
          receiptLoading={receiptLoading}
          onClose={() => setReceipt(null)}
          onOrdersUpdate={setRecentOrders}
          onReceiptStatusUpdate={(orderId, status) =>
            setReceipt((prev) => (prev ? { ...prev, status } : prev))
          }
        />
      )}
    </div>
  );
}