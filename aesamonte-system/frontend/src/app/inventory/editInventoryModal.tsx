/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";
import { LuX, LuPlus, LuTrash2 } from "react-icons/lu";

interface SupplierEntry {
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  leadTime: string;
  minOrder: string;
  isPrimary: boolean;
}

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemData: any;
  onSave: (updatedItem: any) => void;
  suppliers: any[];
  uoms: any[];
  existingProducts?: { id: string; item_name: string }[];
}

const FIELD_STYLE = {
  width: '100%', height: '38px', padding: '8px 12px',
  borderRadius: '6px', border: '1px solid #9ca3af',
  backgroundColor: '#fff', color: '#374151', fontSize: '0.95rem', outline: 'none'
} as React.CSSProperties;

const READ_ONLY_STYLE = {
  padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6',
  borderRadius: '6px', border: '1px solid #e5e7eb',
  color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center'
} as React.CSSProperties;

const BLANK_SUPPLIER: SupplierEntry = {
  supplierName: '', contactPerson: '', contactNumber: '', leadTime: '', minOrder: '', isPrimary: false,
};

const EditInventoryModal = ({ isOpen, onClose, itemData, onSave, suppliers, uoms, existingProducts = [] }: EditInventoryModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [originalSuppliers, setOriginalSuppliers] = useState<SupplierEntry[]>([]);
  const [addQty, setAddQty] = useState<string>('');
  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([]);
  const [dupError, setDupError] = useState('');
  const [supplierError, setSupplierError] = useState(''); // ── ADDED ──

  useEffect(() => {
    if (itemData) {
      setAddQty('');
      setDupError('');
      setSupplierError(''); // ── ADDED ──
      if (itemData.suppliers && itemData.suppliers.length > 0) {
        const sups = itemData.suppliers.map((sup: any, i: number) => ({
          supplierName: sup.supplierName || '',
          contactPerson: sup.contactPerson || '',
          contactNumber: sup.contactNumber || '',
          leadTime: String(sup.leadTime ?? ''),
          minOrder: String(sup.minOrder ?? ''),
          isPrimary: i === 0,
        }));
        setSupplierEntries(sups);
        setOriginalSuppliers(sups);
      } else {
        const sups = [{
          supplierName: itemData.supplierName || '',
          contactPerson: itemData.contactPerson || '',
          contactNumber: itemData.contactNumber || '',
          leadTime: String(itemData.leadTime ?? ''),
          minOrder: String(itemData.minOrder ?? ''),
          isPrimary: true,
        }];
        setSupplierEntries(sups);
        setOriginalSuppliers(sups);
      }
      const fd = {
        id: itemData.id,
        sku: itemData.sku || '',
        itemName: itemData.itemName || '',
        brand: itemData.brand || '',
        itemDescription: itemData.itemDescription || '',
        qty: itemData.qty ?? '',
        uom: itemData.uom || 'Select',
        reorderPoint: itemData.reorderPoint ?? '',
        unitPrice: itemData.unitPrice ?? '',
        sellingPrice: itemData.sellingPrice ?? '',
      };
      setFormData(fd);
      setOriginalData({ ...fd });
    }
  }, [itemData]);

  if (!isOpen || !formData) return null;

  const handleSupplierChange = (idx: number, field: keyof SupplierEntry, value: string) => {
    setSupplierError(''); // ── ADDED ──
    setSupplierEntries(prev => {
      // ── ADDED: duplicate supplier check ──
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
        const sup = suppliers.find((s: any) => s.supplierName === value);
        entry.contactPerson = sup?.contactPerson || '';
        entry.contactNumber = sup?.contactNumber || '';
      }
      updated[idx] = entry;
      return updated;
    });
  };

  const handleAddSupplier = () => setSupplierEntries(prev => [...prev, { ...BLANK_SUPPLIER }]);

  const handleRemoveSupplier = (idx: number) => {
    setSupplierError(''); // ── ADDED ──
    setSupplierEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    setDupError('');

    // ── NO CHANGES CHECK ──
    const hasFormChanges = originalData && (
      formData.itemName            !== originalData.itemName            ||
      formData.brand               !== originalData.brand               ||
      formData.itemDescription     !== originalData.itemDescription     ||
      String(formData.uom)         !== String(originalData.uom)         ||
      String(formData.reorderPoint) !== String(originalData.reorderPoint) ||
      String(formData.unitPrice)   !== String(originalData.unitPrice)   ||
      String(formData.sellingPrice) !== String(originalData.sellingPrice)
    );
    const hasQtyChange      = (parseInt(addQty) || 0) !== 0;
    const hasSupplierChange = JSON.stringify(supplierEntries) !== JSON.stringify(originalSuppliers);

    if (!hasFormChanges && !hasQtyChange && !hasSupplierChange) {
      setDupError('No changes detected. Please modify at least one field before updating.');
      return;
    }

    // ── DUPLICATE NAME CHECK (exclude self) ──
    const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
    const newName = normalize(formData.itemName || '');
    const conflict = existingProducts.find(
      (p: any) => normalize(p.item_name) === newName && String(p.id) !== String(formData.id)
    );
    if (conflict) {
      setDupError(`"${formData.itemName}" already exists in inventory. Please use a different item name.`);
      return;
    }

    // ── All clear — save ──
    const addition = parseInt(addQty) || 0;
    const finalQty = (parseInt(formData.qty) || 0) + addition;
    const validSuppliers = supplierEntries
      .filter(e => e.supplierName)
      .map((e, i) => ({ ...e, isPrimary: i === 0 }));
    onSave({
      ...formData,
      qty: finalQty,
      suppliers: validSuppliers,
      supplierName: validSuppliers[0]?.supplierName || '',
      leadTime: validSuppliers[0]?.leadTime || 0,
      minOrder: validSuppliers[0]?.minOrder || 0,
    });
  };

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}>
      <div className={s.modalContent} style={{ width: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden' }}>

        {/* --- HEADER --- */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff' }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem' }}>Edit Inventory Item</h2>
            <p className={s.subText}>Update product details, pricing, and stock levels.</p>
          </div>
          <LuX onClick={onClose} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>

          {/* --- PRODUCT IDENTIFICATION --- */}
          <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #dbeafe' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#1e40af', letterSpacing: '0.5px' }}>
              Product Identification
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Product ID</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{formData.id}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>SKU</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{formData.sku}</span>
              </div>
            </div>
          </div>

          {/* --- SUPPLIER DETAILS --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e40af' }}>Supplier Details</h4>
              <button
                type="button"
                onClick={handleAddSupplier}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <LuPlus size={13} /> Add Supplier
              </button>
            </div>

            {/* ── ADDED: supplier duplicate error banner ── */}
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
              <div key={idx} style={{ border: `1px solid ${idx === 0 ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: '10px', padding: '14px', marginBottom: '12px', backgroundColor: idx === 0 ? '#f0f7ff' : '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
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
                    <select style={{ ...FIELD_STYLE }} value={entry.supplierName} onChange={(e) => handleSupplierChange(idx, 'supplierName', e.target.value)}>
                      <option value="">Select Supplier</option>
                      {suppliers.map((sup: any) => {
                        // ── ADDED: grey out already-selected suppliers ──
                        const usedElsewhere = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplierName);
                        return (
                          <option
                            key={sup.id}
                            value={sup.supplierName}
                            disabled={usedElsewhere}
                            style={{ color: usedElsewhere ? '#9ca3af' : '#374151' }}
                          >
                            {sup.supplierName}{usedElsewhere ? '' : ''}
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

          {/* --- ITEM DETAILS --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#1e40af' }}>Item Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Item Name</label>
                <input
                  style={{ ...FIELD_STYLE, borderColor: dupError && dupError.includes(formData.itemName) ? '#fca5a5' : '#9ca3af' }}
                  value={formData.itemName}
                  onChange={(e) => { setDupError(''); setFormData({ ...formData, itemName: e.target.value }); }}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Brand</label>
                <input style={{ ...FIELD_STYLE }} value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
              </div>
            </div>
            <div className={s.formGroupFull}>
              <label className={s.miniLabel}>Description</label>
              <input style={{ ...FIELD_STYLE }} value={formData.itemDescription} onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })} />
            </div>
          </div>

          {/* --- STOCK & PRICING --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <h5 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>Stock</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Current Stock</label>
                <div style={{ padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', color: '#374151', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  {formData.qty ?? 0}
                </div>
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Add Stock</label>
                <input
                  type="number"
                  style={{ width: '100%', height: '38px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', color: '#374151', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                  value={addQty}
                  placeholder="0"
                  onChange={(e) => setAddQty(e.target.value)}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>New Total</label>
                {(() => {
                  const currentQty = parseInt(formData.qty) || 0;
                  const newTotal = currentQty + (parseInt(addQty) || 0);
                  const diff = parseInt(addQty) || 0;
                  const isPos = diff > 0; const isNeg = diff < 0;
                  return (
                    <input
                      type="number"
                      style={{
                        width: '100%', height: '38px', padding: '8px 12px', borderRadius: '6px',
                        border: `1px solid ${isPos ? '#86efac' : isNeg ? '#fdba74' : '#e5e7eb'}`,
                        backgroundColor: isPos ? '#f0fdf4' : isNeg ? '#fff7ed' : '#ffffff',
                        color: isPos ? '#15803d' : isNeg ? '#c2410c' : '#374151',
                        fontSize: '0.95rem', fontWeight: 700, outline: 'none'
                      }}
                      value={newTotal}
                      onChange={(e) => {
                        const typed = parseInt(e.target.value);
                        if (!isNaN(typed)) setAddQty(String(typed - currentQty));
                        else setAddQty('');
                      }}
                    />
                  );
                })()}
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Unit (UOM)</label>
                <select style={{ ...FIELD_STYLE }} value={formData.uom} onChange={(e) => setFormData({ ...formData, uom: e.target.value })}>
                  <option value="Select">Select</option>
                  {uoms && uoms.map((u: any) => (
                    <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                  ))}
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Reorder Point</label>
                <input type="number" style={{ ...FIELD_STYLE, border: '1px solid #fcd34d' }} value={formData.reorderPoint} onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })} />
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #e5e7eb', margin: '0 -20px 20px -20px' }}></div>

            <h5 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>Pricing</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Cost Price</label>
                <input type="number" style={{ ...FIELD_STYLE }} value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })} />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Selling Price</label>
                <input type="number" style={{ ...FIELD_STYLE }} value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })} />
              </div>
            </div>
          </div>

        </div>

        {/* --- FOOTER --- */}
        <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', marginTop: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

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
            <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={s.saveBtn} onClick={handleSubmit}>Update Item</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EditInventoryModal;