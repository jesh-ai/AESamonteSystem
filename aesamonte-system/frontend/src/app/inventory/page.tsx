/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import styles from "@/css/inventory.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import ExportRequestModal from '@/components/features/ExportRequestModal';
import AddInventoryModal from './addInventoryModal';
import EditInventoryModal from './editInventoryModal';
import ExportModal from './exportModal';
import ArchiveTable from './archiveInvModal';
import AddSupplierModal from '@/app/suppliers/addSupplierModal';
import {
  LuSearch, 
  LuEllipsisVertical, 
  LuChevronUp, 
  LuChevronDown,
  LuArchive, 
  LuChevronLeft, 
  LuChevronRight, 
  LuPencil,
  LuX,
} from "react-icons/lu";

/* ================= TYPES ================= */

interface InventoryProps {
  role: string;
  department?: string | null;
  employeeId?: number;
  onLogout: () => void;
}
interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string;
  contactNumber?: string;
}

interface UOM {
  id: number;
  code: string;
  name: string;
}

export interface Product {
  id: string;
  item_name: string;
  item_description: string;
  sku: string;
  brand: string;
  qty: number;
  uom: string;
  unitPrice: number;
  price: number;
  status: string;
  is_archived?: boolean;
}

interface InventorySummary {
  totalProducts: number;
  totalProductsChange: number;
  weeklyInventory: number;
  monthlyInventory: number;
  yearlyInventory: number;
  outOfStockCount: number;
  outOfStockItems: Product[];
}

const ROWS_PER_PAGE = 10;

