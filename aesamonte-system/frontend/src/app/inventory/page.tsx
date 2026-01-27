'use client';

import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import {
  LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown,
  LuPencil, LuArchive, LuDownload, LuChevronRight
} from "react-icons/lu";

/* ================= TYPES ================= */

interface InventoryProps {
  role: string;
  onLogout: () => void;
}

interface Product {
  id: string;
  item: string;
  brand: string;
  qty: number;
  uom: string;
  unitPrice: number;
  price: number;
}

interface InventorySummary {
  totalProducts: number;
  totalProductsChange: number;
  weeklyInventory: number;
  monthlyInventory: number;
  yearlyInventory: number;
  outOfStockCount: number;
}

/* ================= COMPONENT ================= */

const Inventory: React.FC<InventoryProps> = ({ role, onLogout }) => {
  const s = styles as Record<string, string>;

  const [products, setProducts] = useState<Product[]>([]);
  const [data, setData] = useState<InventorySummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | '';
    direction: 'asc' | 'desc' | null;
  }>({ key: '', direction: null });

  /* ================= FETCH INVENTORY ================= */

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/inventory")
      .then(res => res.json())
      .then((data: Product[]) => {
        setProducts(data);

        const visible = data.filter(p => p.qty > 0);
        const outOfStock = data.filter(p => p.qty === 0);

        setData({
          totalProducts: data.length,
          totalProductsChange: 2.8,
          weeklyInventory: visible.length,
          monthlyInventory: visible.length * 10,
          yearlyInventory: visible.length * 100,
          outOfStockCount: outOfStock.length,
        });
      })
      .catch(err => console.error("Inventory fetch error:", err));
  }, []);

  /* ================= DERIVED DATA ================= */

  const visibleProducts = products.filter(p => p.qty > 0);
  const outOfStockItems = products.filter(p => p.qty === 0);

  const filteredProducts = visibleProducts.filter(p =>
    p.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.includes(searchTerm)
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: keyof Product, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  };

  if (!data) return null;

  /* ================= UI ================= */

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.headerActions}>
          <ExportButton />
        </div>

        {/* TOP CARDS */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Products</p>
            <h2 className={s.bigNumber}>{data.totalProducts}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              <span className={s.pillRed}>↘ {data.totalProductsChange}%</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Inventory Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}>
                Weekly Inventory <span>{data.weeklyInventory}</span>
              </div>
              <div className={s.listRow}>
                Monthly Inventory <span>{data.monthlyInventory}</span>
              </div>
              <div className={`${s.listRow} ${s.altRow}`}>
                Yearly Inventory <span>{data.yearlyInventory}</span>
              </div>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Out of Stock</p>
            <div className={s.outOfStockList}>
              {outOfStockItems.map(p => (
                <div key={p.id} className={s.outOfStockBadge}>
                  {p.item}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* TABLE */}
        <div className={s.tableContainer}>
          <div className={s.header}>
            <h1>Product List</h1>
            <div className={s.controls}>
              <LuArchive size={20} />
              <input
                className={s.searchInput}
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                {['id', 'item', 'brand', 'qty', 'uom', 'unitPrice', 'price'].map(key => (
                  <th key={key}>
                    <span>{key.toUpperCase()}</span>
                    <LuChevronUp onClick={() => requestSort(key as keyof Product, 'asc')} />
                    <LuChevronDown onClick={() => requestSort(key as keyof Product, 'desc')} />
                  </th>
                ))}
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {sortedProducts.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.item}</td>
                  <td>{p.brand}</td>
                  <td>{p.qty}</td>
                  <td>{p.uom}</td>
                  <td>₱ {p.unitPrice}</td>
                  <td>₱ {p.price}</td>
                  <td>
                    <LuEllipsisVertical onClick={() => setOpenMenuId(p.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.footer}>
            Showing {sortedProducts.length} of {visibleProducts.length}
            <LuChevronRight />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
