'use client';

import React, { useState, useEffect } from 'react';
import styles from "@/css/inventory.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import { 
  LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown, 
  LuPencil, LuArchive, LuDownload, LuChevronRight
} from "react-icons/lu";

interface InventoryProps { role: string; onLogout: () => void; }

interface InventorySummary {
  totalProducts: number;
  totalProductsChange: number;
  weeklyInventory: number;
  monthlyInventory: number;
  yearlyInventory: number;
  outOfStockCount: number;
}

const Inventory: React.FC<InventoryProps> = ({ role, onLogout }) => {
  const s = styles as Record<string, string>;
  const [data, setData] = useState<InventorySummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    const visibleProducts = initialProducts.filter(p => p.qty > 0);
    const outOfStockItems = initialProducts.filter(p => p.qty === 0);

    setData({
      totalProducts: 5290,
      totalProductsChange: 2.8,
      weeklyInventory: 200,
      monthlyInventory: 20000,
      yearlyInventory: 200000,
      outOfStockCount: outOfStockItems.length,
    });
  }, []);


  const initialProducts = [
    { id: "110", item: "Highlighter", brand: "Miyagi", qty: 44, uom: "PACKS", unitPrice: 23.00, price: 1400.00 },
    { id: "008", item: "Sticky Notes", brand: "JOY HP-NS", qty: 34, uom: "PCS", unitPrice: 19.00, price: 646.00 },
    { id: "007", item: "Staple Remover", brand: "JOY", qty: 2, uom: "PCS", unitPrice: 19.00, price: 38.00 },
    { id: "006", item: "Pixma Canon 790 BKoration", brand: "PIXMA", qty: 2, uom: "PCS", unitPrice: 700.00, price: 1400.00 },
    { id: "005", item: "Double Sided Tape 3M", brand: "SCOTCH", qty: 3, uom: "PCS", unitPrice: 80.00, price: 240.00 },

    { id: "011", item: "Isopropyl Alcohol", brand: "Cleene", qty: 0, uom: "PCS", unitPrice: 75.00, price: 0.00 },
    { id: "012", item: "Ballpen", brand: "Deli", qty: 0, uom: "PCS", unitPrice: 7.00, price: 0.00 },
    { id: "013", item: "Folder", brand: "Veco", qty: 0, uom: "PCS", unitPrice: 13.00, price: 0.00 },
  ];

  const outOfStockItems = initialProducts.filter(p => p.qty === 0);

  const requestSort = (key: string, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  };

  const visibleProducts = initialProducts.filter(p => p.qty > 0);

    const filteredProducts = visibleProducts
  .filter((p) =>
    p.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.includes(searchTerm)
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aValue = a[sortConfig.key as keyof typeof a];
    const bValue = b[sortConfig.key as keyof typeof b];
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (!data) return null;

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>

        <div className={s.headerActions}>
          <ExportButton />
        </div>

        {/* Top Cards */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Products</p>
            <h2 className={s.bigNumber}>{data.totalProducts.toLocaleString()}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              <span className={s.pillRed}>↘ +{data.totalProductsChange}%</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Inventory Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}>
                <span className={s.listLabel}>Weekly Inventory</span>
                <span className={s.listValue}>
                  {data.weeklyInventory.toLocaleString()}
                </span>
              </div>

              <div className={s.listRow}>
                <span className={s.listLabel}>Monthly Inventory</span>
                <span className={s.listValue}>
                  {data.monthlyInventory.toLocaleString()}
                </span>
              </div>

              <div className={`${s.listRow} ${s.altRow}`}>
                <span className={s.listLabel}>Yearly Inventory</span>
                <span className={s.listValueBlue}>
                  {data.yearlyInventory.toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Out of Stock</p>
            <div className={s.outOfStockList}>
              {outOfStockItems.map(item => (
                <div key={item.id} className={s.outOfStockBadge}>
                  {item.item}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Product Table */}
        <div className={s.tableContainer}>
          <div className={s.header}>
            <h1 className={s.title}>Product List</h1>
            <div className={s.controls}>
              <button className={s.archiveIconBtn} title="View Archive">
                <LuArchive size={20} />
              </button>
              <div className={s.searchWrapper}>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className={s.searchInput} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <LuSearch size={18} color="#5f6368" />
              </div>
              <button className={s.addButton}>ADD</button>
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                {[
                  { label: 'No.', key: 'id' },
                  { label: 'ITEM', key: 'item' },
                  { label: 'BRAND', key: 'brand' },
                  { label: 'QTY', key: 'qty' },
                  { label: 'UOM', key: 'uom', sortable: false },
                  { label: 'UNIT PRICE', key: 'unitPrice' },
                  { label: 'PRICE', key: 'price' }
                ].map((col) => (
                  <th key={col.label}>
                    <div className={s.sortableHeader}>
                      <span className={s.columnLabel}>{col.label}</span>
                      {col.sortable !== false && (
                        <div className={s.sortIconsStack}>
                          <span 
                            className={`${s.arrowBtn} ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}`} 
                            onClick={() => requestSort(col.key, 'asc')}
                          >
                            <LuChevronUp size={12}/>
                          </span>
                          <span 
                            className={`${s.arrowBtn} ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}`} 
                            onClick={() => requestSort(col.key, 'desc')}
                          >
                            <LuChevronDown size={12}/>
                          </span>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                <th className={s.actionHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((p, index) => (
                <tr key={p.id} className={index % 2 !== 0 ? s.rowOdd : ''}>
                  <td>{p.id}</td>
                  <td style={{ fontWeight: 600 }}>{p.item}</td>
                  <td>{p.brand}</td>
                  <td>{p.qty}</td>
                  <td>{p.uom}</td>
                  <td>₱ {p.unitPrice.toFixed(2)}</td>
                  <td>₱ {p.price.toLocaleString()}</td>
                  <td className={s.actionCell}>
                    <div className={s.moreIcon} onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}>
                      <LuEllipsisVertical size={20} />
                    </div>
                    {openMenuId === p.id && (
                      <div className={s.popupMenu}>
                        <button className={s.popBtnAdd}>ADD</button>
                        <button className={s.popBtnEdit}><LuPencil size={14} /> Edit</button>
                        <button className={s.popBtnArchive}><LuDownload size={14} /> Archive</button>
                        <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.footer}>
            <div className={s.showDataText}>
              Show data <span className={s.countBadge}>{sortedProducts.length}</span> of {visibleProducts.length}
            </div>

            <div className={s.pagination}>
              <button className={s.pageCircleActive}>1</button>
              <button className={s.pageCircle}>2</button>
              <button className={s.pageCircle}>3</button>
              <button className={s.nextBtn}>
                Next <LuChevronRight size={18} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Inventory;
