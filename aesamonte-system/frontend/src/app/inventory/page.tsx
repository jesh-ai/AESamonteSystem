/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import styles from "@/css/inventory.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import AddInventoryModal from './addInventoryModal';
import EditInventoryModal from './editInventoryModal'; 
import ExportModal from './exportModal'; 
import {
  LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown,
  LuArchive, LuChevronLeft, LuChevronRight, LuPencil
} from "react-icons/lu";

/* ================= TYPES ================= */

interface InventoryProps {
  role: string;
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

interface Product {
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
}

interface InventorySummary {
  totalProducts: number;
  totalProductsChange: number;
  weeklyInventory: number;
  monthlyInventory: number;
  yearlyInventory: number;
  outOfStockCount: number;
}

const ROWS_PER_PAGE = 10;

const Inventory: React.FC<InventoryProps> = ({ role, onLogout }) => {
  const s = styles as Record<string, string>;

  /* ================= STATE ================= */
  const [products, setProducts] = useState<Product[]>([]);
  const [data, setData] = useState<InventorySummary>({
    totalProducts: 0,
    totalProductsChange: 0,
    weeklyInventory: 0,
    monthlyInventory: 0,
    yearlyInventory: 0,
    outOfStockCount: 0,
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | '';
    direction: 'asc' | 'desc' | null;
  }>({ key: '', direction: null });

  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  //Supplier States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // UOM States
  const [uoms, setUoms] = useState<UOM[]>([]);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); 
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); 
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    itemName: '',
    itemDescription: '',
    brand: '',
    internalSku: '',
    qty: '',
    uom: 'Select',
    reorderPoint: '',
    unitPrice: '',
    sellingPrice: '',
    detailSupplierName: 'Select',
    detailContactPerson: '',
    detailContactNumber: '', 
    detailCostPrice: '',
    detailLeadTime: '',
    detailMinOrder: ''
  });

  const [supplierFormData, setSupplierFormData] = useState({
    supplierName: '',
    address: '',
    contactPerson: '',
    contact: '', 
    email: '',
    paymentTerms: 'Cash on Delivery'
  });

  /* ================= EFFECTS ================= */

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch");
      const productData: Product[] = await res.json();
      setProducts(productData);

      const visible = productData.filter(p => p.qty > 0);
      const outOfStock = productData.filter(p => p.qty === 0);

      setData({
        totalProducts: productData.length,
        totalProductsChange: 2.8,
        weeklyInventory: visible.length,
        monthlyInventory: visible.length * 10,
        yearlyInventory: visible.length * 100,
        outOfStockCount: outOfStock.length,
      });
    } catch (err) {
      console.error("Failed to fetch Inventory", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);
  
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/suppliers");
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data);
        }
      } catch (err) {
        console.error("Failed to fetch suppliers", err);
      }
    };
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const fetchUOMs = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/uom");
        if (res.ok) {
          const data = await res.json();
          setUoms(data);
        }
      } catch (err) {
        console.error("Failed to fetch UOMs", err);
      }
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

  /* ================= HANDLERS ================= */

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>, isSupplierReg = false) => {
    const { name, value } = e.target;
    const cleanValue = value.replace(/[^\d]/g, '');
    
    if (isSupplierReg) {
      setSupplierFormData({ ...supplierFormData, [name]: cleanValue });
    } else {
      setFormData({ ...formData, [name]: cleanValue });
    }
  };

  const requestSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
    setActiveMenuId(null);
  };

  const handleUpdate = async (updatedItem: any) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/inventory/update/${updatedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem),
      });

      if (res.ok) {
        setShowEditModal(false);
        alert("Item updated successfully!");
        fetchInventory(); 
      } else {
        const err = await res.json();
        alert(`Error updating: ${err.error}`);
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  // NEW: Bulk Save Function
  const handleSave = async (items: any[]) => {
    try {
      // 1. Format the data to match Backend expectations
      const formattedItems = items.map(item => ({
        itemName: item.itemName,
        brand: item.brand,
        internalSku: item.internalSku,
        itemDescription: item.itemDescription,
        qty: Number(item.qty),
        uom: item.uom,
        unitPrice: Number(item.unitPrice),    // Cost Price
        sellingPrice: Number(item.sellingPrice),
        detailSupplierName: item.detailSupplierName, // Shared Supplier
        reorderPoint: Number(item.reorderPoint) || 0,
        detailLeadTime: Number(item.detailLeadTime) || 0,
        detailMinOrder: Number(item.detailMinOrder) || 0
      }));

      // 2. Send ONE request with the array
      const res = await fetch("http://127.0.0.1:5000/api/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedItems), // Send the list directly
      });

      if (res.ok) {
        const result = await res.json();
        alert(result.message); // "Successfully added X items"
        setShowModal(false);
        await fetchInventory(); // Refresh the table
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
      setShowModal(false);
      alert("All items saved successfully!"); // Changed message to reflect multiple items
      fetchInventory();
    } catch (err) {
      console.error("Submission error:", err);
    }
  };

  /* ================= DATA PROCESSING ================= */

  const filteredProducts = products.filter(p =>
    p.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toString().includes(searchTerm)
  );

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

  if (isLoading) return <div className={s.loadingContainer}>Loading Inventory...</div>; 

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.headerActions} 
         onClick={() => setShowExportModal(true)}>
         <ExportButton />
      </div>

        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Products</p>
            <h2 className={s.bigNumber}>{data.totalProducts}</h2>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Inventory Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}>Weekly Inventory <span>{data.weeklyInventory}</span></div>
              <div className={s.listRow}>Monthly Inventory <span>{data.monthlyInventory}</span></div>
              <div className={`${s.listRow} ${s.altRow}`}>Yearly Inventory <span>{data.yearlyInventory}</span></div>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Out of Stock</p>
            <div className={s.outOfStockList}>
              {products.filter(p => p.qty === 0).length > 0 ? (
                products.filter(p => p.qty === 0).map(p => <div key={p.id} 
                  className={s.outOfStockBadge}>{p.item_name}</div>)
              ) : ( <p className={s.subText}>All items in stock</p> )}
            </div>
          </section>
        </div>

        <div className={s.tableContainer}>
          <div className={s.header}>
            <h1 className={s.title}>Product List</h1>
            <div className={s.controls}>
              <LuArchive size={20} />
              <div className={s.searchWrapper}>
                <input className={s.searchInput} placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <LuSearch size={18} />
              </div>
              <button className={s.addButton} onClick={() => setShowModal(true)}>ADD</button>
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
                        <LuChevronUp
                          className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                        />
                        <LuChevronDown
                          className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                        />
                      </div>
                    </div>
                  </th>
                ))}
                <th className={s.actionHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map(p => (
                <tr key={p.id}>
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
                    <span
                      className={
                        p.status.includes("Available")
                          ? s.pillGreen
                          : p.status.includes("Low Stock")
                          ? s.pillYellow
                          : p.status.includes("Out of Stock")
                          ? s.pillRed
                          : ""
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className={s.actionCell}>
                    <LuEllipsisVertical
                      className={s.moreIcon}
                      onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}
                    />

                    {activeMenuId === p.id && (
                      <div className={s.popoverMenu} ref={menuRef}>
                        <button className={s.popAddBtn} onClick={() => setShowModal(true)}>ADD</button>
                        <button className={s.popEditBtn} onClick={() => handleEditClick(p)}><LuPencil size={12}/> Edit</button>
                        <button className={s.popArchiveBtn}><LuArchive size={12}/> Archive</button>
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
      </div>


      {/* --- ADDED: Export Modal --- */}
      <ExportModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      
      <AddInventoryModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        onOpenSupplierModal={() => setShowSupplierModal(true)}
        suppliers={suppliers}
        uoms={uoms} // <--- Pass the data here
      />

      <EditInventoryModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        itemData={selectedProduct}
        onSave={handleUpdate}
        suppliers={suppliers}
      />

      {showSupplierModal && (
        <div className={s.modalOverlaySupplier}>
          <div className={s.modalContentSupplier}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title}>Register New Supplier</h2>
                <p className={s.subText}>Create a profile for a new supplier.</p>
              </div>
             </div>
            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Supplier Name</label>
                  <input name="supplierName" value={supplierFormData.supplierName} onChange={(e) => setSupplierFormData({...supplierFormData, supplierName: e.target.value})} />
                </div>
              </div>
              <div className={s.formGroupFull}>
                <label>Address</label>
                <input name="address" value={supplierFormData.address} onChange={(e) => setSupplierFormData({...supplierFormData, address: e.target.value})} />
              </div>
              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Contact Person</label>
                  <input name="contactPerson" value={supplierFormData.contactPerson} onChange={(e) => setSupplierFormData({...supplierFormData, contactPerson: e.target.value})} />
                </div>
                <div className={s.formGroup}>
                  <label>Contact No.</label>
                  <input name="contact" value={supplierFormData.contact} onChange={(e) => handleNumericInputChange(e, true)} />
                </div>
              </div>
              <div className={s.formGroupFull}>
                <label>Email Address</label>
                <input name="email" value={supplierFormData.email} onChange={(e) => setSupplierFormData({...supplierFormData, email: e.target.value})} />
              </div>
              <h4 className={s.sectionTitle}>Terms & Notes</h4>
              <div className={s.formGroup}>
                <label>Payment Terms</label>
                <select name="paymentTerms" value={supplierFormData.paymentTerms} onChange={(e) => setSupplierFormData({...supplierFormData, paymentTerms: e.target.value})}>
                  <option>Cash on Delivery</option>
                  <option>Card</option>
                </select>
              </div>
              <div className={s.modalFooter}>
                <button type="button" onClick={() => setShowSupplierModal(false)} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={() => setShowSupplierModal(false)} className={s.createBtn}>Create Supplier</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;