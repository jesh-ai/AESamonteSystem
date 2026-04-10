/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";
import { LuX, LuPlus, LuMinus, LuTrash2, LuSlidersHorizontal } from "react-icons/lu";
import AddBrandModal from './AddBrandModal';

interface SupplierEntry {
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  leadTime: string;
  minOrder: string;
  isPrimary: boolean;
}

interface BrandVariant {
  inventory_brand_id: string | number | null;
  brand_id: string | number | null;
  brandName: string;
  sku: string;
  description: string;
  qty: string;
  stockAction: 'add' | 'remove';
  stockDelta: string;
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
  onBrandAdded?: () => void;
  onOpenSupplierModal: () => void;
  suppliers: any[];
  brands: { id: number; name: string }[];
  uoms: any[];
  existingProducts?: { id: string; item_name: string }[];
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', height: '38px', padding: '8px 12px',
  borderRadius: '6px', border: '1px solid #9ca3af',
  backgroundColor: '#fff', color: '#374151', fontSize: '0.95rem', outline: 'none',
};

const FIELD_ERROR_STYLE: React.CSSProperties = {
  ...FIELD_STYLE,
  border: '1px solid #f87171',
  backgroundColor: '#fff5f5',
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
  inventory_brand_id: null,
  brand_id: null,
  brandName: '',
  sku: '',
  description: '',
  qty: '0',
  stockAction: 'add',
  stockDelta: '',
  uom: '',
  reorderPoint: '20',
  unitCost: '',
  sellingPrice: '',
  isNew: true,
};

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: '0 0 12px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9ca3af' }}>{children}</p>
);

const Divider = () => (
  <hr style={{ border: 'none', borderTop: '1px solid #d1d5db', margin: '20px 0' }} />
);

