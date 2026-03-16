"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import styles from "@/css/dashboard.module.css";
import TopHeader from "@/components/layout/TopHeader";
import { GrLineChart } from "react-icons/gr";
import { PiShoppingBag } from "react-icons/pi";
import { MdOutlineInventory2, MdOutlineCheckCircle, MdOutlineStorefront } from "react-icons/md";
import { AiOutlineRise, AiOutlineFall } from "react-icons/ai";

interface DashboardProps {
  role?: string;
  onLogout: () => void;
  onNavigate?: (tab: string) => void;
}

interface Metrics {
  salesToday: number;
  salesChange: number;
  pendingOrders: number;
  ordersChange: number;
  lowStock: number;
}

interface RecentOrder {
  orderId: number;
  customerName: string;
  amount: number;
  status: string;
}

interface ReceiptItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  uom: string;
}

interface OrderReceipt {
  orderId: number;
  customerName: string;
  customerAddress: string;
  orderDate: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  items: ReceiptItem[];
}

interface PeriodSales {
  label: string;
  dateRange: string;
  total: number;
}

interface MonthlySales {
  month: string;
  sales: number;
}

interface YearlySales {
  year: number;
  total: number;
  change: number | null;
}

interface PeriodSalesMonth extends PeriodSales {
  year?: string;
}

interface ChartsData {
  monthlySales: MonthlySales[];
  weeklySales: PeriodSales[];
  quarterlySales: PeriodSales[];
  lastTwelveMonths: PeriodSalesMonth[];
  yearlySales: YearlySales[];
  goalPercent: number;
  forecastTotal: number;
}

interface ReorderSuggestion {
  inventory_id: number;
  item_name: string;
  sku: string;
  brand: string;
  description: string;
  uom: string;
  current_qty: number;
  forecast_demand: number;
  safety_stock: number;
  recommended_qty: number;
  note: string;
}

interface StockoutPrediction {
  inventory_id: number;
  item_name: string;
  sku: string;
  brand: string;
  description: string;
  uom: string;
  current_qty: number;
  daily_rate: number;
  days_remaining: number;
  stockout_date: string;
  is_low_stock: boolean;
}

