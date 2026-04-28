"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "@/css/dashboard.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
}

interface MonthPoint { month: string; sales: number; }

interface SalesRevenueData {
  year: number;
  monthlySales: MonthPoint[];
  total: number;
  change: number;
}

export default function ForecastRevenuePanel() {
  const [data, setData] = useState<SalesRevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/dashboard/sales-revenue`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setData(json);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const year = data?.year ?? new Date().getFullYear() - 1;
  const isUp = (data?.change ?? 0) >= 0;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Sales Revenue</h3>
          <p className={styles.panelSub}>
            January 1 – December 31, {year}
          </p>
        </div>
        {data && (
          <div className={styles.revenueSummary}>
            <p className={styles.revenueTotal}>{fmt(data.total)}</p>
            <span className={`${styles.statBadge} ${isUp ? styles.badgeGreen : styles.badgeRed}`}>
              {isUp ? "↗ " : "↘ "}{Math.abs(data.change)}%
            </span>
            <p className={styles.panelSub}>From last year</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className={styles.skeletonBlock} />
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart
            data={data?.monthlySales ?? []}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#164163" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#164163" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              formatter={(value) => fmt(typeof value === "number" ? value : Number(value))}
              labelStyle={{ color: "#164163" }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#164163"
              strokeWidth={2}
              fill="url(#salesGrad)"
              dot={false}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
