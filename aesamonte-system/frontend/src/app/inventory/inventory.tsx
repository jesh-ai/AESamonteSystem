/* eslint-disable prefer-const */
    /* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import styles from "@/css/inventory.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import ExportRequestModal from '@/components/features/ExportRequestModal';
import RestrictedAccessModal from '@/components/features/RestrictedAccessModal';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import type { ModulePerms } from '@/types/user';
import AddInventoryModal from './addInventoryModal';
import EditInventoryModal from './editInventoryModal';
import ExportModal from './exportModal';
import ArchiveTable from './archiveInvModal';
import AddSupplierModal from '@/app/suppliers/addSupplierModal';
import UomModal from './UomModal';
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
  LuPackage,
} from "react-icons/lu";

/* ================= TYPES ================= */

interface InventoryProps {
  role: string;
  employeeId?: number;
  onLogout: () => void;
  initialSearch?: string;
  permissions?: ModulePerms;
}

interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string;
  contactNumber?: string;
}

interface Brand {
  id: number;
  code: string;
  name: string;
}

interface UOM {
  code: string;
  id: number;
  name: string;
}

interface BrandVariant {
  brand_id: number;
  brand_name: string;
  sku: string;
  unit_price: number;
  selling_price: number;
  qty: number;
  description?: string;
  item_description?: string;
}

interface SupplierInfo {
  supplier_id: number;
  supplier_name: string;
  contact_person?: string;
  contact_number?: string;
}

export interface Product {
  id: string;
  item_name: string;
  item_description?: string;
  qty: number;
  uom: string;
  status: string;
  is_archived?: boolean;
  brands: BrandVariant[];
  suppliers: SupplierInfo[];
}

interface InventorySummary {
  totalProducts: number;
  totalProductsChange: number;
  weeklyInventory: number;
  monthlyInventory: number;
  yearlyInventory: number;
  outOfStockCount: number;
  outOfStockItems: Product[];
  lowStockItems: Product[];
}

const ROWS_PER_PAGE = 10;

const displayBrandName = (name: string) => (!name || name === 'No Brand') ? 'Generic' : name;

