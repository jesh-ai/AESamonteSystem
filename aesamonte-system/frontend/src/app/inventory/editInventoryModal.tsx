/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from "@/css/inventory.module.css";
import { LuX, LuPlus, LuTrash2, LuSlidersHorizontal } from "react-icons/lu";

interface SupplierEntry {
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  leadTime: string;
  minOrder: string;
  isPrimary: boolean;
}

interface BrandVariant {
  brand_id: string | number | null;
  brandName: string;
  sku: string;
  description: string;
  qty: string;       // current stock (read-only display)
  addStock: string;  // amount to add (editable)
  uom: string;
  reorderPoint: string;
  unitCost: string;
  sellingPrice: string;
  isNew: boolean;
}

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemData: any;
  onSave: (updatedItem: any) => void;
  onOpenUomModal: () => void;
  suppliers: any[];
  brands: { id: number; code: string; name: string }[];
  uoms: any[];
  existingProducts?: { id: string; item_name: string }[];
}

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

const DISABLED_STYLE: React.CSSProperties = {
  ...FIELD_STYLE, backgroundColor: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed',
};

const BLANK_SUPPLIER: SupplierEntry = {
  supplierName: '', contactPerson: '', contactNumber: '', leadTime: '', minOrder: '', isPrimary: false,
};