interface InsightsData {
  reorderSuggestions: ReorderSuggestion[];
  stockoutPredictions: StockoutPrediction[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
}

type ForecastView = "Weekly" | "Quarterly" | "Yearly";

export default function Dashboard({ role = "Admin", onLogout, onNavigate }: DashboardProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [forecastView, setForecastView] = useState<ForecastView>("Weekly");
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [confirmReceiptAction, setConfirmReceiptAction] = useState<"PREPARING" | "RECEIVED" | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/dashboard/metrics`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/api/dashboard/recent-orders`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/api/dashboard/charts`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/api/dashboard/insights`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([m, ro, ch, ins]) => {
        if (!m.error) setMetrics(m);
        if (Array.isArray(ro)) setRecentOrders(ro);
        if (!ch.error) setCharts(ch);
        if (!ins.error) setInsights(ins);
      })
      .catch((e) => console.error("Dashboard fetch error:", e))
      .finally(() => setLoading(false));
  }, []);

  // Pick the right period array based on the active tab
  const forecastPeriods: PeriodSalesMonth[] =
    charts == null
      ? []
      : forecastView === "Weekly"
      ? (charts.weeklySales ?? [])
      : forecastView === "Quarterly"
      ? (charts.quarterlySales ?? [])
      : (charts.lastTwelveMonths ?? []);

  const maxPeriod = Math.max(...forecastPeriods.map((p) => p.total), 1);

  // Fire emoji on 2nd and 3rd highest (the top card gets the blue highlight instead)
  const sorted = [...forecastPeriods].sort((a, b) => b.total - a.total);
  const fireTotals = new Set(sorted.slice(1, 3).filter(p => p.total > 0).map(p => p.total));

  // Goal donut data
  const goalPct = charts?.goalPercent ?? 0;
  const donutData = [
    { name: "achieved", value: goalPct },
    { name: "remaining", value: Math.max(100 - goalPct, 0) },
  ];

  const statCards = metrics && metrics.salesToday != null
    ? [
        {
          title: "Sales Today",
          value: fmt(metrics.salesToday),
          change: `${metrics.salesChange >= 0 ? "+" : ""}${metrics.salesChange}%`,
          positive: metrics.salesChange >= 0,
          sub: "Sales up from yesterday's total.",
          icon: <GrLineChart size={20} />,
          tab: "Sales",
        },
        {
          title: "Orders",
          value: String(metrics.pendingOrders),
          change: `${metrics.ordersChange >= 0 ? "+" : ""}${metrics.ordersChange}%`,
          positive: metrics.ordersChange >= 0,
          sub: "Orders awaiting processing.",
          icon: <PiShoppingBag size={20} />,
          tab: "Orders",
        },
        {
          title: "Low Stock",
          value: `${metrics.lowStock} SKUs`,
          change: metrics.lowStock === 0 ? "All stocked" : "",
          positive: metrics.lowStock === 0,
          hideBadge: metrics.lowStock > 0,
          sub: "Immediate restock needed for items.",
          icon: <MdOutlineInventory2 size={20} />,
          tab: "Inventory",
        },
      ]
    : [];


  const handleReceiptStatusAdvance = async (targetStatus: "PREPARING" | "RECEIVED") => {
    if (!receipt) return;
    try {
      const res = await fetch(`${API}/api/dashboard/order-status/${receipt.orderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (data.status) {
        setReceipt(prev => prev ? { ...prev, status: data.status } : prev);
        setRecentOrders(prev =>
          prev.map(o => o.orderId === receipt.orderId ? { ...o, status: data.status } : o)
        );
      }
    } catch (err) {
      console.error("Status advance error:", err);
    }
  };

  const handleCardClick = async (orderId: number) => {
    setReceiptLoading(true);
    setReceipt({ orderId, customerName: "", customerAddress: "", orderDate: "", totalAmount: 0, status: "", paymentMethod: "", items: [] });
    try {
      const res = await fetch(`${API}/api/dashboard/order-receipt/${orderId}`, { credentials: "include" });
      const text = await res.text();
      const data = JSON.parse(text);
      setReceipt(data);
    } catch (err) {
      console.error("Receipt fetch error:", err);
      setReceipt(null);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrint = () => {
    if (!receipt) return;
    const pw = window.open("", "_blank");
    if (!pw) { alert("Pop-up blocked. Please allow pop-ups for this site in your browser settings, then try again."); return; }

    const items = receipt.items;
    const totalRows = Math.max(25, items.length);
    const rows = Array.from({ length: totalRows }, (_, i) => {
      const item = items[i];
      return item
        ? `<tr><td>${i + 1}</td><td>${item.quantity}</td><td>${item.uom || "PCS"}</td><td class="part">${item.item_name}</td></tr>`
        : `<tr><td>${i + 1}</td><td></td><td></td><td></td></tr>`;
    }).join("");

    pw.document.write(`<!DOCTYPE html>
      <html>
      <head>
        <title>Delivery Receipt - No. ${receipt.orderId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 24px 28px; }
          .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          .company h1 { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .company p  { font-size: 10px; line-height: 1.65; }
          .receipt-block { text-align: right; }
          .receipt-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
          .receipt-no    { font-size: 24px; font-weight: 900; color: #c0392b; letter-spacing: 2px; }
          .receipt-no span { font-size: 13px; font-weight: 700; color: #000; }
          .meta-row { display: flex; justify-content: flex-end; align-items: flex-end; gap: 4px; margin-top: 4px; font-size: 10px; }
          .meta-label { font-weight: 600; white-space: nowrap; }
          .meta-value { border-bottom: 1px solid #000; min-width: 120px; padding: 0 4px; font-size: 10px; }
          .deliver-section { font-size: 10px; margin-bottom: 6px; }
          .deliver-row   { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 4px; }
          .deliver-label { font-weight: 700; font-size: 11px; white-space: nowrap; }
          .deliver-line  { border-bottom: 1px solid #000; flex: 1; min-height: 14px; padding: 0 4px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
          thead th { border: 1px solid #000; padding: 5px 6px; font-weight: 700; text-align: center; font-size: 11px; }
          thead th.art { font-size: 12px; letter-spacing: 1px; }
          tbody td { border: 1px solid #000; padding: 2px 6px; text-align: center; height: 19px; font-size: 10px; }
          tbody td.part { text-align: left; }
          .print-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12px; }
          .footer-left  { max-width: 46%; font-size: 9px; line-height: 1.65; color: #333; }
          .footer-right { font-size: 10px; text-align: right; }
          .received-text { margin-bottom: 30px; }
          .by-line { display: flex; align-items: flex-end; justify-content: flex-end; gap: 6px; margin-bottom: 4px; }
          .by-underline { border-bottom: 1px solid #000; width: 160px; height: 16px; }
          .sig-line { border-top: 1px solid #000; width: 180px; margin-left: auto; text-align: center; padding-top: 2px; font-size: 9px; }
          .not-valid { font-style: italic; font-weight: 700; font-size: 9px; text-decoration: underline; text-align: center; margin-top: 8px; }
          @media print { body { padding: 10px 14px; } @page { margin: 0.4in; size: letter; } }
        </style>
      </head>
      <body>
        <div class="top">
          <div class="company">
            <h1>AE Samonte Merchandise</h1>
            <p>ALAIN E. SAMONTE - Prop.</p>
            <p>VAT Reg. TIN : 263-884-036-00000</p>
            <p>1457 A. Leon Guinto St., Zone 73 Barangay 676,</p>
            <p>1000 Ermita NCR, City of Manila, First District, Philippines</p>
          </div>
          <div class="receipt-block">
            <div class="receipt-title">DELIVERY RECEIPT</div>
            <div class="receipt-no"><span>N<sup>o</sup></span> ${receipt.orderId}</div>
            <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${receipt.orderDate}</span></div>
            <div class="meta-row"><span class="meta-label">P.O. No.:</span><span class="meta-value">&nbsp;</span></div>
            <div class="meta-row"><span class="meta-label">RFQ No.:</span><span class="meta-value">&nbsp;</span></div>
            <div class="meta-row"><span class="meta-label">TIN No.:</span><span class="meta-value">&nbsp;</span></div>
          </div>
        </div>
        <div class="deliver-section">
          <div class="deliver-row">
            <span class="deliver-label">DELIVERED TO:</span>
            <span class="deliver-line">${receipt.customerName}</span>
          </div>
          <div class="deliver-row">
            <span class="deliver-label">Address:</span>
            <span class="deliver-line">${receipt.customerAddress || ""}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:6%">ITEM</th>
              <th style="width:8%">QTY</th>
              <th style="width:10%">UNIT</th>
              <th class="art">ARTICLES / PARTICULARS</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="print-footer">
          <div class="footer-left">
            <div>20 Bkts. (50x3) 4251 - 5250</div>
            <div>BIR Authority to Print No.: OCN033AU20250000004322</div>
            <div>Date of ATP: OCTOBER 10, 2025</div>
            <div>REGENCIA PRINTING SERVICES | Ramil P. Egencia - Prop.</div>
            <div>Lot 3 to 7, Raq's Hope Ville, Navarro 4107 City of General</div>
            <div>Trias, Cavite, Philippines • VAT Reg. TIN: 245-821-996-00000</div>
            <div>Printer's Accreditation No.: 54BMP20250000000023</div>
            <div>Date of ATP: OCT. 09, 2025 • Expiry Date: OCT. 08, 2030</div>
          </div>
          <div class="footer-right">
            <div class="received-text">Received the above goods in good order and condition.</div>
            <div class="by-line"><span>By:</span><div class="by-underline"></div></div>
            <div class="sig-line">Authorized Signature</div>
            <div class="not-valid">"THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX"</div>
          </div>
        </div>
      </body>
      </html>`);
    pw.document.close();
    pw.focus();
    pw.print();
  };

  return (
    <div className={styles.dashboardContainer}>
      <TopHeader role={role} onLogout={onLogout} />
      <div className={styles.mainContent}>

        {/* ── Stats Row ── */}
        <div className={styles.statsGrid}>
          {loading
            ? [1, 2, 3].map((i) => <div key={i} className={`${styles.statCard} ${styles.skeleton}`} />)
            : statCards.length === 0
            ? [1, 2, 3].map((i) => <div key={i} className={`${styles.statCard} ${styles.skeleton}`} style={{ opacity: 0.4 }} />)
            : statCards.map((item) => (
                <div key={item.title} className={styles.statCard}>
                  <div className={styles.statCardTop}>
                    <p className={styles.statTitle}>{item.title}</p>
                    <button
                      className={styles.statIconBtn}
                      onClick={() => onNavigate?.(item.tab)}
                      title={`Go to ${item.tab}`}
                    >
                      {item.icon}
                    </button>
                  </div>
                  <h2 className={styles.statValue}>{item.value}</h2>
                  <div className={styles.statFooter}>
                    <span className={styles.statSub}>{item.sub}</span>
                    {!item.hideBadge && (
                      <span className={`${styles.statBadge} ${item.positive ? styles.badgeGreen : styles.badgeRed}`}>
                        {item.change} {item.positive ? <AiOutlineRise size={13} /> : <AiOutlineFall size={13} />}
                      </span>
                    )}
                  </div>
                </div>
              ))}
        </div>

        {/* ── Panels Grid ── */}
        <div className={styles.panelsGrid}>

          {/* ── LEFT COLUMN ── */}
          <div className={styles.column}>

            {/* Sales Forecasting — 3-slide carousel */}
            <div className={`${styles.panel} ${styles.panelCream}`}>
              {/* Dynamic header title per slide */}
              <div className={styles.panelHeader}>
                <div>
                  <h3 className={styles.panelTitle}>
                    {slideIndex === 0 ? "Sales Forecasting" : slideIndex === 1 ? "Smart Reorder Suggestion" : "Stock-Out Prediction"}
                  </h3>
                  {slideIndex === 0 && <p className={styles.panelSub}>{forecastView}</p>}
                </div>
              </div>

              {/* Slider */}
              <div className={styles.sliderOuter} style={{ height: slideIndex === 0 ? "210px" : "270px" }}>
                <div
                  className={styles.sliderTrack}
                  style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                >
                  {/* ── Slide 0: Forecast Cards ── */}
                  <div className={styles.slide}>
                    {loading ? (
                      <div className={styles.skeletonBlock} />
                    ) : (
                      <>
                        <div className={`${styles.forecastCards} ${forecastView === "Yearly" ? styles.forecastCardsScroll : ""}`}>
                          {forecastPeriods.map((p, i) => {
                            const isTop = p.total === maxPeriod && p.total > 0;
                            const hasFire = fireTotals.has(p.total);
                            const subLabel = forecastView === "Yearly"
                              ? (p as PeriodSalesMonth).year ?? ""
                              : p.dateRange;
                            return (
                              <div key={i} className={`${styles.forecastCard} ${isTop ? styles.forecastCardActive : ""}`}>
                                <p className={styles.forecastCardLabel}>{p.label}</p>
                                {subLabel && <p className={styles.forecastCardRange}>{subLabel}</p>}
                                <div className={styles.forecastCardBottom}>
                                  <p className={styles.forecastCardTotal}>{fmt(p.total)}</p>
                                  {hasFire && <span className={styles.fireIcon}>🔥</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Slide 1: Smart Reorder Suggestion ── */}
                  <div className={styles.slide}>
                    {loading || !insights ? (
                      <div className={styles.skeletonBlock} />
                    ) : insights.reorderSuggestions.length === 0 ? (
                      <p className={styles.slideEmpty}>No reorder suggestions at this time.</p>
                    ) : (() => {
                      const item = insights.reorderSuggestions[0];
                      return (
                        <div className={styles.insightCard}>
                          <div className={styles.insightProductRow}>
                            <div>
                              <p className={styles.insightProductName}>{item.item_name}</p>
                              <p className={styles.insightProductMeta}>
                                {item.brand && <span>{item.brand}</span>}
                                {item.description && <span>{item.description}</span>}
                              </p>
                            </div>
                            <span className={styles.insightSkuBadge}>SKU: {item.sku}</span>
                          </div>
                          <div className={styles.reorderStatGrid}>
                            <div className={styles.reorderStatChip}>
                              <span className={styles.reorderStatLabel}>Forecast Demand</span>
                              <span className={styles.reorderStatVal}>{item.forecast_demand} <em>units</em></span>
                            </div>
                            <div className={styles.reorderStatChip}>
                              <span className={styles.reorderStatLabel}>Safety Stock</span>
                              <span className={styles.reorderStatVal}>{item.safety_stock} <em>units</em></span>
                            </div>
                          </div>
                          <div className={styles.reorderRecommendRow}>
                            <div>
                              <p className={styles.reorderRecommendTitle}>Recommended Order</p>
                              <p className={styles.reorderRecommendNote}>{item.note}</p>
                            </div>
                            <span className={styles.reorderQtyBadge}>{item.recommended_qty} units</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── Slide 2: Stock-Out Prediction ── */}
                  <div className={styles.slide}>
                    {loading || !insights ? (
                      <div className={styles.skeletonBlock} />
                    ) : insights.stockoutPredictions.length === 0 ? (
                      <p className={styles.slideEmpty}>No stock-out risks detected.</p>
                    ) : (() => {
                      const item = insights.stockoutPredictions[0];
                      return (
                        <div className={styles.insightCard}>
                          <div className={styles.insightProductRow}>
                            <div className={styles.stockoutNameBlock}>
                              <p className={styles.insightProductName}>{item.item_name}</p>
                              {item.is_low_stock && (
                                <span className={styles.lowStockBadge}>Low Stock ↘</span>
                              )}
                            </div>
                            <span className={styles.insightSkuBadge}>SKU: {item.sku}</span>
                          </div>
                          <div className={styles.stockoutMain}>
                            <div className={styles.stockoutDaysBlock}>
                              <span className={styles.stockoutDaysNum}>{item.days_remaining}</span>
                              <span className={styles.stockoutDaysLabel}>days left</span>
                            </div>
                            <div className={styles.stockoutDateBlock}>
                              <p className={styles.stockoutDateSub}>Predicted stockout on</p>
                              <p className={styles.stockoutDateVal}>{item.stockout_date}</p>
                            </div>
                          </div>
                          <div className={styles.stockoutStatGrid}>
                            <div className={styles.stockoutStatChip}>
                              <span className={styles.stockoutStatLabel}>Current Stock</span>
                              <span className={styles.stockoutStatVal}>{item.current_qty} units</span>
                            </div>
                            <div className={styles.stockoutStatChip}>
                              <span className={styles.stockoutStatLabel}>Daily Rate</span>
                              <span className={styles.stockoutStatVal}>{item.daily_rate}/day</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Tabs — outside sliderOuter, only shown on slide 0 */}
              {slideIndex === 0 && (
                <div className={styles.forecastTabs}>
                  {(["Weekly", "Quarterly", "Yearly"] as ForecastView[]).map((v) => (
                    <button
                      key={v}
                      className={`${styles.forecastTab} ${forecastView === v ? styles.forecastTabActive : ""}`}
                      onClick={() => setForecastView(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dot indicators — outside the panel */}
            <div className={styles.slideDots}>
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  className={`${styles.slideDot} ${slideIndex === i ? styles.slideDotActive : ""}`}
                  onClick={() => setSlideIndex(i)}
                />
              ))}
            </div>

            {/* Forecast Revenue */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3 className={styles.panelTitle}>Forecast Revenue</h3>
                  <p className={styles.panelSub}>
                    January 1 – December 31, {new Date().getFullYear()}
                  </p>
                </div>
                {charts && (
                  <div className={styles.revenueSummary}>
                    <p className={styles.revenueTotal}>{fmt(charts.forecastTotal)}</p>
                    <span className={`${styles.statBadge} ${metrics && metrics.salesChange >= 0 ? styles.badgeGreen : styles.badgeRed}`}>
                      {metrics ? `${metrics.salesChange >= 0 ? "+" : ""}${metrics.salesChange}%` : ""} {metrics && metrics.salesChange >= 0 ? <AiOutlineRise size={13} /> : <AiOutlineFall size={13} />}
                    </span>
                    <p className={styles.panelSub}>From last year</p>
                  </div>
                )}
              </div>

              {loading ? (
                <div className={styles.skeletonBlock} />
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={charts?.monthlySales ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#164163" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#164163" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      formatter={(value) => fmt(typeof value === "number" ? value : Number(value))}
                      labelStyle={{ color: "#164163" }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#164163" strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className={styles.column}>

            {/* Quick POS */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3 className={styles.panelTitle}>Quick POS</h3>
                  <p className={styles.panelSub}>Recent in-store &amp; online orders at a glance.</p>
                </div>
                <div className={styles.posHeaderRight}>
                  <span className={styles.posToday}>Today</span>
                  <button className={styles.posRedirectBtn} onClick={() => onNavigate?.("Orders")} title="Go to Orders">
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
                      <div key={o.orderId} className={styles.posCard} onClick={() => handleCardClick(o.orderId)}>
                        <div className={styles.posCardTop}>
                          <p className={styles.posCustomer}>{o.customerName.length > 14 ? o.customerName.slice(0, 13) + ".." : o.customerName}</p>
                          <span
                            className={`${styles.posBadge} ${isPaid ? styles.posBadgePaid : styles.posBadgePending}`}
                          >
                            {isPaid ? "Paid" : o.status}
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

            {/* Goal + Top Yearly Sales */}
            <div className={styles.bottomRow}>

              {/* Goal */}
              <div className={styles.miniPanel}>
                <h3 className={styles.panelTitle}>Goal</h3>
                <p className={styles.panelSub}>This year&apos;s goal</p>
                {loading ? (
                  <div className={styles.skeletonBlock} />
                ) : (
                  <div className={styles.goalWrapper}>
                    <PieChart width={150} height={150}>
                      <Pie
                        data={donutData}
                        cx={70}
                        cy={70}
                        innerRadius={50}
                        outerRadius={68}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        <Cell fill="#164163" />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                    <div className={styles.goalCenter}>
                      <p className={styles.goalPct}>{goalPct.toFixed(0)}%</p>
                      <p className={styles.goalLabel}>Growth Rate</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Top Yearly Sales */}
              <div className={styles.miniPanel}>
                <h3 className={styles.panelTitle}>Top Yearly Sales</h3>
                {loading ? (
                  <div className={styles.skeletonBlock} />
                ) : (
                  <div className={styles.yearlyList}>
                    {charts?.yearlySales.map((y) => (
                      <div key={y.year} className={styles.yearlyRow}>
                        <span className={styles.yearlyYear}>{y.year}</span>
                        <div className={styles.yearlyRight}>
                          <span className={styles.yearlyTotal}>{fmt(y.total)}</span>
                          {y.change != null && (
                            <span className={`${styles.yearlyChange} ${y.change >= 0 ? styles.positive : styles.negative}`}>
                              {y.change >= 0 ? "+" : ""}{y.change}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ── Receipt Status Confirm Modal ── */}
      {confirmReceiptAction !== null && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmReceiptAction(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={confirmReceiptAction === "RECEIVED" ? styles.confirmHeader : styles.confirmHeaderAmber}>
              <div className={styles.confirmIconCircle}>
                {confirmReceiptAction === "RECEIVED"
                  ? <MdOutlineCheckCircle className={styles.confirmCheckIcon} />
                  : <MdOutlineStorefront className={styles.confirmAmberIcon} />}
              </div>
            </div>
            <div className={styles.confirmBody}>
              <p className={styles.confirmTitle}>
                {confirmReceiptAction === "RECEIVED" ? "Mark as Received?" : "Mark as Preparing?"}
              </p>
              <p className={styles.confirmMessage}>
                {confirmReceiptAction === "RECEIVED"
                  ? <><strong>Received</strong> status means the customer has collected their order. This cannot be undone.</>
                  : <>This will move the order to <strong>Preparing</strong> status.</>}
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.confirmCancelBtn} onClick={() => setConfirmReceiptAction(null)}>
                  Cancel
                </button>
                <button
                  className={confirmReceiptAction === "RECEIVED" ? styles.confirmGreenBtn : styles.confirmAmberBtn}
                  onClick={() => { handleReceiptStatusAdvance(confirmReceiptAction); setConfirmReceiptAction(null); }}
                >
                  {confirmReceiptAction === "RECEIVED" ? "Yes, Mark as Received" : "Yes, Mark as Preparing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {receipt && (
        <div className={styles.receiptOverlay} onClick={() => setReceipt(null)}>
          <div className={styles.receiptModal} onClick={e => e.stopPropagation()} id="receipt-print-area">
            <div className={styles.receiptHeader}>
              <div>
                <p className={styles.receiptTitle}>Order Receipt</p>
                <p className={styles.receiptOrderId}>#{receipt.orderId}</p>
              </div>
              <button className={styles.receiptClose} onClick={() => setReceipt(null)}>✕</button>
            </div>
            {receiptLoading ? (
              <div className={styles.receiptLoading}>Loading...</div>
            ) : (
              <>
                <div className={styles.receiptMeta}>
                  <div>
                    <p className={styles.receiptMetaLabel}>Customer</p>
                    <p className={styles.receiptMetaVal}>{receipt.customerName}</p>
                  </div>
                  <div className={styles.receiptMetaRight}>
                    <p className={styles.receiptMetaLabel}>{receipt.orderDate}</p>
                    <p className={styles.receiptMetaVal}>{receipt.paymentMethod}</p>
                  </div>
                </div>
                <div className={styles.receiptDivider} />
                <div className={styles.receiptItemsHeader}>
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Amount</span>
                </div>
                <div className={styles.receiptItems}>
                  {receipt.items.map((item, i) => (
                    <div key={i} className={styles.receiptItem}>
                      <span className={styles.receiptItemName}>{item.item_name}</span>
                      <span className={styles.receiptItemQty}>{item.quantity} {item.uom}</span>
                      <span className={styles.receiptItemTotal}>{fmt(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.receiptDivider} />
                <div className={styles.receiptTotal}>
                  <span>Total</span>
                  <span>{fmt(receipt.totalAmount)}</span>
                </div>
                <div className={styles.receiptStatusActions}>
                  {receipt.status === "PENDING" && (
                    <button className={styles.receiptStatusBtn} onClick={() => setConfirmReceiptAction("PREPARING")}>
                      Mark as Preparing
                    </button>
                  )}
                  {(receipt.status === "PENDING" || receipt.status === "PREPARING") && (
                    <button className={`${styles.receiptStatusBtn} ${styles.receiptStatusBtnGreen}`} onClick={() => setConfirmReceiptAction("RECEIVED")}>
                      Mark as Received
                    </button>
                  )}
                  {receipt.status === "RECEIVED" && (
                    <span className={styles.receiptStatusDone}>✓ Received</span>
                  )}
                </div>
                <button className={styles.receiptPrintBtn} onClick={handlePrint}>
                  Print Receipt
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