const Inventory: React.FC<InventoryProps> = ({ role, employeeId = 0, onLogout, initialSearch, permissions }) => {
  const s = styles as Record<string, string>;
  const { guard, denied, dismiss } = usePermissionGuard();

  const [products, setProducts] = useState<Product[]>([]);
  const [data, setData] = useState<InventorySummary>({
    totalProducts: 0, totalProductsChange: 0,
    weeklyInventory: 0, monthlyInventory: 0, yearlyInventory: 0,
    outOfStockCount: 0, outOfStockItems: [], lowStockItems: [],
  });

  const [searchTerm, setSearchTerm] = useState(initialSearch ?? '');
  useEffect(() => { if (initialSearch) setSearchTerm(initialSearch); }, [initialSearch]);

  const [sortConfig, setSortConfig] = useState<{ key: keyof Product | ''; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiveView, setIsArchiveView] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [defaultSupplierName, setDefaultSupplierName] = useState<string>('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportRequestModal, setShowExportRequestModal] = useState(false);
  const [showUomModal, setShowUomModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [exportType, setExportType] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);

  // ── UOM FILTER ──
  const [uomFilter, setUomFilter] = useState<string>('All UOM');
  const [isUomDropdownOpen, setIsUomDropdownOpen] = useState(false);

  // ── STATUS FILTER (ported from Sales) ──
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const STATUS_OPTIONS = ['All Status', 'Available', 'Low Stock', 'Out of Stock'];

  const getStatusBadgeColor = (status: string) => {
    if (status === 'Available') return '#10b981';
    if (status === 'Low Stock') return '#f59e0b';
    if (status === 'Out of Stock') return '#ef4444';
    return '#9ca3af';
  };

  const handleExportSuccess = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setIsError(type === 'error');
    setShowToast(true);
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory?t=${new Date().getTime()}`, {
        method: "GET", headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const productData: Product[] = await res.json();
      setProducts(productData);

      const activeProducts = productData.filter(p => !p.is_archived);
      const outOfStock = activeProducts.filter(p => p.qty === 0 || p.status?.toLowerCase().includes("out of stock"));
      const lowStock   = activeProducts.filter(p => p.status?.toLowerCase().includes("low stock") && p.qty > 0);

      setData(prev => ({
        ...prev,
        totalProducts: activeProducts.length,
        outOfStockCount: outOfStock.length,
        outOfStockItems: outOfStock,
        lowStockItems: lowStock,
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
        totalProductsChange: summary.totalProductsChange || 0,
      }));
    } catch (err) {
      console.error("Failed to fetch summary", err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) { const d = await res.json(); setSuppliers(d); }
    } catch (err) { console.error("Failed to fetch suppliers", err); }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      if (res.ok) { const d = await res.json(); setBrands(d); }
    } catch (err) { console.error("Failed to fetch brands", err); }
  };

  const fetchUoms = async () => {
    try {
      const res = await fetch("/api/uom");
      if (res.ok) { const d = await res.json(); setUoms(d); }
    } catch (err) { console.error("Failed to fetch UOMs", err); }
  };


  useEffect(() => {
    fetchInventory();
    fetchInventorySummary();
    fetchSuppliers();
    fetchBrands();
    fetchUoms();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setActiveMenuId(null);
      // Close date/status dropdowns when clicking outside
      const target = event.target as HTMLElement;
      if (!target.closest('[data-filter="uom"]')) setIsUomDropdownOpen(false);
      if (!target.closest('[data-filter="status"]')) setIsStatusDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleArchive = async (id: string) => {
    try {
      const response = await fetch(`/api/inventory/archive/${id}`, { method: 'PUT' });
      if (response.ok) {
        const apiData = await response.json();
        setProducts(prev => prev.map(p => p.id === id ? { ...p, is_archived: apiData.is_archived, status: apiData.new_status } : p));
        fetchInventorySummary();
        handleExportSuccess(apiData.is_archived ? "Moved to Archive" : "Restored from Archive", 'success');
        setActiveMenuId(null);
      } else {
        const errorData = await response.json();
        handleExportSuccess(`Failed: ${errorData.error}`, "error");
      }
    } catch {
      handleExportSuccess("Network error. Is Flask running?", "error");
    }
  };

  const requestSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleViewClick = async (product: Product) => {
    setViewProduct(product);
    setShowViewModal(true);
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/inventory/${product.id}`);
      if (res.ok) {
        const full = await res.json();
        setViewProduct((prev: any) => prev?.id === product.id ? { ...prev, brands: full.brands, suppliers: full.suppliers } : prev);
      }
    } catch { /* keep list data as fallback */ }
  };

  const handleEditClick = async (product: Product) => {
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/inventory/${product.id}`);
      if (res.ok) {
        const fullData = await res.json();
        setSelectedProduct(fullData);
      } else {
        setSelectedProduct({ id: product.id, itemName: product.item_name, itemDescription: product.item_description, uom: product.uom, brands: product.brands || [], suppliers: [] });
      }
      setShowEditModal(true);
    } catch {
      setSelectedProduct({ id: product.id, itemName: product.item_name, itemDescription: product.item_description, uom: product.uom, brands: product.brands || [], suppliers: [] });
      setShowEditModal(true);
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
      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
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

  const filteredProducts = products.filter(p => {
    const matchesArchiveView = isArchiveView ? Boolean(p.is_archived) : !p.is_archived;
    const brandNames = (p.brands || []).map(b => b.brand_name).join(' ');
    const supplierNames = (p.suppliers || []).map(s => s.supplier_name).join(' ');
    const searchStr = `${p.id} ${p.item_name} ${brandNames} ${supplierNames}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    // ── STATUS FILTER ──
    const matchesStatus = statusFilter === 'All Status' || p.status?.includes(statusFilter);
    const matchesUom = uomFilter === 'All UOM' || p.uom === uomFilter;
    return matchesArchiveView && matchesSearch && matchesStatus && matchesUom;
  });

  // Priority: Out of Stock = 0, Low Stock = 1, everything else = 2
  const getStatusPriority = (status: string) => {
    if (status?.includes('Out of Stock')) return 0;
    if (status?.includes('Low Stock')) return 1;
    return 2;
  };

  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    const baseSort = !sortConfig.key || !sortConfig.direction
      ? (a: Product, b: Product) => Number(a.id) - Number(b.id)
      : (a: Product, b: Product) => {
          const key = sortConfig.key as keyof Product;
          const A = a[key]; const B = b[key];
          if (typeof A === 'number' && typeof B === 'number') return sortConfig.direction === 'asc' ? A - B : B - A;
          const strA = String(A).toLowerCase(); const strB = String(B).toLowerCase();
          if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        };
    return arr.sort((a, b) => {
      const priorityDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff; // pin alert rows first
      return baseSort(a, b);                        // then apply normal sort within each group
    });
  }, [filteredProducts, sortConfig]);

