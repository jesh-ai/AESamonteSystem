export interface Metrics {
  salesToday: number;
  salesChange: number;
  pendingOrders: number;
  ordersChange: number;
  lowStock: number;
}

export interface RecentOrder {
  orderId: number;
  customerName: string;
  amount: number;
  status: string;
}

export interface ReceiptItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  uom: string;
}

export interface OrderReceipt {
  orderId: number;
  customerName: string;
  customerAddress: string;
  orderDate: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  items: ReceiptItem[];
}

export interface PeriodSales {
  label: string;
  dateRange: string;
  total: number;
}

export interface MonthlySales {
  month: string;
  sales: number;
}

export interface YearlySales {
  year: number;
  total: number;
  change: number | null;
}

export interface PeriodSalesMonth extends PeriodSales {
  year?: string;
}

export interface ChartsData {
  monthlySales: MonthlySales[];
  weeklySales: PeriodSales[];
  quarterlySales: PeriodSales[];
  lastTwelveMonths: PeriodSalesMonth[];
  yearlySales: YearlySales[];
  goalPercent: number;
  forecastTotal: number;
}

export interface ReorderSuggestion {
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

export interface StockoutPrediction {
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

export interface InsightsData {
  reorderSuggestions: ReorderSuggestion[];
  stockoutPredictions: StockoutPrediction[];
}

export type ForecastView = "Weekly" | "Quarterly" | "Monthly";