const INITIAL_NEW_BRAND: BrandVariant = {
  brand_id: null,
  brandName: '',
  sku: '',
  description: '',
  qty: '0',
  addStock: '',
  uom: 'Select',
  reorderPoint: '20',
  unitCost: '',
  sellingPrice: '',
  isNew: true,
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const EditInventoryModal: React.FC<EditInventoryModalProps> = ({
  isOpen, onClose, itemData, onSave, onOpenUomModal,
  suppliers, brands = [], uoms, existingProducts = []
}) => {
  const s = styles as Record<string, string>;

  const [formData, setFormData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([]);
  const [originalSuppliers, setOriginalSuppliers] = useState<SupplierEntry[]>([]);
  const [brandVariants, setBrandVariants] = useState<BrandVariant[]>([]);
  const [originalBrands, setOriginalBrands] = useState<BrandVariant[]>([]);
  const [dupError, setDupError] = useState('');
  const [supplierError, setSupplierError] = useState('');

  const [supplierHeight, setSupplierHeight] = useState<number | 'auto'>('auto');
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const supplierSectionRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = supplierSectionRef.current?.offsetHeight ?? 300;
    setSupplierHeight(dragStartHeight.current);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientY - dragStartY.current;
      setSupplierHeight(Math.min(Math.max(dragStartHeight.current + delta, 120), 520));
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (itemData) {
      setDupError('');
      setSupplierError('');
      setSupplierHeight('auto');

      const sups: SupplierEntry[] = (itemData.suppliers && itemData.suppliers.length > 0)
        ? itemData.suppliers.map((sup: any, i: number) => ({
            supplierName: sup.supplierName || '',
            contactPerson: sup.contactPerson || '',
            contactNumber: sup.contactNumber || '',
            leadTime: String(sup.leadTime ?? ''),
            minOrder: String(sup.minOrder ?? ''),
            isPrimary: i === 0,
          }))
        : [{
            supplierName: itemData.supplierName || '',
            contactPerson: itemData.contactPerson || '',
            contactNumber: itemData.contactNumber || '',
            leadTime: String(itemData.leadTime ?? ''),
            minOrder: String(itemData.minOrder ?? ''),
            isPrimary: true,
          }];

      setSupplierEntries(sups);
      setOriginalSuppliers(JSON.parse(JSON.stringify(sups)));

      const bvs: BrandVariant[] = (itemData.brands || []).map((b: any) => ({
        brand_id: b.brand_id,
        brandName: b.brand_name || '',
        sku: b.sku || '',
        description: b.description || itemData.itemDescription || '',
        qty: String(b.qty ?? '0'),
        addStock: '',
        uom: itemData.uom || 'Select',
        reorderPoint: String(itemData.reorderPoint ?? '20'),
        unitCost: String(b.unit_price ?? ''),
        sellingPrice: String(b.selling_price ?? ''),
        isNew: false,
      }));

      const initialBrands = bvs.length > 0 ? bvs : [{ ...INITIAL_NEW_BRAND }];
      setBrandVariants(initialBrands);
      setOriginalBrands(JSON.parse(JSON.stringify(initialBrands)));

      const fd = {
        id: itemData.id,
        itemName: itemData.itemName || '',
      };
      setFormData(fd);
      setOriginalData({ ...fd });
    }
  }, [itemData]);

  if (!isOpen || !formData) return null;

  // ── SUPPLIER HANDLERS ──
  const handleSupplierChange = (idx: number, field: keyof SupplierEntry, value: string) => {
    setSupplierError('');
    setSupplierEntries(prev => {
      if (field === 'supplierName' && value) {
        const alreadyUsed = prev.some((e, i) => i !== idx && e.supplierName === value);
        if (alreadyUsed) {
          setSupplierError(`"${value}" is already added.`);
          return prev;
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
    setSupplierError('');
    setSupplierEntries(prev => prev.filter((_, i) => i !== idx));
  };

  // ── BRAND VARIANT HANDLERS ──
  const handleBrandChange = (brandIdx: number, field: keyof BrandVariant, value: string | number | null) => {
    setBrandVariants(prev => {
      const updated = [...prev];
      updated[brandIdx] = { ...updated[brandIdx], [field]: value };
      return updated;
    });
  };

  const handleAddBrandVariant = () => {
    setBrandVariants(prev => [...prev, { ...INITIAL_NEW_BRAND }]);
  };

  const handleRemoveBrandVariant = (brandIdx: number) => {
    setBrandVariants(prev => prev.filter((_, i) => i !== brandIdx));
  };

  const handleSubmit = () => {
    setDupError('');

    const hasFormChanges = originalData && (
      formData.itemName !== originalData.itemName
    );
    const hasSupplierChange = JSON.stringify(supplierEntries) !== JSON.stringify(originalSuppliers);
    const hasBrandChange = JSON.stringify(brandVariants) !== JSON.stringify(originalBrands);

    if (!hasFormChanges && !hasSupplierChange && !hasBrandChange) {
      setDupError('No changes detected. Please modify at least one field before updating.');
      return;
    }

    const normalize = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const conflict = existingProducts.find(
      (p: any) => normalize(p.item_name) === normalize(formData.itemName || '') && String(p.id) !== String(formData.id)
    );
    if (conflict) {
      setDupError(`"${formData.itemName}" already exists. Please use a different item name.`);
      return;
    }

    for (const bv of brandVariants) {
      if (!bv.uom || bv.uom === 'Select') {
        setDupError(`Please select a Unit of Measure for brand "${bv.brandName || 'unnamed brand'}".`);
        return;
      }
    }

    const validSuppliers = supplierEntries
      .filter(e => e.supplierName)
      .map((e, i) => ({ ...e, isPrimary: i === 0 }));

    onSave({
      ...formData,
      suppliers: validSuppliers,
      brands: brandVariants.map(bv => ({
        ...(bv.brand_id ? { brand_id: Number(bv.brand_id) } : {}),
        brand_name: bv.brandName || 'No Brand',
        sku: bv.sku || null,
        uom: bv.uom,
        qty: (Number(bv.qty) || 0) + (Number(bv.addStock) || 0),
        unit_price: Number(bv.unitCost) || 0,
        selling_price: Number(bv.sellingPrice) || 0,
        itemDescription: bv.description,
        reorderPoint: Number(bv.reorderPoint) || 0,
      })),
    });
  };

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}>
      <div className={s.modalContent} style={{
        width: '850px', maxHeight: '95vh', display: 'flex',
        flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden'
      }}>

        {/* HEADER */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0 }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Edit Inventory Item</h2>
            <p className={s.subText}>Update product details, brands, and supplier links.</p>
          </div>
          <LuX onClick={onClose} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666' }} />
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f9fafb', minHeight: 0 }}>

          {/* Product ID Banner */}
          <div style={{ backgroundColor: '#eff6ff', padding: '12px 24px', borderBottom: '1px solid #dbeafe', flexShrink: 0 }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#1e40af', letterSpacing: '0.5px', fontWeight: 700 }}>Product ID: </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{formData.id}</span>
          </div>

          {/* Inner scrollable area */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* ── SUPPLIER SECTION ── */}
            <div ref={supplierSectionRef} style={{
              height: supplierHeight === 'auto' ? 'auto' : `${supplierHeight}px`,
              minHeight: '120px', flexShrink: 0, padding: '20px 24px',
              backgroundColor: '#fff', borderBottom: '1px solid #eaeaea',
              overflowY: supplierHeight !== 'auto' ? 'auto' : undefined,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Supplier Details</h4>
                <button type="button" onClick={handleAddSupplier}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  <LuPlus size={13} /> Add Supplier
                </button>
              </div>

              {supplierError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '12px' }}>
                  <span>⚠</span> {supplierError}
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
                      <select style={{ ...FIELD_STYLE }} value={entry.supplierName} onChange={e => handleSupplierChange(idx, 'supplierName', e.target.value)}>
                        <option value="">Select Supplier</option>
                        {suppliers.map((sup: any) => {
                          const used = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplierName);
                          return <option key={sup.id} value={sup.supplierName} disabled={used} style={{ color: used ? '#9ca3af' : '#374151' }}>{sup.supplierName}</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Lead Time (Days)</label>
                      <input type="number" style={{ ...FIELD_STYLE }} value={entry.leadTime} placeholder="e.g. 7" onChange={e => handleSupplierChange(idx, 'leadTime', e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Min Order (MOQ)</label>
                      <input type="number" style={{ ...FIELD_STYLE }} value={entry.minOrder} placeholder="e.g. 50" onChange={e => handleSupplierChange(idx, 'minOrder', e.target.value)} />
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

            {/* DRAG HANDLE */}
            <div onMouseDown={handleMouseDown}
              style={{ height: '10px', flexShrink: 0, backgroundColor: '#e2e8f0', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
              title="Drag to resize">
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />)}
              </div>
            </div>

            {/* ── ITEM DETAILS SECTION ── */}
            <div style={{ padding: '20px 24px', flex: 1 }}>
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>1</div>
                  <span style={{ color: '#111827', fontWeight: 600, fontSize: '1rem' }}>Item Details</span>
                </div>

                {/* ITEM NAME */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ ...LABEL_STYLE }}>Item Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    style={{ ...FIELD_STYLE, borderColor: dupError && dupError.includes(formData.itemName) ? '#fca5a5' : '#9ca3af' }}
                    value={formData.itemName}
                    onChange={e => { setDupError(''); setFormData({ ...formData, itemName: e.target.value }); }}
                    placeholder="e.g. Bond Paper A4"
                  />
                </div>

                {/* BRAND DETAIL sub-cards */}
                {brandVariants.map((brand, brandIdx) => (
                  <div key={brandIdx} style={{ border: '2px dashed #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '12px', backgroundColor: '#fafafa' }}>

                    {/* Brand header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>
                        {brandIdx + 1} Brand Detail
                        {!brand.isNew && (
                          <span style={{ marginLeft: '8px', fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '999px', border: '1px solid #e5e7eb' }}>existing</span>
                        )}
                      </span>
                      {brandVariants.length > 1 && (
                        <button type="button" onClick={() => handleRemoveBrandVariant(brandIdx)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <LuTrash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Row: BRAND NAME | SKU */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>Brand Name</label>
                        {!brand.isNew ? (
                          <div style={{ ...READ_ONLY_STYLE }}>{brand.brandName || '—'}</div>
                        ) : (
                          <select
                            style={{ ...FIELD_STYLE }}
                            value={brand.brand_id ?? ''}
                            onChange={e => {
                              const selected = brands.find((b: any) => String(b.id) === e.target.value);
                              handleBrandChange(brandIdx, 'brand_id', selected ? selected.id : null);
                              handleBrandChange(brandIdx, 'brandName', selected ? selected.name : '');
                            }}
                          >
                            <option value="">Select Brand</option>
                            {brands.map((b: any) => (
                              <option key={b.id} value={b.id}>
                                {b.name === 'No Brand' ? '— No Brand' : b.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>SKU</label>
                        <input
                          style={{ ...DISABLED_STYLE }}
                          value={brand.sku || (brand.isNew ? '' : 'Auto-generated')}
                          readOnly
                          placeholder="Auto-generated"
                        />
                      </div>
                    </div>

                    {/* Row: DESCRIPTION */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ ...LABEL_STYLE }}>Description</label>
                      <input
                        style={{ ...FIELD_STYLE }}
                        value={brand.description}
                        onChange={e => handleBrandChange(brandIdx, 'description', e.target.value)}
                        placeholder="Specific brand details..."
                      />
                    </div>

                    {/* Row: CURRENT STOCK | ADD STOCK | NEW TOTAL */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>Current Stock</label>
                        <div style={{ ...READ_ONLY_STYLE }}>{brand.qty || '0'}</div>
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>Add Stock</label>
                        <input
                          type="number" min="0"
                          style={{ ...FIELD_STYLE }}
                          value={brand.addStock}
                          onChange={e => {
                            const v = e.target.value;
                            if (v === '' || Number(v) >= 0) handleBrandChange(brandIdx, 'addStock', v);
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>New Total</label>
                        <div style={{
                          ...READ_ONLY_STYLE,
                          ...(Number(brand.addStock) > 0 ? { color: '#16a34a', fontWeight: 700, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' } : {}),
                        }}>
                          {(Number(brand.qty) || 0) + (Number(brand.addStock) || 0)}
                        </div>
                      </div>
                    </div>

                    {/* Row: UNIT (UOM) | REORDER POINT */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>Unit (UOM)</label>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <select
                            style={{ ...FIELD_STYLE, flex: 1 }}
                            value={brand.uom}
                            onChange={e => handleBrandChange(brandIdx, 'uom', e.target.value)}
                          >
                            <option value="Select">Select</option>
                            {uoms.map((u: any) => <option key={u.id} value={u.code}>{u.name} ({u.code})</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={onOpenUomModal}
                            title="Manage Units of Measure"
                            style={{ flexShrink: 0, width: '34px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}>
                            <LuSlidersHorizontal size={15} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>Reorder Point</label>
                        <input
                          type="number" min="0"
                          style={{ ...FIELD_STYLE, border: '1px solid #fcd34d' }}
                          value={brand.reorderPoint}
                          onChange={e => handleBrandChange(brandIdx, 'reorderPoint', e.target.value)}
                          placeholder="20"
                        />
                      </div>
                    </div>

                    {/* Row: UNIT COST | SELLING PRICE */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>Unit Cost</label>
                        <input
                          type="number" min="0" step="0.01"
                          style={{ ...FIELD_STYLE }}
                          value={brand.unitCost}
                          onChange={e => handleBrandChange(brandIdx, 'unitCost', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE }}>Selling Price</label>
                        <input
                          type="number" min="0" step="0.01"
                          style={{ ...FIELD_STYLE }}
                          value={brand.sellingPrice}
                          onChange={e => handleBrandChange(brandIdx, 'sellingPrice', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* + Add Brand Variant */}
                <button
                  type="button"
                  onClick={handleAddBrandVariant}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <LuPlus size={14} /> Add Brand Variant
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
          {dupError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>⚠</span> {dupError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              className={s.saveBtn}
              onClick={handleSubmit}
              style={{ backgroundColor: '#111827', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
              Update Item
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EditInventoryModal;
