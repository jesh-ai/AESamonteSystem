"use client";

import { useState } from "react";
import styles from "@/css/dashboard.module.css";
import { ChartsData, InsightsData, ForecastView, PeriodSalesMonth } from "./types";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface ForecastingPanelProps {
  charts: ChartsData | null;
  insights: InsightsData | null;
  loading: boolean;
}

export default function ForecastingPanel({ charts, insights, loading }: ForecastingPanelProps) {
  const [forecastView, setForecastView] = useState<ForecastView>("Weekly");
  const [slideIndex, setSlideIndex] = useState(0);

  const forecastPeriods: PeriodSalesMonth[] =
    charts == null
      ? []
      : forecastView === "Weekly"
      ? (charts.weeklySales ?? [])
      : forecastView === "Quarterly"
      ? (charts.quarterlySales ?? [])
      : (charts.lastTwelveMonths ?? []);

  const maxPeriod = Math.max(...forecastPeriods.map((p) => p.total), 1);
  const sorted = [...forecastPeriods].sort((a, b) => b.total - a.total);
 
  return (
    <>
      <div className={`${styles.panel} ${styles.panelCream}`}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>
              {slideIndex === 0
                ? "Sales Forecasting"
                : slideIndex === 1
                ? "Smart Reorder Suggestion"
                : "Stock-Out Prediction"}
            </h3>
            {slideIndex === 0 && <p className={styles.panelSub}>{forecastView}</p>}
          </div>
        </div>

        <div
          className={styles.sliderOuter}
          style={{ height: slideIndex === 0 ? "210px" : "270px", cursor: "pointer" }}
          onClick={() => setSlideIndex((prev) => (prev + 1) % 3)}
        >
          <div
            className={styles.sliderTrack}
            style={{ transform: `translateX(-${slideIndex * 100}%)` }}
          >
            {/* Slide 0: Forecast Cards */}
            <div className={styles.slide}>
              {loading ? (
                <div className={styles.skeletonBlock} />
              ) : (
                <div
                className={`${styles.forecastCards} ${styles.forecastCardsScroll}`}
                >
                  {forecastPeriods.map((p, i) => {
                    const isTop = p.total === maxPeriod && p.total > 0;
                    const subLabel =
                      forecastView === "Monthly"
                        ? (p as PeriodSalesMonth).year ?? ""
                        : p.dateRange;
                    return (
                      <div
                        key={i}
                        className={`${styles.forecastCard} ${isTop ? styles.forecastCardActive : ""}`}
                      >
                         <div className={styles.forecastCardTop}> 
                        <p className={styles.forecastCardLabel}>{p.label}</p>
                        {subLabel && <p className={styles.forecastCardRange}>{subLabel}</p>}
                        </div>
                        <div className={styles.forecastCardBottom}>
                          <p className={styles.forecastCardTotal}>{fmt(p.total)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Slide 1: Smart Reorder Suggestion */}
            <div className={styles.slide}>
              {loading || !insights ? (
                <div className={styles.skeletonBlock} />
              ) : insights.reorderSuggestions.length === 0 ? (
                <p className={styles.slideEmpty}>No reorder suggestions at this time.</p>
              ) : (
                (() => {
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
                          <span className={styles.reorderStatVal}>
                            {item.forecast_demand} <em>units</em>
                          </span>
                        </div>
                        <div className={styles.reorderStatChip}>
                          <span className={styles.reorderStatLabel}>Safety Stock</span>
                          <span className={styles.reorderStatVal}>
                            {item.safety_stock} <em>units</em>
                          </span>
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
                })()
              )}
            </div>

            {/* Slide 2: Stock-Out Prediction */}
            <div className={styles.slide}>
              {loading || !insights ? (
                <div className={styles.skeletonBlock} />
              ) : insights.stockoutPredictions.length === 0 ? (
                <p className={styles.slideEmpty}>No stock-out risks detected.</p>
              ) : (
                (() => {
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
                })()
              )}
            </div>
          </div>
        </div>

        {slideIndex === 0 && (
          <div className={styles.forecastTabs}>
            {(["Weekly", "Quarterly", "Monthly"] as ForecastView[]).map((v) => (
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

      {/* Dot indicators */}
      <div className={styles.slideDots}>
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            className={`${styles.slideDot} ${slideIndex === i ? styles.slideDotActive : ""}`}
            onClick={() => setSlideIndex(i)}
          />
        ))}
      </div>
    </>
  );
}
