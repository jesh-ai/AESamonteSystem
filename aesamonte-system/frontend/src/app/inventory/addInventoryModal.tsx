/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import styles from "@/css/inventory.module.css";
import { LuPlus, LuTrash2 } from "react-icons/lu";

interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string;
  contactNumber?: string;
}

interface SupplierEntry {
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  leadTime: string;
  minOrder: string;
}

interface AddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: any[]) => void;
  onOpenSupplierModal: () => void;
  suppliers: Supplier[];
  uoms: { id: number; code: string; name: string }[];
  existingProducts?: { item_name: string }[];
  defaultSupplierName?: string;
}

const INITIAL_ITEM = {
  itemName: '',
  brand: '',
  internalSku: '',
  itemDescription: '',
  qty: '',
  uom: 'Select',
  reorderPoint: '',
  unitPrice: '',
  sellingPrice: '',
};

const INITIAL_SUPPLIER: SupplierEntry = {
  supplierName: '', contactPerson: '', contactNumber: '', leadTime: '', minOrder: '',
};

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', height: '38px', padding: '8px 12px',
  borderRadius: '6px', border: '1px solid #9ca3af',
  backgroundColor: '#fff', color: '#374151', fontSize: '0.95rem', outline: 'none',
};

const READ_ONLY_STYLE: React.CSSProperties = {
  padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6',
  borderRadius: '6px', border: '1px solid #e5e7eb',
  color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center',
};