const totalPages = Math.max(1, Math.ceil(sortedProducts.length / ROWS_PER_PAGE));
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, uomFilter]);
  const changePage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const renderPageNumbers = () => {
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) startPage = Math.max(1, endPage - maxVisible + 1);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <div key={i} className={`${s.pageCircle} ${currentPage === i ? s.pageCircleActive : ''}`} onClick={() => changePage(i)}>{i}</div>
      );
    }
    return pages;
  };

  const getStatusClass = (status: string) => {
    if (status?.includes('Available')) return s.viewStatusAvailable;
    if (status?.includes('Low Stock')) return s.viewStatusLowStock;
    return s.viewStatusOutOfStock;
  };

  const renderGrowthPill = (value: number) => {
    let icon = '—';
    let textColor = '#ca8a04';
    let bgColor = '#fef08a';
    if (value > 0) { icon = '↗'; textColor = '#15803d'; bgColor = '#dcfce7'; }
    else if (value < 0) { icon = '↘'; textColor = '#b91c1c'; bgColor = '#fee2e2'; }
    const displayValue = Math.abs(value);
    return (
      <span className={s.pill} style={{ color: textColor, backgroundColor: bgColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {icon} {displayValue}%
      </span>
    );
  };

  if (isLoading) return (
  <div className={s.container}>
    <TopHeader role={role} onLogout={onLogout} />
    <div className={s.mainContent}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div className={s.skeleton} style={{ width: 140, height: 28, marginBottom: 8 }} />
          <div className={s.skeleton} style={{ width: 260, height: 13 }} />
        </div>
        <div className={s.skeleton} style={{ width: 110, height: 36, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: '1.5rem' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.1rem 1.25rem' }}>
            <div className={s.skeleton} style={{ width: 80, height: 13, marginBottom: 10 }} />
            <div className={s.skeleton} style={{ width: '80%', height: 28, marginBottom: 12 }} />
            <div className={s.skeleton} style={{ width: '100%', height: 13 }} />
          </div>
        ))}
      </div>
      <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className={s.skeleton} style={{ width: 110, height: 20 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[100,100,34,180,60].map((w,i) => <div key={i} className={s.skeleton} style={{ width: w, height: 34, borderRadius: 6 }} />)}
          </div>
        </div>
        {[0,1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '0.5px solid #e5e7eb' }}>
            {[40,140,120,50,50,70,40].map((w,j) => (
              <div key={j} className={s.skeleton} style={{ width: w, height: 12, borderRadius: j === 5 ? 20 : 4, flexShrink: 0 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {showToast && (
        <div className={s.toastOverlay}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>{isError ? '!' : '✓'}</div>
            </div>
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>
              <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {denied && <RestrictedAccessModal onClose={dismiss} />}

      <div className={s.mainContent}>

        {/* HEADER ROW */}
        <div className={s.headerActions} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>INVENTORY</h1>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
              Manage products, stock levels, and supplier information.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {['Super Admin', 'Admin', 'Manager', 'Head'].includes(role) && (
          <ExportButton onSelect={(type) => {
            setExportType(type);
            setShowExportModal(true);
          }} />
        )}
       {(role === 'Staff' || role === 'Cashier') && (
        <button
          onClick={() => setShowExportRequestModal(true)}
          className={s.requestExportBtn}
        >
          Request Export
        </button>
      )}
         </div>
        </div>

        {/* STAT CARDS */}
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Products</p>
            <h2 className={s.bigNumber}>{data.totalProducts.toLocaleString()}</h2>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Inventory Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}><span>Weekly</span><span className={s.green}>{data.weeklyInventory.toLocaleString()}</span></div>
              <div className={s.listRow}><span>Monthly</span><span className={s.red}>{data.monthlyInventory.toLocaleString()}</span></div>
              <div className={`${s.listRow} ${s.altRow}`}><span>Yearly</span><span className={s.blue}>{data.yearlyInventory.toLocaleString()}</span></div>
            </div>
          </section>

          <section className={s.statCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <p className={s.cardTitle} style={{ margin: 0 }}>Stock Alerts</p>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                {(data.outOfStockItems?.length || 0) + (data.lowStockItems?.length || 0)} Total
              </span>
            </div>
            <div className={s.scrollContainer} style={{ height: '100px', overflowY: 'auto' }}>
              {data.outOfStockItems?.map(item => (
                <div key={`out-${item.id}`} className={s.pillRed} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>{item.item_name}</span>
                  <span style={{ fontWeight: 800 }}>{item.qty} {(item.uom || 'PCS').toUpperCase()}</span>
                </div>
              ))}
              {data.lowStockItems?.map(item => (
                <div key={`low-${item.id}`} className={s.pillYellow} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>{item.item_name}</span>
                  <span style={{ fontWeight: 800 }}>{item.qty} {(item.uom || 'PCS').toUpperCase()}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* TABLE / ARCHIVE */}
        {isArchiveView ? (
          <ArchiveTable products={products} onRestore={handleToggleArchive} onBack={() => setIsArchiveView(false)} />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h1 className={s.title}>Product List</h1>
              <div className={s.controls}>

                {/* ── UOM FILTER ── */}
                <div className={s.statusFilterContainer} data-filter="uom">
                  <button
                    className={`${s.statusFilterTrigger} ${isUomDropdownOpen ? s.statusFilterTriggerOpen : ''}`}
                    onClick={() => setIsUomDropdownOpen(prev => !prev)}
                  >
                    <span className={s.statusFilterLabel}>{uomFilter}</span>
                    <svg className={`${s.statusFilterChevron} ${isUomDropdownOpen ? s.statusFilterChevronOpen : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {isUomDropdownOpen && (
                    <div className={s.statusFilterMenu} style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      <button
                        className={`${s.statusFilterMenuItem} ${uomFilter === 'All UOM' ? s.statusFilterMenuItemActive : ''}`}
                        onClick={() => { setUomFilter('All UOM'); setIsUomDropdownOpen(false); setCurrentPage(1); }}
                      >
                        <span>All UOM</span>
                        {uomFilter === 'All UOM' && <svg className={s.statusFilterCheckmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </button>
                      {/* Divider */}
                      {uoms.length > 0 && <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />}
                      {uoms.map(u => (
                        <button
                          key={u.id}
                          className={`${s.statusFilterMenuItem} ${uomFilter === u.name ? s.statusFilterMenuItemActive : ''}`}
                          onClick={() => { setUomFilter(u.name); setIsUomDropdownOpen(false); setCurrentPage(1); }}
                        >
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                          {uomFilter === u.name && <svg className={s.statusFilterCheckmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── STATUS FILTER (same pattern as Sales) ── */}
                <div className={s.statusFilterContainer} data-filter="status">
                  <button
                    className={`${s.statusFilterTrigger} ${isStatusDropdownOpen ? s.statusFilterTriggerOpen : ''}`}
                    onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                  >
                    <span className={s.statusBadge} style={{ backgroundColor: getStatusBadgeColor(statusFilter) }}></span>
                    <span className={s.statusFilterLabel}>{statusFilter}</span>
                    <svg className={`${s.statusFilterChevron} ${isStatusDropdownOpen ? s.statusFilterChevronOpen : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {isStatusDropdownOpen && (
                    <div className={s.statusFilterMenu}>
                      {STATUS_OPTIONS.map(option => (
                        <button
                          key={option}
                          className={`${s.statusFilterMenuItem} ${statusFilter === option ? s.statusFilterMenuItemActive : ''}`}
                          onClick={() => { setStatusFilter(option); setIsStatusDropdownOpen(false); setCurrentPage(1); }}
                        >
                          <span className={s.statusMenuBadge} style={{ backgroundColor: getStatusBadgeColor(option) }}></span>
                          <span>{option}</span>
                          {statusFilter === option && (
                            <svg className={s.statusFilterCheckmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives"><LuArchive size={20} /></button>
                <div className={s.searchWrapper}>
                  <LuSearch size={18} className={s.searchIcon} />
                  <input className={s.searchInput} placeholder="Search by ID, Item, or Brand" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button className={s.addButton} onClick={guard(permissions?.can_create, () => { setDefaultSupplierName(''); setShowModal(true); })}>ADD</button>
              </div>
            </div>

            <div className={s.tableResponsive}>
              <table className={s.table}>
                <thead>
                  <tr>
                    {[
                      { label: 'ID', key: 'id' },
                      { label: 'ITEM', key: 'item_name' },
                      { label: 'BRANDS', key: 'brands' },
                      { label: 'TOTAL QTY', key: 'qty' },
                      { label: 'UOM', key: 'uom' },
                      { label: 'STATUS', key: 'status' },
                    ].map(col => (
                      <th
                        key={col.label}
                        onClick={() => col.key && requestSort(col.key as keyof Product)}
                        style={{ cursor: col.key ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                      >
                        <div className={s.sortableHeader}>
                          <span>{col.label}</span>
                          {col.key && (
                            <div className={s.sortIconsStack}>
                              <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                              <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className={s.actionHeader}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map(p => (
                    <tr key={p.id} onClick={() => handleViewClick(p)} style={{ cursor: 'pointer', height: '42px' }}>
                      <td>{p.id}</td>
                      <td>{p.item_name}</td>
                      <td style={{ fontSize: '0.83rem', color: '#374151' }}>
                        {(p.brands || []).length === 0 ? (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        ) : (
                          [...new Set((p.brands || []).map(b => displayBrandName(b.brand_name)))]
                            .map((name, i) => (
                              <span key={i}>
                                {i > 0 && <span style={{ color: '#d1d5db', margin: '0 4px' }}>•</span>}
                                {name}
                              </span>
                            ))
                        )}
                      </td>
                      <td>{p.qty}</td>
                      <td>{p.uom || '—'}</td>
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
                        <LuEllipsisVertical className={s.moreIcon} onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)} />
                        {activeMenuId === p.id && (
                          <div className={s.popoverMenu} ref={menuRef}>
                            <button className={s.popEditBtn} onClick={e => { e.stopPropagation(); guard(permissions?.can_edit, () => handleEditClick(p))(); }}><LuPencil size={12}/> Edit</button>
                            <button className={s.popArchiveBtn} onClick={e => { e.stopPropagation(); guard(permissions?.can_archive, () => handleToggleArchive(p.id))(); }}><LuArchive size={12}/> Archive</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={s.footer}>
              <div className={s.footerLeft}>
                Showing <span className={s.countBadge}>{paginatedProducts.length}</span> of {sortedProducts.length}
              </div>
                <div className={s.footerRight}>
                  <div className={s.pagination}>
                    <button className={s.nextBtn} onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}><LuChevronLeft /></button>
                    {renderPageNumbers()}
                    <button className={s.nextBtn} onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}><LuChevronRight /></button>
                  </div>
                </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => { setShowExportModal(false); setExportType(null); }}
        onSuccess={handleExportSuccess}
        data={products.filter(p => !p.is_archived)}
        summary={data}
        exportType={exportType}
      />

      <ExportRequestModal
        isOpen={showExportRequestModal}
        onClose={() => setShowExportRequestModal(false)}
        targetModule="Inventory"
        requesterId={employeeId}
        onSuccess={msg => handleExportSuccess(msg, 'success')}
      />

      <AddInventoryModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setDefaultSupplierName(''); }}
        onSave={handleSave}
        onOpenSupplierModal={() => setShowSupplierModal(true)}
        onOpenUomModal={() => setShowUomModal(true)}
        onBrandAdded={fetchBrands}  
        suppliers={suppliers}
        brands={brands}
        uoms={uoms}
        existingProducts={products}
        defaultSupplierName={defaultSupplierName}
      />

      <EditInventoryModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        itemData={selectedProduct}
        onSave={handleUpdate}
        onOpenUomModal={() => setShowUomModal(true)}
        onBrandAdded={fetchBrands} 
        onOpenSupplierModal={() => setShowSupplierModal(true)}
        suppliers={suppliers}
        brands={brands}
        uoms={uoms}
        existingProducts={products}
      />

      <AddSupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSuccess={msg => { setToastMessage(msg); setIsError(false); setShowToast(true); setShowSupplierModal(false); fetchSuppliers(); }}
        existingSuppliers={suppliers}
      />

      <UomModal
        isOpen={showUomModal}
        onClose={() => setShowUomModal(false)}
        onUomAdded={() => fetchUoms()}
      />

      {/* VIEW MODAL */}
      {showViewModal && viewProduct && (
        <div className={s.viewBackdrop} onClick={() => setShowViewModal(false)}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', width: '95vw' }}>
            <div className={s.viewModalHeader}>
              <div className={s.viewModalHeaderLeft}>
                <h2 className={s.viewItemName}>{viewProduct.item_name}</h2>
                <p className={s.viewItemSubtitle}>{viewProduct.id} • {viewProduct.uom || '—'}</p>
              </div>
              <div className={s.viewModalHeaderRight}>
                <span className={getStatusClass(viewProduct.status)}>{viewProduct.status}</span>
                <button className={s.viewCloseBtn} onClick={() => setShowViewModal(false)}><LuX size={20} /></button>
              </div>
            </div>

            <div className={s.viewBody}>

              {/* Suppliers */}
              {(viewProduct.suppliers || []).length > 0 && (
                <div className={s.viewSection} style={{ marginBottom: '16px' }}>
                  <p className={s.viewSectionTitle}>SUPPLIERS</p>
                  <table className={s.viewItemsTable}>
                    <thead>
                      <tr>
                        <th>SUPPLIER NAME</th>
                        <th>CONTACT PERSON</th>
                        <th>CONTACT NUMBER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewProduct.suppliers.map((sup: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{sup.supplier_name}</td>
                          <td>{sup.contact_person || '—'}</td>
                          <td>{sup.contact_number || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Brand Variants Table */}
              <div className={s.viewSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p className={s.viewSectionTitle} style={{ margin: 0 }}>BRAND VARIANTS</p>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '999px' }}>
                    Total Qty: {viewProduct.qty}
                  </span>
                </div>

                {(viewProduct.brands || []).length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>No brand variants recorded.</p>
                ) : (
                  <table className={s.viewItemsTable}>
                    <thead>
                      <tr>
                        <th>BRAND</th>
                        <th>SKU</th>
                        <th>DESCRIPTION</th>
                        <th>QTY</th>
                        <th>COST PRICE</th>
                        <th>SELLING PRICE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewProduct.brands.map((bv: any, i: number) => (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <LuPackage size={13} style={{ color: '#94a3b8' }} />
                              <span className={s.viewItemRowName}>{displayBrandName(bv.brand_name)}</span>
                            </div>
                          </td>
                          <td><span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>{bv.sku || '—'}</span></td>
                          <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{bv.description || '—'}</td>
                          <td>{bv.qty}</td>
                          <td>₱ {bv.unit_price?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</td>
                          <td>₱ {bv.selling_price?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;