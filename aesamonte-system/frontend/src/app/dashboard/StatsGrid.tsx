"use client";

import { useState, useEffect } from "react";
import styles from "@/css/dashboard.module.css";
import { GrLineChart } from "react-icons/gr";
import { PiShoppingBag } from "react-icons/pi";
import { MdOutlineInventory2 } from "react-icons/md";
import { AiOutlineRise, AiOutlineFall } from "react-icons/ai";
import { Metrics, InsightsData } from "./types";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

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

interface StatsGridProps {
  metrics: Metrics | null;
  loading: boolean;
  onNavigate?: (tab: string) => void;
  insights?: InsightsData | null;
  lowStockItems?: LowStockItem[];
}

export default function StatsGrid({ metrics, loading, onNavigate, insights, lowStockItems = [] }: StatsGridProps) {
  const [showLowStockPopup, setShowLowStockPopup] = useState(false);
  const [viewLowStockItem, setViewLowStockItem] = useState<LowStockItem | null>(null);
  const [supplierLoading, setSupplierLoading] = useState(false);

  useEffect(() => {
    if (!showLowStockPopup && !viewLowStockItem) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-lowstock]")) {
        setShowLowStockPopup(false);
        setViewLowStockItem(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLowStockPopup, viewLowStockItem]);

  const allStockData: LowStockItem[] = lowStockItems.length > 0
    ? lowStockItems
    : (insights?.reorderSuggestions ?? []).map(s => ({
        inventory_id: s.inventory_id,
        item_name: s.item_name,
        sku: s.sku,
        current_qty: s.current_qty,
        uom: s.uom,
        reorder_qty: (s as any).reorder_qty || (s as any).reorderLevel || 0,
        brand: s.brand,
        description: s.description,
      }));

  const outOfStockData = allStockData.filter(s =>
    s.current_qty === 0 || s.status?.toLowerCase().includes("out of stock")
  );
  const lowStockData = allStockData.filter(s =>
    s.current_qty > 0 && !s.status?.toLowerCase().includes("out of stock")
  );

  const handleItemClick = async (s: LowStockItem) => {
    setShowLowStockPopup(false);
    setViewLowStockItem(s);

    // If supplier is already populated, no need to fetch
    if (s.supplier_name) return;

    // Fetch full item details to get supplier
    setSupplierLoading(true);
    try {
      const res = await fetch(`/api/inventory/${s.inventory_id}`);
      if (res.ok) {
        const full = await res.json();
        const supplierName =
          full.supplierName ||
          full.supplier_name ||
          full.suppliers?.[0]?.supplierName ||
          "";
        setViewLowStockItem(prev => prev ? { ...prev, supplier_name: supplierName } : prev);
      }
    } catch (err) {
      console.error("Supplier fetch error:", err);
    } finally {
      setSupplierLoading(false);
    }
  };

  const statCards = metrics && metrics.salesToday != null ? [
    { 
      title: "Sales Today", 
      value: fmt(metrics.salesToday), 
      change: `${metrics.salesChange >= 0 ? "↗ " : "↘ "}${Math.abs(metrics.salesChange)}%`, 
      positive: metrics.salesChange >= 0, 
      sub: "Sales up from yesterday.", 
      icon: <GrLineChart size={20} />, 
      tab: "Sales" 
    },
    { 
      title: "Orders", 
      value: String(metrics.pendingOrders), 
      change: `${metrics.ordersChange >= 0 ? "↗ " : "↘ "}${Math.abs(metrics.ordersChange)}%`, 
      positive: metrics.ordersChange >= 0, 
      sub: "Orders awaiting processing.", 
      icon: <PiShoppingBag size={20} />, 
      tab: "Orders" 
    },
    { 
      title: "Low Stock", 
      value: `${metrics.lowStock} SKUs`, 
      change: "", 
      positive: false, 
      hideBadge: true, 
      sub: "Immediate restock needed.", 
      icon: <MdOutlineInventory2 size={20} />, 
      tab: "Inventory" 
    },
  ] : [];

  return (
    <>
      <div className={styles.statsGrid}>
        {loading || statCards.length === 0
          ? [1, 2, 3].map((i) => <div key={i} className={`${styles.statCard} ${styles.skeleton}`} />)
          : statCards.map((item) => {
              const isLowStock = item.title === "Low Stock";
              const hasLowItems = isLowStock && metrics && metrics.lowStock > 0;
              return (
                <div
                  key={item.title}
                  className={styles.statCard}
                  style={{ cursor: hasLowItems ? "pointer" : "default" }}
                  data-lowstock="true"
                  onClick={() => hasLowItems && setShowLowStockPopup(prev => !prev)}
                >
                  <div className={styles.statCardTop}>
                    <p className={styles.statTitle}>{item.title}</p>
                    <button className={styles.statIconBtn} onClick={(e) => { e.stopPropagation(); onNavigate?.(item.tab); }}>
                      {item.icon}
                    </button>
                  </div>
                  <h2 className={styles.statValue}>
                    {item.title === "Low Stock" ? (
                      <>
                        <span style={{ color: "#dc2626" }}>{metrics?.lowStock}</span>
                        <span style={{ fontSize: "2rem", fontWeight: 500, color: "#dc2626", marginLeft: "4px" }}>Items</span>
                      </>
                    ) : (
                      item.value
                    )}
                  </h2>
                  <div className={styles.statFooter}>
                    <span className={styles.statSub}>{item.sub}</span>
                    {!item.hideBadge && (
                      <span className={`${styles.statBadge} ${item.positive ? styles.badgeGreen : styles.badgeRed}`}>
                        {item.change}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {/* ── Stock Alerts Popup ── */}
      {showLowStockPopup && (
        <div 
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}
          onClick={() => setShowLowStockPopup(false)}
        >
          <div className={styles.lowStockPopup} data-lowstock="true" onClick={e => e.stopPropagation()}>

            <div className={styles.lowStockPopupHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <p className={styles.lowStockPopupTitle}>STOCK ALERTS</p>
                <span className={styles.lowStockPopupCount}>{allStockData.length} items</span>
              </div>
              <button 
                onClick={() => setShowLowStockPopup(false)} 
                style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#6b7280" }}
              >✕</button>
            </div>

            <div className={styles.lowStockPopupList}>

              {outOfStockData.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0 8px", padding: "0 2px" }}>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.07em" }}>Out of Stock</span>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#fff", background: "#dc2626", borderRadius: "99px", padding: "1px 7px" }}>{outOfStockData.length}</span>
                  </div>
                  {outOfStockData.map((s, i) => (
                    <div key={`out-${i}`} className={styles.lowStockPopupRow} onClick={(e) => { e.stopPropagation(); handleItemClick(s); }}>
                      <div className={styles.lowStockPopupLeft}>
                        <span className={styles.lowStockPopupName}>{s.item_name}</span>
                        {s.sku && <span className={styles.lowStockPopupSku}>{s.sku}</span>}
                      </div>
                      <span className={styles.lowStockPopupQty} style={{ color: "#dc2626" }}>{s.current_qty} {s.uom}</span>
                    </div>
                  ))}
                </>
              )}

              {lowStockData.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: `${outOfStockData.length > 0 ? "14px" : "4px"} 0 8px`, padding: "0 2px" }}>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.07em" }}>Low Stock</span>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#fff", background: "#d97706", borderRadius: "99px", padding: "1px 7px" }}>{lowStockData.length}</span>
                  </div>
                  {lowStockData.map((s, i) => (
                    <div key={`low-${i}`} className={styles.lowStockPopupRow} onClick={(e) => { e.stopPropagation(); handleItemClick(s); }}>
                      <div className={styles.lowStockPopupLeft}>
                        <span className={styles.lowStockPopupName}>{s.item_name}</span>
                        {s.sku && <span className={styles.lowStockPopupSku}>{s.sku}</span>}
                      </div>
                      <span className={styles.lowStockPopupQty} style={{ color: "#d97706" }}>{s.current_qty} {s.uom}</span>
                    </div>
                  ))}
                </>
              )}

            </div>

            <button className={styles.lowStockPopupFooter} onClick={() => { setShowLowStockPopup(false); onNavigate?.("Inventory"); }}>
              View all in Inventory →
            </button>
          </div>
        </div>
      )}

      {/* ── Item Detail Modal ── */}
      {viewLowStockItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem" }}
          onClick={() => setViewLowStockItem(null)}
        >
          <div
            data-lowstock="true"
            style={{ background: "#fff", borderRadius: "20px", padding: "1.75rem", width: "100%", maxWidth: "460px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "1rem" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#164163", margin: 0 }}>{viewLowStockItem.item_name}</p>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "3px 0 0" }}>ID: {viewLowStockItem.inventory_id} • SKU: {viewLowStockItem.sku || "—"}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: "99px",
                  background: viewLowStockItem.current_qty === 0 ? "#fee2e2" : "#fef3c7",
                  color: viewLowStockItem.current_qty === 0 ? "#dc2626" : "#d97706",
                }}>
                  {viewLowStockItem.current_qty === 0 ? "Out of Stock" : "Low Stock"}
                </span>
               <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewLowStockItem(null); 
                        // the main list stays open
                        setShowLowStockPopup(true); 
                      }} 
                      style={{ 
                        background: "#f3f4f6", 
                        border: "none", 
                        borderRadius: "50%", 
                        width: "32px", 
                        height: "32px", 
                        cursor: "pointer", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center" 
                      }}
                    >
                      ✕
                    </button>
                    </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px dashed #e5e7eb", margin: 0 }} />

            <div>
              <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: "0 0 0.6rem" }}>Product Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>Brand</p>
                  <p style={{ fontSize: "0.88rem", fontWeight: 600, margin: 0 }}>{viewLowStockItem.brand || "—"}</p>
                </div>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>Unit (UOM)</p>
                  <p style={{ fontSize: "0.88rem", fontWeight: 600, margin: 0 }}>{viewLowStockItem.uom || "—"}</p>
                </div>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>Supplier</p>
                  <p style={{ fontSize: "0.88rem", fontWeight: 600, margin: 0 }}>
                    {supplierLoading
                      ? <span style={{ color: "#9ca3af", fontStyle: "italic", fontWeight: 400 }}>Loading...</span>
                      : viewLowStockItem.supplier_name || "—"
                    }
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>Reorder Point</p>
                  <p style={{ fontSize: "0.88rem", fontWeight: 600, margin: 0 }}>
                    {(viewLowStockItem as any).reorder_qty || (viewLowStockItem as any).reorderLevel || 0} {viewLowStockItem.uom}
                  </p>
                </div>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "0.68rem", color: "#9ca3af", textTransform: "uppercase" }}>QTY</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "0.68rem", color: "#9ca3af", textTransform: "uppercase" }}>UNIT COST</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "0.68rem", color: "#9ca3af", textTransform: "uppercase" }}>SELLING PRICE</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: viewLowStockItem.current_qty === 0 ? "#dc2626" : "#d97706", fontSize: "1rem" }}>
                    {viewLowStockItem.current_qty} <span style={{ fontSize: "0.7rem", fontWeight: 400 }}>{viewLowStockItem.uom}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                    ₱ {((viewLowStockItem as any).unit_price || (viewLowStockItem as any).unitCost || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#164163" }}>
                    ₱ {((viewLowStockItem as any).selling_price || (viewLowStockItem as any).sellingPrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}