const SubtleDivider = () => (
  <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '16px 0' }} />
);

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const EditInventoryModal: React.FC<EditInventoryModalProps> = ({
  isOpen, onClose, itemData, onSave, onOpenUomModal, onOpenSupplierModal,
  suppliers, brands = [], uoms, existingProducts = [],
  onBrandAdded
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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [brandTargetIdx, setBrandTargetIdx] = useState<number | null>(null);


  useEffect(() => {
    if (itemData) {
      setDupError('');
      setSupplierError('');
      setSubmitAttempted(false);
      setShowCancelConfirm(false);

      const sups: SupplierEntry[] = (itemData.suppliers && itemData.suppliers.length > 0)
        ? itemData.suppliers.map((sup: any, i: number) => ({
            supplierName: sup.supplier_name || '',
            contactPerson: sup.contact_person || '',
            contactNumber: sup.contact_number || '',
            leadTime: i === 0 ? String(itemData.leadTime ?? '') : '',
            minOrder: i === 0 ? String(itemData.minOrder ?? '') : '',
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
        inventory_brand_id: b.inventory_brand_id ?? null,
        brand_id: b.brand_id,
        brandName: b.brand_name || '',
        sku: b.sku || '',
        description: b.description || itemData.itemDescription || '',
        qty: String(b.qty ?? '0'),
        stockAction: 'add' as const,
        stockDelta: '',
        uom: b.uom || '',
        reorderPoint: String(b.reorder_point ?? '20'),
        unitCost: String(b.unit_price ?? ''),
        sellingPrice: String(b.selling_price ?? ''),
        isNew: false,
      }));

      const initialBrands = bvs.length > 0 ? bvs : [{ ...INITIAL_NEW_BRAND }];
      setBrandVariants(initialBrands);
      setOriginalBrands(JSON.parse(JSON.stringify(initialBrands)));

      const fd = { id: itemData.id, itemName: itemData.itemName || '' };
      setFormData(fd);
      setOriginalData({ ...fd });
    }
  }, [itemData]);

  if (!isOpen || !formData) return null;

  // ── DIRTY CHECK ──
  const isFormDirty = () => {
    const hasFormChanges = originalData && formData.itemName !== originalData.itemName;
    const hasSupplierChange = JSON.stringify(supplierEntries) !== JSON.stringify(originalSuppliers);
    const hasBrandChange = JSON.stringify(brandVariants) !== JSON.stringify(originalBrands);
    return hasFormChanges || hasSupplierChange || hasBrandChange;
  };

  const handleCancelClick = () => {
    if (isFormDirty()) setShowCancelConfirm(true);
    else onClose();
  };

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

  const handleAddBrandVariant = () => setBrandVariants(prev => [...prev, { ...INITIAL_NEW_BRAND }]);
  const handleRemoveBrandVariant = (brandIdx: number) => setBrandVariants(prev => prev.filter((_, i) => i !== brandIdx));

  const handleSubmit = () => {
    setDupError('');
    setSubmitAttempted(true);

    // Check item name
    if (!formData.itemName?.trim()) {
      setDupError('Item name is required.');
      return;
    }

    // Check UOM on all brands
    const missingUom = brandVariants.find(bv => !bv.uom || bv.uom === '' || bv.uom === 'Select');
    if (missingUom) {
      setDupError(`Please select a Unit of Measure for brand "${missingUom.brandName || 'unnamed brand'}".`);
      return;
    }

    // Check Unit Cost and Selling Price on all brands
    const missingCost = brandVariants.find(bv => bv.unitCost === '' || bv.unitCost === null);
    if (missingCost) {
      setDupError(`Unit Cost is required for brand "${missingCost.brandName || 'unnamed brand'}".`);
      return;
    }
    const missingPrice = brandVariants.find(bv => bv.sellingPrice === '' || bv.sellingPrice === null);
    if (missingPrice) {
      setDupError(`Selling Price is required for brand "${missingPrice.brandName || 'unnamed brand'}".`);
      return;
    }

    const hasFormChanges = originalData && formData.itemName !== originalData.itemName;
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

    const validSuppliers = supplierEntries
      .filter(e => e.supplierName)
      .map((e, i) => ({ ...e, isPrimary: i === 0 }));

    if (validSuppliers.length === 0) {
      setDupError('At least one supplier is required.');
      return;
    }

    onSave({
      ...formData,
      suppliers: validSuppliers,
      brands: brandVariants.map(bv => ({
        ...(bv.inventory_brand_id != null ? { inventory_brand_id: Number(bv.inventory_brand_id) } : {}),
        ...(bv.brand_id ? { brand_id: Number(bv.brand_id) } : {}),
        brand_name: bv.brandName || 'No Brand',
        sku: bv.sku || null,
        uom: bv.uom,
        qty: Number(bv.qty) || 0,
        stockAction: bv.stockDelta ? bv.stockAction : 'set',
        stockDelta: Number(bv.stockDelta) || 0,
        unit_price: Number(bv.unitCost) || 0,
        selling_price: Number(bv.sellingPrice) || 0,
        itemDescription: bv.description,
        reorderPoint: Number(bv.reorderPoint) || 0,
      })),
    });
  };

  // ── ERROR HELPERS ──
  const itemNameHasError = () => submitAttempted && !formData.itemName?.trim();
  const uomHasError = (brandIdx: number) =>
    submitAttempted && (!brandVariants[brandIdx].uom || brandVariants[brandIdx].uom === '' || brandVariants[brandIdx].uom === 'Select');
  const unitCostHasError = (brandIdx: number) =>
    submitAttempted && (brandVariants[brandIdx].unitCost === '' || brandVariants[brandIdx].unitCost === null);
  const sellingPriceHasError = (brandIdx: number) =>
    submitAttempted && (brandVariants[brandIdx].sellingPrice === '' || brandVariants[brandIdx].sellingPrice === null);
  const supplierHasError = (idx: number) =>
    submitAttempted && idx === 0 && !supplierEntries[0]?.supplierName;

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}>
      <div className={s.modalContent} style={{
        width: '850px', maxHeight: '95vh', display: 'flex',
        flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden'
      }}>

        {/* HEADER */}
        <div className={s.modalHeader} style={{ padding: '20px 28px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>Edit Inventory Item</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Update product details, brands, and supplier links.</p>
          </div>
          <LuX onClick={handleCancelClick} style={{ cursor: 'pointer', color: '#9ca3af', flexShrink: 0 }} size={20} />
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc', minHeight: 0 }}>
          <div style={{ padding: '24px 24px 0' }}>

            {/* ── ITEM NAME card ── */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <SectionHeading>Basic Information</SectionHeading>
                <span style={{ fontSize: '0.75rem', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '3px 12px', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.4px' }}>
                  ID: {formData.id}
                </span>
              </div>
              <label style={{ ...LABEL_STYLE, color: itemNameHasError() ? '#dc2626' : '#6b7280' }}>
                Item Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                style={itemNameHasError() ? FIELD_ERROR_STYLE : FIELD_STYLE}
                value={formData.itemName}
                onChange={e => { setDupError(''); setFormData({ ...formData, itemName: e.target.value }); }}
                placeholder="e.g. Bond Paper A4"
              />
              {itemNameHasError() && (
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Item name is required.</p>
              )}
            </div>

          </div>

          {/* ── BRAND VARIANTS ── */}
          {brandVariants.map((brand, brandIdx) => (
            <div key={brandIdx} style={{ padding: '0 24px', marginBottom: '16px' }}>
              {/* one card per brand — no nested boxes inside */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px' }}>

              {/* Brand header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
                  Brand Variant {brandIdx + 1}
                  {!brand.isNew && (
                    <span style={{ marginLeft: '8px', fontSize: '0.7rem', fontWeight: 500, color: '#9ca3af' }}>· existing</span>
                  )}
                </p>
                {brandVariants.length > 1 && (
                  <button type="button" onClick={() => handleRemoveBrandVariant(brandIdx)}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                    <LuTrash2 size={13} /> Remove
                  </button>
                )}
              </div>

              {/* Brand Name | SKU */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ ...LABEL_STYLE }}>Brand Name</label>
                    <span onClick={() => { setBrandTargetIdx(brandIdx); setShowBrandModal(true); }}
                      style={{ cursor: 'pointer', fontSize: '0.65rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase' }}>
                      + New Brand
                    </span>
                  </div>
                  {!brand.isNew ? (
                    <div style={{ ...READ_ONLY_STYLE }}>{brand.brandName || '—'}</div>
                  ) : (
                    <select style={{ ...FIELD_STYLE }} value={brand.brand_id ?? ''}
                      onChange={e => {
                        const selected = brands.find((b: any) => String(b.id) === e.target.value);
                        handleBrandChange(brandIdx, 'brand_id', selected ? selected.id : null);
                        handleBrandChange(brandIdx, 'brandName', selected ? selected.name : '');
                      }}>
                      <option value="">Select Brand</option>
                      {brands.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name === 'No Brand' ? '— No Brand' : b.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label style={{ ...LABEL_STYLE }}>SKU</label>
                  <input style={{ ...DISABLED_STYLE }} value={brand.sku || (brand.isNew ? '' : 'Auto-generated')} readOnly placeholder="Auto-generated" />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ ...LABEL_STYLE }}>Description</label>
                <input style={{ ...FIELD_STYLE }} value={brand.description}
                  onChange={e => handleBrandChange(brandIdx, 'description', e.target.value)}
                  placeholder="Specific brand details..." />
              </div>

              {/* ── Inventory Settings ── */}
              <SubtleDivider />
              <SectionHeading>Unit & Reorder Threshold</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ ...LABEL_STYLE, color: uomHasError(brandIdx) ? '#dc2626' : '#6b7280' }}>
                    Unit (UOM) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <select style={{ ...(uomHasError(brandIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE), width: '100%' }}
                        value={brand.uom} onChange={e => handleBrandChange(brandIdx, 'uom', e.target.value)}>
                        <option value="">Select UOM</option>
                        {uoms.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                      {uomHasError(brandIdx) && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Please select a unit of measure.</p>
                      )}
                    </div>
                    <button type="button" onClick={onOpenUomModal} title="Manage Units of Measure"
                      style={{ flexShrink: 0, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                      <LuSlidersHorizontal size={15} />
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ ...LABEL_STYLE }}>Reorder Point</label>
                  <input type="number" min="0" style={{ ...FIELD_STYLE, borderColor: '#fcd34d' }}
                    value={brand.reorderPoint}
                    onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()}
                    onChange={e => handleBrandChange(brandIdx, 'reorderPoint', e.target.value)}
                    placeholder="20" />
                </div>
              </div>

              {/* ── Pricing ── */}
              <SubtleDivider />
              <SectionHeading>Pricing</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ ...LABEL_STYLE, color: unitCostHasError(brandIdx) ? '#dc2626' : '#6b7280' }}>
                    Unit Cost <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input type="number" min="0" step="0.01"
                    style={unitCostHasError(brandIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE}
                    value={brand.unitCost}
                    onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()}
                    onChange={e => handleBrandChange(brandIdx, 'unitCost', e.target.value)} placeholder="0.00" />
                  {unitCostHasError(brandIdx) && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Unit cost is required.</p>
                  )}
                </div>
                <div>
                  <label style={{ ...LABEL_STYLE, color: sellingPriceHasError(brandIdx) ? '#dc2626' : '#6b7280' }}>
                    Selling Price <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input type="number" min="0" step="0.01"
                    style={sellingPriceHasError(brandIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE}
                    value={brand.sellingPrice}
                    onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()}
                    onChange={e => handleBrandChange(brandIdx, 'sellingPrice', e.target.value)} placeholder="0.00" />
                  {sellingPriceHasError(brandIdx) && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Selling price is required.</p>
                  )}
                </div>
              </div>

              {/* ── Stock Adjustment ── */}
              <SubtleDivider />
              <SectionHeading>Stock Adjustment</SectionHeading>
              {(() => {
                const current = Number(brand.qty) || 0;
                const delta = Number(brand.stockDelta) || 0;
                const newTotal = Math.max(0, brand.stockAction === 'add' ? current + delta : current - delta);
                const hasChange = delta > 0;
                return (
                  <div style={{ marginBottom: '8px' }}>
                    {/* Current Stock | New Total */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9ca3af' }}>Current Stock</p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>{current}</p>
                      </div>
                      <div style={{
                        background: hasChange ? (brand.stockAction === 'add' ? '#f0fdf4' : '#fff5f5') : '#f8fafc',
                        border: `1px solid ${hasChange ? (brand.stockAction === 'add' ? '#bbf7d0' : '#fecaca') : '#e5e7eb'}`,
                        borderRadius: '8px', padding: '12px 16px',
                      }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: hasChange ? (brand.stockAction === 'add' ? '#16a34a' : '#dc2626') : '#9ca3af' }}>New Total</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: hasChange ? (brand.stockAction === 'add' ? '#16a34a' : '#dc2626') : '#9ca3af' }}>{newTotal}</p>
                          {hasChange && (
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: brand.stockAction === 'add' ? '#16a34a' : '#dc2626' }}>
                              ({brand.stockAction === 'add' ? '+' : '−'}{delta})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Controls */}
                    <label style={{ ...LABEL_STYLE }}>Adjust By</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden', height: '38px', flexShrink: 0 }}>
                        {(['add', 'remove'] as const).map(action => (
                          <button key={action} type="button"
                            onClick={() => handleBrandChange(brandIdx, 'stockAction', action)}
                            style={{
                              padding: '0 18px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                              transition: 'background 0.15s, color 0.15s',
                              backgroundColor: brand.stockAction === action ? (action === 'add' ? '#16a34a' : '#dc2626') : '#f9fafb',
                              color: brand.stockAction === action ? '#fff' : '#6b7280',
                            }}>
                            {action === 'add' ? '+ Stock In' : '− Stock Out'}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flex: 1, border: '1px solid #9ca3af', borderRadius: '6px', overflow: 'hidden', height: '38px' }}>
                        <button type="button"
                          onClick={() => handleBrandChange(brandIdx, 'stockDelta', String(Math.max(0, (Number(brand.stockDelta) || 0) - 1)))}
                          style={{ width: '38px', flexShrink: 0, border: 'none', borderRight: '1px solid #e5e7eb', background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>
                          <LuMinus size={14} />
                        </button>
                        <input type="text" inputMode="numeric"
                          style={{ flex: 1, border: 'none', outline: 'none', textAlign: 'center', fontWeight: 600, fontSize: '0.95rem', color: '#374151', backgroundColor: '#fff' }}
                          value={brand.stockDelta}
                          onChange={e => handleBrandChange(brandIdx, 'stockDelta', e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="0" />
                        <button type="button"
                          onClick={() => handleBrandChange(brandIdx, 'stockDelta', String((Number(brand.stockDelta) || 0) + 1))}
                          style={{ width: '38px', flexShrink: 0, border: 'none', borderLeft: '1px solid #e5e7eb', background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>
                          <LuPlus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
          ))}

          {/* + Add Brand Variant */}
          <div style={{ padding: '0 24px 8px' }}>
            <button type="button" onClick={handleAddBrandVariant}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <LuPlus size={14} /> Add Another Brand
            </button>
          </div>

          {/* ── SUPPLIER SECTION ── */}
          <div style={{ padding: '0 28px 28px' }}>
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Suppliers</p>
              <span onClick={onOpenSupplierModal} style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#007bff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LuPlus size={13} /> New Supplier
              </span>
            </div>

            {supplierError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '12px' }}>
                <span>⚠</span> {supplierError}
              </div>
            )}

            {supplierEntries.map((entry, idx) => (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>

                {/* Row: badge + remove */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: idx === 0 ? '#1e40af' : '#6b7280',
                    background: idx === 0 ? '#eff6ff' : '#f3f4f6',
                    padding: '3px 10px', borderRadius: '999px',
                  }}>
                    {idx === 0 ? 'Primary' : `Alternate ${idx}`}
                  </span>
                  {supplierEntries.length > 1 && (
                    <button type="button" onClick={() => handleRemoveSupplier(idx)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                      <LuTrash2 size={13} /> Remove
                    </button>
                  )}
                </div>

                {/* Supplier select + auto-filled contact info below it */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ ...LABEL_STYLE, color: supplierHasError(idx) ? '#dc2626' : '#6b7280' }}>
                    Supplier Name {idx === 0 && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <select style={supplierHasError(idx) ? FIELD_ERROR_STYLE : FIELD_STYLE} value={entry.supplierName} onChange={e => handleSupplierChange(idx, 'supplierName', e.target.value)}>
                    <option value="">Select Supplier</option>
                    {suppliers.map((sup: any) => {
                      const used = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplierName);
                      return <option key={sup.id} value={sup.supplierName} disabled={used} style={{ color: used ? '#9ca3af' : '#374151' }}>{sup.supplierName}</option>;
                    })}
                  </select>
                  {supplierHasError(idx) && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Supplier is required.</p>
                  )}
                </div>

                {/* Contact info (read-only, auto-filled from supplier) + Lead Time + Min Order */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ ...LABEL_STYLE }}>Contact Person <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#b0b8c1' }}>· auto-filled</span></label>
                    <div style={{ ...READ_ONLY_STYLE }}>{entry.contactPerson || '—'}</div>
                  </div>
                  <div>
                    <label style={{ ...LABEL_STYLE }}>Contact Number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#b0b8c1' }}>· auto-filled</span></label>
                    <div style={{ ...READ_ONLY_STYLE }}>{entry.contactNumber || '—'}</div>
                  </div>
                </div>

                {/* Lead Time + Min Order */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ ...LABEL_STYLE }}>Lead Time (Days)</label>
                    <input type="number" min="0" style={{ ...FIELD_STYLE }} value={entry.leadTime} placeholder="e.g. 7" onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()} onChange={e => handleSupplierChange(idx, 'leadTime', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...LABEL_STYLE }}>Min Order (MOQ)</label>
                    <input type="number" min="0" style={{ ...FIELD_STYLE }} value={entry.minOrder} placeholder="e.g. 50" onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()} onChange={e => handleSupplierChange(idx, 'minOrder', e.target.value)} />
                  </div>
                </div>

              </div>
            ))}
            <button type="button" onClick={handleAddSupplier}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <LuPlus size={14} /> Add Supplier
            </button>
          </div>
        </div>
        {/* END SCROLLABLE BODY */}

        {/* FOOTER */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #f3f4f6', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
          {dupError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>⚠</span> {dupError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className={s.cancelBtn} onClick={handleCancelClick}>Cancel</button>
            <button onClick={handleSubmit}
              style={{ backgroundColor: '#111827', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
              Update Item
            </button>
          </div>
        </div>

      </div>

      {/* ── DISCARD CHANGES CONFIRM ── */}
      {showCancelConfirm && (
        <div className={s.confirmOverlay} onClick={() => setShowCancelConfirm(false)}>
          <div className={s.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={s.confirmIconWrap}><div className={s.confirmIcon}>⚠️</div></div>
            <div className={s.confirmTextWrap}>
              <p className={s.confirmTitle}>Discard Changes?</p>
              <p className={s.confirmSubtext}>All entered information will be lost.</p>
            </div>
            <div className={s.confirmButtons}>
              <button className={s.keepEditingBtn} onClick={() => setShowCancelConfirm(false)}>Keep Editing</button>
              <button className={s.discardBtn} onClick={() => { setShowCancelConfirm(false); onClose(); }}>Yes, Discard</button>
            </div>
          </div>
        </div>
      )}
      {showBrandModal && (
      <AddBrandModal
        isOpen={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        onSave={(newBrand) => {
          if (brandTargetIdx !== null) {
            handleBrandChange(brandTargetIdx, 'brand_id', newBrand.id);
            handleBrandChange(brandTargetIdx, 'brandName', newBrand.name);
          }
          onBrandAdded?.();
          setShowBrandModal(false);
        }}
        existingBrands={brands}
      />
    )}
    </div>
  );
};

export default EditInventoryModal;