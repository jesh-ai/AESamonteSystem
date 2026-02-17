/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import styles from "@/css/inventory.module.css";
import {LuPlus, LuTrash2 } from "react-icons/lu";

// Update interface to include contact info for auto-filling
interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string;
  contactNumber?: string;
}

interface AddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: any[]) => void;
  onOpenSupplierModal: () => void;
  suppliers: Supplier[];
}

// Fields specific to an Item
const INITIAL_ITEM = {
  itemName: '',
  brand: '',
  internalSku: '',
  itemDescription: '',
  qty: '',
  uom: 'Select',
  reorderPoint: '',
  unitPrice: '',   // Cost Price
  sellingPrice: '', // Selling Price
  detailLeadTime: '', // Restored
  detailMinOrder: ''  // Restored
};

// Fields specific to the Supplier (Shared)
const INITIAL_SUPPLIER = {
  detailSupplierName: '',
  detailContactPerson: '',
  detailContactNumber: ''
};

const AddInventoryModal: React.FC<AddInventoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onOpenSupplierModal,
  suppliers = []
}) => {
  const s = styles as Record<string, string>;

  // --- STATE ---
  const [supplierData, setSupplierData] = useState({ ...INITIAL_SUPPLIER });
  const [items, setItems] = useState<any[]>([{ ...INITIAL_ITEM }]);

  // Reset logic when modal opens
  useEffect(() => {
    if (isOpen) {
      setSupplierData({ ...INITIAL_SUPPLIER });
      setItems([{ ...INITIAL_ITEM }]);
    }
  }, [isOpen]);

  // --- HANDLERS ---

  const handleAddItem = () => {
    setItems([...items, { ...INITIAL_ITEM }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-SKU Logic
    if (field === 'itemName') {
      const name = value.trim().toUpperCase();
      if (name && !newItems[index].internalSku) {
        let prefix = "";
        const words = name.split(/\s+/);
        if (words.length >= 3) {
          prefix = words.slice(0, 3).map((w: string) => w[0]).join('');
        } else {
          prefix = name.replace(/[^A-Z]/g, '').substring(0, 3);
        }
        if (prefix.length < 3) prefix = prefix.padEnd(3, 'X');
        const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        newItems[index].internalSku = `${prefix}-${suffix}`;
      }
    }
    setItems(newItems);
  };

  const handleSupplierChange = (field: string, value: any) => {
    let newData = { ...supplierData, [field]: value };
    if (field === 'detailSupplierName') {
      const selectedSup = suppliers.find(s => s.supplierName === value);
      if (selectedSup) {
        newData = {
          ...newData,
          detailContactPerson: selectedSup.contactPerson || '',
          detailContactNumber: selectedSup.contactNumber || ''
        };
      }
    }
    setSupplierData(newData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Merge shared supplier data into every item
    const mergedItems = items.map(item => ({
      ...item,
      ...supplierData
    }));
    onSave(mergedItems);
  };

  if (!isOpen) return null;

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1000 }}>
      <div className={s.modalContent} style={{ maxHeight: '95vh', width: '900px', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden' }}>
        
        {/* --- HEADER --- */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea' }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Add Inventory Items</h2>
            <p className={s.subText}>Details entered here will apply to the selected supplier.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: '#f9fafb' }}>
          
          {/* --- SHARED SUPPLIER SECTION --- */}
          <div style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Supplier Details</h4>
                <span className={s.addSupplierLink} onClick={onOpenSupplierModal} style={{cursor: 'pointer', fontSize: '0.85rem', color: '#007bff', display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <LuPlus size={14} /> New Supplier
                </span>
              </div>
              <div className={s.formRowThree} style={{ gap: '15px' }}>
                <div className={s.formGroup}>
                  <label style={{fontSize: '0.8rem', fontWeight: 500, color: '#555', marginBottom: '4px'}}>Supplier Name</label>
                  <select 
                    value={supplierData.detailSupplierName} 
                    onChange={(e) => handleSupplierChange('detailSupplierName', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor: '#fff' }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((sup, i) => (
                       <option key={sup.id || i} value={sup.supplierName}>{sup.supplierName}</option>
                    ))}
                  </select>
                </div>
                <div className={s.formGroup}>
                  <label style={{fontSize: '0.8rem', fontWeight: 500, color: '#555', marginBottom: '4px'}}>Contact Person</label>
                  <input 
                    value={supplierData.detailContactPerson} 
                    onChange={(e) => handleSupplierChange('detailContactPerson', e.target.value)} 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
                  />
                </div>
                <div className={s.formGroup}>
                  <label style={{fontSize: '0.8rem', fontWeight: 500, color: '#555', marginBottom: '4px'}}>Contact Number</label>
                  <input 
                    value={supplierData.detailContactNumber} 
                    onChange={(e) => handleSupplierChange('detailContactNumber', e.target.value.replace(/[^\d]/g, ''))} 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
          </div>

          {/* --- SCROLLABLE ITEM LIST --- */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ 
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                padding: '20px',
                marginBottom: '20px',
                position: 'relative' 
              }}>
                
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600, fontSize: '1rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>{index + 1}</div>
                    Item Details
                  </div>
                  {items.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(index)}
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px' }}
                    >
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                {/* --- Row 1: Basic Info --- */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Item Name</label>
                    <input 
                      className={s.cleanInput} 
                      value={item.itemName} 
                      onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                      placeholder="e.g. Red Cotton Shirt"
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Brand</label>
                    <input 
                      className={s.cleanInput} 
                      value={item.brand} 
                      onChange={(e) => handleItemChange(index, 'brand', e.target.value)} 
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>SKU (Auto)</label>
                    <input 
                      className={`${s.cleanInput} ${s.readOnlyInput}`} 
                      value={item.internalSku} 
                      readOnly
                    />
                  </div>
                </div>

                {/* --- Row 2: Description --- */}
                <div style={{ marginBottom: '15px' }}>
                   <div className={s.formGroup}>
                    <label className={s.miniLabel}>Description</label>
                    <input
                      className={s.cleanInput} 
                      value={item.itemDescription}
                      onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)}
                      placeholder="Brief details..."
                    />
                  </div>
                </div>

                {/* --- Row 3: Stock & Units --- */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Quantity</label>
                    <input 
                      type="number" 
                      className={s.cleanInput} 
                      value={item.qty} 
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)} 
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Unit (UOM)</label>
                    <select 
                      className={s.cleanInput} 
                      value={item.uom} 
                      onChange={(e) => handleItemChange(index, 'uom', e.target.value)}
                    >
                      <option value="Select">Select</option>
                      <option value="PCS">PCS</option>
                      <option value="PAD">PAD</option>
                      <option value="BOX">BOX</option>
                      <option value="ROLL">ROLL</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Reorder Point</label>
                    <input 
                      type="number"
                      className={s.cleanInput} 
                      style={{ borderColor: '#fcd34d' }}
                      value={item.reorderPoint} 
                      onChange={(e) => handleItemChange(index, 'reorderPoint', e.target.value)} 
                    />
                  </div>
                  <div className={s.formGroup}>
                     {/* Placeholder for grid alignment */}
                  </div>
                </div>

                {/* --- Row 4: Supply & Pricing (The New Stuff) --- */}
                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}> Supply & Pricing
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                     <div className={s.formGroup}>
                      <label className={s.miniLabel}>Cost Price</label>
                      <input 
                        type="number"
                        className={s.cleanInput} 
                        value={item.unitPrice} 
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} 
                        placeholder="0.00"
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label className={s.miniLabel}>Selling Price</label>
                      <input 
                        type="number"
                        className={s.cleanInput} 
                        value={item.sellingPrice} 
                        onChange={(e) => handleItemChange(index, 'sellingPrice', e.target.value)} 
                        placeholder="0.00"
                      />
                    </div>
                    
                    {/* RESTORED FIELDS */}
                    <div className={s.formGroup}>
                      <label className={s.miniLabel}>Lead Time (Days)</label>
                      <input 
                        className={s.cleanInput} 
                        value={item.detailLeadTime} 
                        onChange={(e) => handleItemChange(index, 'detailLeadTime', e.target.value)} 
                        placeholder="e.g. 7"
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label className={s.miniLabel}>Min Order (MOQ)</label>
                      <input 
                        className={s.cleanInput} 
                        value={item.detailMinOrder} 
                        onChange={(e) => handleItemChange(index, 'detailMinOrder', e.target.value)} 
                        placeholder="e.g. 50"
                      />
                    </div>

                  </div>
                </div>

              </div>
            ))}
            
            <button 
              type="button" 
              onClick={handleAddItem} 
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '2px dashed #e5e7eb', 
                borderRadius: '8px', 
                backgroundColor: '#fff', 
                color: '#4b5563', 
                fontWeight: 600, 
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                marginBottom: '2rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              <LuPlus /> Add Another Item
            </button>
          </div>

          {/* --- FOOTER --- */}
          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 0 }}>
            <button type="button" onClick={onClose} className={s.cancelBtn}>Cancel</button>
            <button type="submit" className={s.saveBtn}>Save All Items</button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AddInventoryModal;