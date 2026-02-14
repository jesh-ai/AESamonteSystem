'use client';

import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import {
  LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown,
  LuArchive, LuChevronRight, LuX, LuPlus
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

const Inventory: React.FC<InventoryProps> = ({ role, onLogout }) => {
  const s = styles as Record<string, string>;

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

  const [showModal, setShowModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const [formData, setFormData] = useState({
    itemName: '',
    supplierName: '',
    brand: '',
    internalSku: '',
    qty: '',
    uom: 'Select',
    reorderPoint: '',
    unitPrice: '',
    sellingPrice: '',
    detailSupplierName: 'Select',
    detailContactPerson: '',
    detailContactNumber: '', // Will be restricted to numbers
    detailCostPrice: '',
    detailLeadTime: '',
    detailMinOrder: ''
  });

  const [supplierFormData, setSupplierFormData] = useState({
    supplierName: '',
    address: '',
    contactPerson: '',
    contact: '', // Will be restricted to numbers
    email: '',
    paymentTerms: 'Cash on Delivery'
  });

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    const fetchInventory = async () => {
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
        console.error("Inventory fetch error:", err);
      }
    };
    fetchInventory();
  }, []);

  /* ================= HANDLERS ================= */

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // NEW: Restricted handler for numeric fields
  const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>, isSupplierReg = false) => {
    const { name, value } = e.target;
    // Replace any character that is NOT a digit with an empty string
    const cleanValue = value.replace(/[^\d]/g, '');

    if (isSupplierReg) {
      setSupplierFormData({ ...supplierFormData, [name]: cleanValue });
    } else {
      setFormData({ ...formData, [name]: cleanValue });
    }
  };

  const requestSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://127.0.0.1:5000/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
      }
    } catch (err) { console.error(err); }
  };

  /* ================= DATA PROCESSING ================= */

  const filteredProducts = products.filter(p =>
    p.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toString().includes(searchTerm)
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.headerActions}><ExportButton /></div>

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
                products.filter(p => p.qty === 0).map(p => <div key={p.id} className={s.outOfStockBadge}>{p.item}</div>)
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
                  { label: 'ITEM', key: 'item' },
                  { label: 'BRAND', key: 'brand' },
                  { label: 'QTY', key: 'qty' },
                  { label: 'UOM', key: 'uom' },
                  { label: 'UNIT PRICE', key: 'unitPrice' },
                  { label: 'PRICE', key: 'price' }
                ].map((col) => (
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
              {sortedProducts.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td><td>{p.item}</td><td>{p.brand}</td><td>{p.qty}</td><td>{p.uom}</td>
                  <td>₱ {p.unitPrice?.toLocaleString()}</td><td>₱ {p.price?.toLocaleString()}</td>
                  <td className={s.actionCell}><LuEllipsisVertical className={s.moreIcon} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.footer}>
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{sortedProducts.length}</span> of {products.length}
            </div>
            <LuChevronRight />
          </div>
        </div>
      </div>

      {showModal && (
        <div className={s.modalOverlay} style={{ zIndex: 1000 }}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <label className={s.formLabel}>Item Name</label>
                <input name="itemName" className={s.itemNameInput} value={formData.itemName} onChange={handleInputChange} />
              </div>
              <LuX onClick={() => setShowModal(false)} className={s.closeIcon} style={{marginLeft: '15px'}} />
            </div>

            <form onSubmit={handleSave} className={s.modalForm}>
              <h4 className={s.sectionTitle}>Stocks</h4>
              <div className={s.formRowThree}>
                <div className={s.formGroup}><label>Quantity</label><input type="number" name="qty" value={formData.qty} onChange={handleInputChange} /></div>
                <div className={s.formGroup}>
                  <label>Unit of Measure</label>
                  <select name="uom" value={formData.uom} onChange={handleInputChange}>
                    <option value="Select">Select</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
                <div className={s.formGroup}><label>Reorder Point</label><input className={s.yellowInput} name="reorderPoint" value={formData.reorderPoint} onChange={handleInputChange} /></div>
              </div>
              <div className={s.formRow}>
                <div className={s.formGroup}><label>Unit Price</label><input name="unitPrice" value={formData.unitPrice} onChange={handleInputChange} /></div>
                <div className={s.formGroup}><label>Selling Price</label><input name="sellingPrice" value={formData.sellingPrice} onChange={handleInputChange} /></div>
              </div>

              <div className={s.supplierDetailsBox}>
                <div className={s.boxHeader}>
                  <h4>Supplier Details</h4>
                  <span className={s.addSupplierLink} onClick={() => setShowSupplierModal(true)} style={{cursor: 'pointer'}}>
                    <LuPlus /> Add New Supplier
                  </span>
                </div>
                <div className={s.formRowThree}>
                  <div className={s.formGroup}>
                    <label>Supplier Name</label>
                    <select name="detailSupplierName" value={formData.detailSupplierName} onChange={handleInputChange}><option>Select</option></select>
                  </div>
                  <div className={s.formGroup}><label>Contact Person</label><input name="detailContactPerson" value={formData.detailContactPerson} onChange={handleInputChange} /></div>
                  
                  {/* NUMERIC RESTRICTION*/}
                  <div className={s.formGroup}>
                    <label>Contact Number</label>
                    <input 
                      name="detailContactNumber" 
                      value={formData.detailContactNumber} 
                      onChange={handleNumericInputChange} 
                    />
                  </div>
                </div>
                <div className={s.formRowThree}>
                  <div className={s.formGroup}><label>Cost Price</label><input name="detailCostPrice" value={formData.detailCostPrice} onChange={handleInputChange} /></div>
                  <div className={s.formGroup}><label>Lead Time (Days)</label><input name="detailLeadTime" value={formData.detailLeadTime} onChange={handleInputChange} /></div>
                  <div className={s.formGroup}><label>Min. Order (MOQ)</label><input name="detailMinOrder" value={formData.detailMinOrder} onChange={handleInputChange} /></div>
                </div>
              </div>

              <div className={s.modalFooter}>
                <button type="button" onClick={() => setShowModal(false)} className={s.cancelBtn}>Cancel</button>
                <button type="submit" className={s.saveBtn}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= REGISTER NEW SUPPLIER MODAL ================= */}
      {showSupplierModal && (
        <div className={s.modalOverlaySupplier}>
          <div className={s.modalContentSupplier}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title}>Register New Supplier</h2>
                <p className={s.subText}>Create a profile for a new supplier.</p>
              </div>
              <LuX onClick={() => setShowSupplierModal(false)} className={s.closeIcon} />
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
                  <input 
                    name="contact" 
                    value={supplierFormData.contact} 
                    onChange={(e) => handleNumericInputChange(e, true)} 
                  />
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
                <button type="button" onClick={() => setShowSupplierModal(false)} className={s.cancelBtn}>
                  Cancel
                </button>
                <button type="button" onClick={() => setShowSupplierModal(false)} className={s.createBtn}>
                  Create Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;