const Inventory: React.FC<InventoryProps> = ({ role, department, employeeId = 0, onLogout }) => {
  const s = styles as Record<string, string>;

  // --- RBAC permission flags ---
  const isInventoryHead = role === 'Head' && department === 'Inventory';
  const isSalesHead     = role === 'Head' && department === 'Sales';
  const canModify       = ['Admin', 'Manager', 'Staff'].includes(role) || isInventoryHead;
  const canExport       = ['Admin', 'Manager'].includes(role) || isInventoryHead;
  const mustRequestExport = isSalesHead;

  /* ================= STATE ================= */
  const [products, setProducts] = useState<Product[]>([]);
  const [data, setData] = useState<InventorySummary>({
    totalProducts: 0,
    totalProductsChange: 0,
    weeklyInventory: 0,
    monthlyInventory: 0,
    yearlyInventory: 0,
    outOfStockCount: 0,
    outOfStockItems: [], 
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | '';
    direction: 'asc' | 'desc' | null;
  }>({ key: '', direction: null });

  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiveView, setIsArchiveView] = useState(false);

  // Supplier States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // UOM States
  const [uoms, setUoms] = useState<UOM[]>([]);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); 
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); 
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportRequestModal, setShowExportRequestModal] = useState(false);

  // View Modal States
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);

  // States for Alert Modal
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false); 
  
  // Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* ================= HANDLERS ================= */

  const handleExportSuccess = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setIsError(type === 'error');
    setShowToast(true);
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory?t=${new Date().getTime()}`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
        cache: "no-store" 
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const productData: Product[] = await res.json();
      setProducts(productData);
      const activeProducts = productData.filter(p => !p.is_archived);
      const outOfStock = activeProducts.filter(p => p.qty === 0);
      setData(prev => ({
        ...prev,
        totalProducts: activeProducts.length,
        totalProductsChange: 2.8,
        outOfStockCount: outOfStock.length,
        outOfStockItems: outOfStock,
      }));
    } catch (err) {
      console.error("Failed to fetch Inventory", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventorySummary = async () => {
    try {
      const res = await fetch("/api/inventory/summary", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const summary = await res.json();
      setData(prev => ({
        ...prev,
        weeklyInventory: summary.weekly,
        monthlyInventory: summary.monthly,
        yearlyInventory: summary.yearly,
      }));
    } catch (err) {
      console.error("Failed to fetch summary", err);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchInventorySummary();
  }, []);
  
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("/api/suppliers");
        if (res.ok) { const data = await res.json(); setSuppliers(data); }
      } catch (err) { console.error("Failed to fetch suppliers", err); }
    };
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const fetchUOMs = async () => {
      try {
        const res = await fetch("/api/uom");
        if (res.ok) { const data = await res.json(); setUoms(data); }
      } catch (err) { console.error("Failed to fetch UOMs", err); }
    };
    fetchUOMs();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ================= TOGGLE ARCHIVE ================= */
  const handleToggleArchive = async (id: string) => {
    try {
      const response = await fetch(`/api/inventory/archive/${id}`, { method: 'PUT' });
      if (response.ok) {
        const apiData = await response.json();
        setProducts(prev => prev.map(p => p.id === id ? { ...p, is_archived: apiData.is_archived, status: apiData.new_status } : p));
        fetchInventorySummary();
        const actionMsg = apiData.is_archived ? "Moved to Archive" : "Restored from Archive";
        handleExportSuccess(actionMsg, 'success');
        setActiveMenuId(null);
      } else {
        const errorData = await response.json();
        handleExportSuccess(`Failed: ${errorData.error}`, "error");
      }
    } catch (error) {
      handleExportSuccess("Network error. Is Flask running?", "error");
    }
  };

  /* ================= HANDLERS CONTINUED ================= */

  const requestSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleViewClick = (product: Product) => {
    setViewProduct(product);
    setShowViewModal(true);
    setActiveMenuId(null);
  };

  const handleEditClick = async (product: Product) => {
    try {
      const res = await fetch(`/api/inventory/${product.id}`);
      if (res.ok) {
        const fullData = await res.json();
        setSelectedProduct(fullData); 
        setShowEditModal(true);
        setActiveMenuId(null);
      } else {
        alert("Failed to load item details.");
      }
    } catch (err) {
      console.error("Error fetching item details:", err);
    }
  };

  const handleUpdate = async (updatedItem: any) => {
    try {
      const res = await fetch(`/api/inventory/update/${updatedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem),
      });
      if (res.ok) {
        setShowEditModal(false);
        handleExportSuccess("Item updated successfully!");
        await fetchInventory();
        await fetchInventorySummary(); 
      } else {
        const err = await res.json();
        handleExportSuccess(`Error updating: ${err.error}`, 'error');
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleSave = async (items: any[]) => {
    try {
      const formattedItems = items.map(item => ({
        itemName: item.itemName,
        brand: item.brand,
        internalSku: item.internalSku,
        itemDescription: item.itemDescription,
        qty: Number(item.qty),
        uom: item.uom,
        unitPrice: Number(item.unitPrice),
        sellingPrice: Number(item.sellingPrice),
        reorderPoint: Number(item.reorderPoint) || 0,
        supplierName: item.supplierName || '',
        leadTime: Number(item.leadTime) || 0,
        minOrder: Number(item.minOrder) || 0,
      }));
      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedItems), 
      });
      if (res.ok) {
        const result = await res.json();
        handleExportSuccess(result.message); 
        setShowModal(false);
        await fetchInventory();
        await fetchInventorySummary(); 
      } else {
        const err = await res.json();
        handleExportSuccess(`Error: ${err.error}`, 'error');
      }
    } catch (err) {
      console.error("Submission error:", err);
    }
  };

  /* ================= DATA PROCESSING ================= */

  const filteredProducts = products.filter(p => {
    const matchesArchiveView = isArchiveView ? Boolean(p.is_archived) : !p.is_archived;
    const searchStr = `${p.id} ${p.item_name} ${p.brand}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    return matchesArchiveView && matchesSearch;
  });

  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    if (!sortConfig.key || !sortConfig.direction) {
      return arr.sort((a, b) => Number(a.id) - Number(b.id));
    }
    const key = sortConfig.key as keyof Product;
    return arr.sort((a, b) => {
      const A = a[key];
      const B = b[key];
      if (typeof A === 'number' && typeof B === 'number') {
        return sortConfig.direction === 'asc' ? A - B : B - A;
      }
      const strA = String(A).toLowerCase();
      const strB = String(B).toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortConfig]);

  /* ================= PAGINATION ================= */

  const totalPages = Math.ceil(sortedProducts.length / ROWS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () =>
    Array.from({ length: totalPages }, (_, i) => (
      <div
        key={i + 1}
        className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
        onClick={() => changePage(i + 1)}
      >
        {i + 1}
      </div>
    ));

  /* ── Status badge class helper ── */
  const getStatusClass = (status: string) => {
    if (status?.includes('Available')) return s.viewStatusAvailable;
    if (status?.includes('Low Stock')) return s.viewStatusLowStock;
    return s.viewStatusOutOfStock;
  };

  if (isLoading) return <div className={s.loadingContainer}>Loading Inventory...</div>; 

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {/* DYNAMIC ALERT POP-UP (Success/Error) */}
      {showToast && (
        <div className={s.toastOverlay}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
                {isError ? '!' : '✓'}
              </div>
            </div>
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>
              <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={s.mainContent}>
        <div className={s.headerActions}>
          {canExport && (
            <div onClick={() => setShowExportModal(true)}>
              <ExportButton />
            </div>
          )}
          {mustRequestExport && (
            <button
              onClick={() => setShowExportRequestModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: '#475569', color: 'white', padding: '8px 18px',
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 500, fontSize: '0.9rem',
              }}
            >
              Request Export
            </button>
          )}
        </div>

        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Products</p>
            <h2 className={s.bigNumber}>{data.totalProducts.toLocaleString()}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              <span className={s.pill}>+{data.totalProductsChange}%</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Inventory Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}>
                <span>Weekly</span><span className={s.green}>{data.weeklyInventory.toLocaleString()}</span>
              </div>
              <div className={s.listRow}>
                <span>Monthly</span><span className={s.red}>{data.monthlyInventory.toLocaleString()}</span>
              </div>
              <div className={`${s.listRow} ${s.altRow}`}>
                <span>Yearly</span><span className={s.blue}>{data.yearlyInventory.toLocaleString()}</span>
              </div>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Out of Stock</p>
            <h2 className={s.bigNumber}>{data.outOfStockCount}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>Products currently unavailable</span>
            </div>
          </section>
        </div>

        {/* ================= CONDITIONAL RENDERING ================= */}
        {isArchiveView ? (
          <ArchiveTable 
            products={products} 
            onRestore={handleToggleArchive} 
            onBack={() => setIsArchiveView(false)} 
          />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h1 className={s.title}>Product List</h1>
              <div className={s.controls}>
                <button 
                  className={s.archiveIconBtn} 
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }} 
                  onClick={() => setIsArchiveView(true)} 
                  title="View Archives"
                >
                  <LuArchive size={20} />
                </button>
                <div className={s.searchWrapper}>
                  <input className={s.searchInput} placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <LuSearch size={18} />
                </div>
                {canModify && (
                  <button className={s.addButton} onClick={() => setShowModal(true)}>ADD</button>
                )}
              </div>
            </div>

            <table className={s.table}>
              <thead>
                <tr>
                  {[
                    { label: 'ID', key: 'id' },
                    { label: 'ITEM', key: 'item_name' },
                    { label: 'DESCRIPTION', key: 'item_description' },
                    { label: 'SKU', key: 'sku' },
                    { label: 'BRAND', key: 'brand' },
                    { label: 'QTY', key: 'qty' },
                    { label: 'UOM', key: 'uom' },
                    { label: 'UNIT PRICE', key: 'unitPrice' },
                    { label: 'PRICE', key: 'price' },
                    { label: 'STATUS', key: 'status' },
                  ].map(col => (
                    <th key={col.key} onClick={() => requestSort(col.key as keyof Product)}>
                      <div className={s.sortableHeader}>
                        <span>{col.label}</span>
                        <div className={s.sortIconsStack}>
                          <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                          <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className={s.actionHeader}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map(p => (
                  <tr key={p.id} onClick={() => handleViewClick(p)} style={{ cursor: 'pointer' }}>
                    <td>{p.id}</td>
                    <td>{p.item_name}</td>
                    <td>{p.item_description}</td>
                    <td>{p.sku}</td>
                    <td>{p.brand}</td>
                    <td>{p.qty}</td>
                    <td>{p.uom || '—'}</td>
                    <td>₱ {p.unitPrice?.toLocaleString()}</td>
                    <td>₱ {p.price?.toLocaleString()}</td>
                    <td>
                      <span className={
                        p.status.includes("Available") ? s.pillGreen
                        : p.status.includes("Low Stock") ? s.pillYellow
                        : p.status.includes("Out of Stock") ? s.pillRed
                        : ""
                      }>
                        {p.status}
                      </span>
                    </td>
                    <td className={s.actionCell} onClick={e => e.stopPropagation()}>
                      <LuEllipsisVertical
                        className={s.moreIcon}
                        onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}
                      />
                      {activeMenuId === p.id && (
                        <div className={s.popoverMenu} ref={menuRef}>
                          {canModify ? (
                            <>
                              <button className={s.popAddBtn} onClick={() => setShowModal(true)}>ADD</button>
                              <button className={s.popEditBtn} onClick={() => handleEditClick(p)}><LuPencil size={12}/> Edit</button>
                              <button className={s.popArchiveBtn} onClick={() => handleToggleArchive(p.id)}><LuArchive size={12}/> Archive</button>
                            </>
                          ) : (
                            <span style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '0.85rem' }}>
                              View only
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={s.footer}>
              <div className={s.footerLeft}>
                Showing <span className={s.countBadge}>{paginatedProducts.length}</span> of {sortedProducts.length}
              </div>
              {totalPages > 1 && (
                <div className={s.footerRight}>
                  <div className={s.pagination}>
                    <button className={s.nextBtn} onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}><LuChevronLeft /></button>
                    {renderPageNumbers()}
                    <button className={s.nextBtn} onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}><LuChevronRight /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- Export Modal --- */}
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onSuccess={handleExportSuccess} />

      {/* --- Export Request Modal --- */}
      <ExportRequestModal
        isOpen={showExportRequestModal}
        onClose={() => setShowExportRequestModal(false)}
        targetModule="Inventory"
        requesterId={employeeId}
        onSuccess={(msg) => handleExportSuccess(msg, 'success')}
      />

      <AddInventoryModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        onOpenSupplierModal={() => setShowSupplierModal(true)}
        suppliers={suppliers}
        uoms={uoms} 
      />

      <EditInventoryModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        itemData={selectedProduct}
        onSave={handleUpdate}
        suppliers={suppliers} 
        uoms={uoms}      
      />

      <AddSupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSuccess={(msg) => {
          setToastMessage(msg);
          setIsError(false);
          setShowToast(true);
          setShowSupplierModal(false);
        }}
      />

      {/* ===== INVENTORY VIEW MODAL ===== */}
      {showViewModal && viewProduct && (
        <div className={s.viewBackdrop} onClick={() => setShowViewModal(false)}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className={s.viewModalHeader}>
              <div className={s.viewModalHeaderLeft}>
                <h2 className={s.viewItemName}>{viewProduct.item_name}</h2>
                <p className={s.viewItemSubtitle}>
                  {viewProduct.id}&nbsp;•&nbsp;SKU: {viewProduct.sku || '—'}
                </p>
              </div>
              <div className={s.viewModalHeaderRight}>
                <span className={getStatusClass(viewProduct.status)}>
                  {viewProduct.status}
                </span>
                <button className={s.viewCloseBtn} onClick={() => setShowViewModal(false)}>
                  <LuX size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className={s.viewBody}>

              {/* Product Details */}
              <div className={s.viewSection}>
                <p className={s.viewSectionTitle}>PRODUCT DETAILS</p>
                <div className={s.viewSectionGrid}>
                  <div>
                    <p className={s.viewFieldLabel}>Brand</p>
                    <p className={s.viewFieldValue}>{viewProduct.brand || '—'}</p>
                  </div>
                  <div>
                    <p className={s.viewFieldLabel}>SKU</p>
                    <p className={s.viewFieldValueMono}>{viewProduct.sku || '—'}</p>
                  </div>
                  <div>
                    <p className={s.viewFieldLabel}>Unit (UOM)</p>
                    <p className={s.viewFieldValue}>{viewProduct.uom || '—'}</p>
                  </div>
                </div>
                {viewProduct.item_description && (
                  <div className={s.viewDescriptionRow}>
                    <p className={s.viewFieldLabel}>Description</p>
                    <p className={s.viewFieldValue}>{viewProduct.item_description}</p>
                  </div>
                )}
              </div>

              {/* Stock & Pricing table */}
              <table className={s.viewItemsTable}>
                <thead>
                  <tr>
                    <th>ITEM</th>
                    <th>QTY</th>
                    <th>UNIT COST</th>
                    <th>SELLING PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <p className={s.viewItemRowName}>{viewProduct.item_name}</p>
                      {viewProduct.uom && <p className={s.viewItemRowUnit}>{viewProduct.uom}</p>}
                    </td>
                    <td>{viewProduct.qty}</td>
                    <td>₱ {viewProduct.unitPrice?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</td>
                    <td>₱ {viewProduct.price?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</td>
                  </tr>
                </tbody>
              </table>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;