const AddInventoryModal: React.FC<AddInventoryModalProps> = ({
  isOpen, onClose, onSave, onOpenSupplierModal, suppliers = [], uoms = [],
  existingProducts = [], defaultSupplierName = ''
}) => {
  const s = styles as Record<string, string>;
  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([{ ...INITIAL_SUPPLIER }]);
  const [items, setItems] = useState<any[]>([{ ...INITIAL_ITEM }]);
  const [dupError, setDupError] = useState('');
  const [supplierError, setSupplierError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (defaultSupplierName) {
        const sup = suppliers.find(s => s.supplierName === defaultSupplierName);
        setSupplierEntries([{
          supplierName: defaultSupplierName,
          contactPerson: sup?.contactPerson || '',
          contactNumber: sup?.contactNumber || '',
          leadTime: '',
          minOrder: '',
        }]);
      } else {
        setSupplierEntries([{ ...INITIAL_SUPPLIER }]);
      }
      setItems([{ ...INITIAL_ITEM }]);
      setDupError('');
      setSupplierError('');
    }
  }, [isOpen, defaultSupplierName]);

  const handleSupplierChange = (idx: number, field: keyof SupplierEntry, value: string) => {
    setSupplierError('');
    setSupplierEntries(prev => {
      // ── DUPLICATE SUPPLIER CHECK ──
      if (field === 'supplierName' && value) {
        const alreadyUsed = prev.some((e, i) => i !== idx && e.supplierName === value);
        if (alreadyUsed) {
          setSupplierError(`"${value}" is already added. Please select a different supplier.`);
          return prev; // reject the change
        }
      }
      const updated = [...prev];
      const entry = { ...updated[idx], [field]: value };
      if (field === 'supplierName') {
        const sup = suppliers.find(s => s.supplierName === value);
        entry.contactPerson = sup?.contactPerson || '';
        entry.contactNumber = sup?.contactNumber || '';
      }
      updated[idx] = entry;
      return updated;
    });
  };

  const handleAddSupplier = () => setSupplierEntries(prev => [...prev, { ...INITIAL_SUPPLIER }]);
  const handleRemoveSupplier = (idx: number) => {
    setSupplierError('');
    setSupplierEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddItem = () => setItems([...items, { ...INITIAL_ITEM }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleItemChange = (index: number, field: string, value: string) => {
    setDupError('');
    setItems(prevItems => {
      const newItems = [...prevItems];
      const item = { ...newItems[index], [field]: value };
      if (field === 'itemName') {
        const name = (value || '').trim().toUpperCase();
        if (name.length > 0) {
          const words = name.split(/\s+/).filter((w: string) => w.length > 0);
          let prefix = '';
          for (let i = 0; i < Math.min(3, words.length); i++) prefix += words[i][0];
          if (prefix.length < 3) prefix = prefix.padEnd(3, 'X');
          if (!item.skuSuffix) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let suffix = '';
            for (let i = 0; i < 3; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
            item.skuSuffix = suffix;
          }
          item.internalSku = `${prefix}-${item.skuSuffix}`;
        } else {
          item.internalSku = '';
          item.skuSuffix = undefined;
        }
      }
      newItems[index] = item;
      return newItems;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDupError('');
    setSupplierError('');

    const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
    const newNames = items
      .map((i: any) => normalize(i.itemName || ''))
      .filter(Boolean);

    // Check 1: duplicates within the form itself
    if (newNames.length !== new Set(newNames).size) {
      setDupError('You have duplicate item names in your list. Please make each item name unique.');
      return;
    }

    // Check 2: conflicts with existing inventory
    const existingNames = existingProducts.map((p: any) => normalize(p.item_name || ''));
    const conflict = newNames.find((name: string) => existingNames.includes(name));
    if (conflict) {
      setDupError(`"${conflict}" already exists in inventory. Please use a different item name.`);
      return;
    }

    // Check 3: at least one item must be filled
    if (!items.some((i: any) => i.itemName?.trim())) {
      setDupError('Please fill in at least one item name before saving.');
      return;
    }

    // All clear — save
    const validSuppliers = supplierEntries.filter(e => e.supplierName);
    const mergedItems = items.map(item => ({
      ...item,
      supplierName: validSuppliers[0]?.supplierName || '',
      leadTime: validSuppliers[0]?.leadTime || '',
      minOrder: validSuppliers[0]?.minOrder || '',
      suppliers: validSuppliers.map((e, i) => ({
        supplierName: e.supplierName,
        leadTime: e.leadTime,
        minOrder: e.minOrder,
        isPrimary: i === 0,
      })),
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
            <p className={s.subText}>Suppliers entered here will apply to all items below.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: '#f9fafb' }}>

          {/* --- SHARED SUPPLIER SECTION --- */}
          <div style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Supplier Details</h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span onClick={onOpenSupplierModal} style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#007bff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <LuPlus size={13} /> New Supplier
                </span>
                <button
                  type="button"
                  onClick={handleAddSupplier}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <LuPlus size={13} /> Add Supplier
                </button>
              </div>
            </div>

            {/* ── SUPPLIER DUPLICATE ERROR ── */}
            {supplierError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: '#fee2e2', border: '1px solid #fca5a5',
                color: '#dc2626', borderRadius: '8px',
                padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500,
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '1rem' }}>⚠</span>
                {supplierError}
              </div>
            )}

            {supplierEntries.map((entry, idx) => (
              <div key={idx} style={{ border: `1px solid ${idx === 0 ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: '10px', padding: '14px', marginBottom: '10px', backgroundColor: idx === 0 ? '#f0f7ff' : '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  {idx === 0
                    ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '999px' }}>PRIMARY</span>
                    : <span style={{ fontSize: '0.72rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '999px', border: '1px solid #e5e7eb' }}>Alternate</span>
                  }
                  {supplierEntries.length > 1 && (
                    <button type="button" onClick={() => handleRemoveSupplier(idx)} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <LuTrash2 size={13} /> Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Supplier Name</label>
                    <select
                      style={{
                        ...FIELD_STYLE,
                        borderColor: supplierError && entry.supplierName === '' ? '#fca5a5' : '#9ca3af'
                      }}
                      value={entry.supplierName}
                      onChange={(e) => handleSupplierChange(idx, 'supplierName', e.target.value)}
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((sup, i) => {
                        // ── grey out already-selected suppliers in other entries ──
                        const usedElsewhere = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplierName);
                        return (
                          <option
                            key={sup.id || i}
                            value={sup.supplierName}
                            disabled={usedElsewhere}
                            style={{ color: usedElsewhere ? '#9ca3af' : '#374151' }}
                          >
                            {sup.supplierName}{usedElsewhere ?  '' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Lead Time (Days)</label>
                    <input type="number" style={{ ...FIELD_STYLE }} value={entry.leadTime} placeholder="e.g. 7" onChange={(e) => handleSupplierChange(idx, 'leadTime', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Min Order (MOQ)</label>
                    <input type="number" style={{ ...FIELD_STYLE }} value={entry.minOrder} placeholder="e.g. 50" onChange={(e) => handleSupplierChange(idx, 'minOrder', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Contact Person</label>
                    <div style={{ ...READ_ONLY_STYLE }}>{entry.contactPerson || '—'}</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Contact Number</label>
                    <div style={{ ...READ_ONLY_STYLE }}>{entry.contactNumber || '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* --- SCROLLABLE ITEM LIST --- */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px', marginBottom: '20px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600, fontSize: '1rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>{index + 1}</div>
                    Item Details
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px' }}>
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Item Name</label>
                    <input style={{ ...FIELD_STYLE }} value={item.itemName} onChange={(e) => handleItemChange(index, 'itemName', e.target.value)} placeholder="e.g. Bond Paper A4" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Brand</label>
                    <input style={{ ...FIELD_STYLE }} value={item.brand} onChange={(e) => handleItemChange(index, 'brand', e.target.value)} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>SKU (Auto)</label>
                    <input style={{ width: '100%', height: '38px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.95rem', outline: 'none' }} value={item.internalSku} readOnly />
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Description</label>
                    <input style={{ ...FIELD_STYLE }} value={item.itemDescription} onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)} placeholder="Brief details..." />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Quantity</label>
                    <input type="number" style={{ ...FIELD_STYLE }} value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Unit (UOM)</label>
                    <select style={{ ...FIELD_STYLE }} value={item.uom} onChange={(e) => handleItemChange(index, 'uom', e.target.value)}>
                      <option value="Select">Select</option>
                      {uoms.map((u) => (<option key={u.id} value={u.code}>{u.name} ({u.code})</option>))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Reorder Point</label>
                    <input type="number" style={{ ...FIELD_STYLE, border: '1px solid #fcd34d' }} value={item.reorderPoint} onChange={(e) => handleItemChange(index, 'reorderPoint', e.target.value)} />
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>Pricing</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className={s.formGroup}>
                      <label className={s.miniLabel}>Cost Price</label>
                      <input type="number" style={{ ...FIELD_STYLE }} value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} placeholder="0.00" />
                    </div>
                    <div className={s.formGroup}>
                      <label className={s.miniLabel}>Selling Price</label>
                      <input type="number" style={{ ...FIELD_STYLE }} value={item.sellingPrice} onChange={(e) => handleItemChange(index, 'sellingPrice', e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddItem}
              style={{ width: '100%', padding: '12px', border: '2px dashed #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2rem' }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              <LuPlus /> Add Another Item
            </button>
          </div>

          {/* --- FOOTER --- */}
          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 0 }}>

            {dupError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: '#fee2e2', border: '1px solid #fca5a5',
                color: '#dc2626', borderRadius: '8px',
                padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500,
              }}>
                <span style={{ fontSize: '1rem' }}>⚠</span>
                {dupError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={onClose} className={s.cancelBtn}>Cancel</button>
              <button type="submit" className={s.saveBtn}>Save All Items</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddInventoryModal;