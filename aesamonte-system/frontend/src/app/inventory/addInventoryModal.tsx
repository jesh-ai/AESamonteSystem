/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import styles from "@/css/inventory.module.css";
import AddBrandModal from './AddBrandModal';
import { LuPlus, LuTrash2, LuSlidersHorizontal } from "react-icons/lu";

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

interface BrandVariant {
  brand_id: number | null;
  brandName: string;
  description: string;
  qty: string;
  uom: string;
  reorderPoint: string;
  unitCost: string;
  sellingPrice: string;
}

interface ItemGroup {
  itemName: string;
  brands: BrandVariant[];
}

interface AddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: any[]) => void;
  onOpenSupplierModal: () => void;
  onOpenUomModal: () => void;
  onBrandAdded?: () => void;  
  suppliers: Supplier[];
  brands: { id: number; name: string }[];
  uoms: { id: number; name: string }[];
  existingProducts?: { item_name: string }[];
  defaultSupplierName?: string;
}

const INITIAL_BRAND: BrandVariant = {
  brand_id: null,
  brandName: '',
  description: '',
  qty: '',
  uom: 'Select',
  reorderPoint: '20',
  unitCost: '',
  sellingPrice: '',
};

const INITIAL_ITEM: ItemGroup = {
  itemName: '',
  brands: [{ ...INITIAL_BRAND }],
};

const INITIAL_SUPPLIER: SupplierEntry = {
  supplierName: '', contactPerson: '', contactNumber: '', leadTime: '', minOrder: '',
};

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

const DISABLED_STYLE: React.CSSProperties = {
  ...FIELD_STYLE, backgroundColor: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

function computeSkuPreview(brandName: string, itemName: string): string {
  const words = ((brandName || itemName || '').trim().toUpperCase()).split(/\s+/).filter(w => w.length > 0);
  let prefix = '';
  for (let i = 0; i < Math.min(3, words.length); i++) prefix += words[i][0];
  if (prefix.length < 3) prefix = prefix.padEnd(3, 'X');
  return `${prefix}-AUTO`;
}

const AddInventoryModal: React.FC<AddInventoryModalProps> = ({
  isOpen, onClose, onSave, onOpenSupplierModal, onOpenUomModal,
  onBrandAdded,
  suppliers = [], brands = [], uoms = [],
  existingProducts = [], defaultSupplierName = ''
}) => {
  const s = styles as Record<string, string>;

  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([{ ...INITIAL_SUPPLIER }]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([{ ...INITIAL_ITEM, brands: [{ ...INITIAL_BRAND }] }]);
  const [dupError, setDupError] = useState('');
  const [supplierError, setSupplierError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [brandTargetItem, setBrandTargetItem] = useState<number | null>(null);


  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultSupplierName) {
        const sup = suppliers.find(s => s.supplierName === defaultSupplierName);
        setSupplierEntries([{
          supplierName: defaultSupplierName,
          contactPerson: sup?.contactPerson || '',
          contactNumber: sup?.contactNumber || '',
          leadTime: '', minOrder: '',
        }]);
      } else {
        setSupplierEntries([{ ...INITIAL_SUPPLIER }]);
      }
      setItemGroups([{ ...INITIAL_ITEM, brands: [{ ...INITIAL_BRAND }] }]);
      setDupError('');
      setSupplierError('');
      setShowCancelConfirm(false);
      setSubmitAttempted(false);
    }
  }, [isOpen, defaultSupplierName, suppliers]);

  const isFormDirty = (): boolean => {
    const hasItemData = itemGroups.some(ig =>
      ig.itemName?.trim() || ig.brands.some(b =>
        b.brandName || b.description || b.qty || b.unitCost || b.sellingPrice || b.uom !== 'Select'
      )
    );
    const hasSupplierData = supplierEntries.some(e => e.supplierName?.trim());
    return hasItemData || hasSupplierData;
  };

  const handleCancelClick = () => {
    if (isFormDirty()) setShowCancelConfirm(true);
    else onClose();
  };

  // ADD BEW BRAND 
  const handleBrandSaved = (newBrand: { id: number; name: string }) => {
  if (brandTargetItem !== null) {
    const lastBrandIdx = itemGroups[brandTargetItem].brands.length - 1;
    handleBrandChange(brandTargetItem, lastBrandIdx, 'brand_id', newBrand.id);
    handleBrandChange(brandTargetItem, lastBrandIdx, 'brandName', newBrand.name);
  }
  onBrandAdded?.(); 
};
  // ── SUPPLIER HANDLERS ──
  const handleSupplierChange = (idx: number, field: keyof SupplierEntry, value: string) => {
    setSupplierError('');
    setSupplierEntries(prev => {
      if (field === 'supplierName' && value) {
        const alreadyUsed = prev.some((e, i) => i !== idx && e.supplierName === value);
        if (alreadyUsed) {
          setSupplierError(`"${value}" is already added. Please select a different supplier.`);
          return prev;
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

  // ── ITEM GROUP HANDLERS ──
  const handleAddItemGroup = () =>
    setItemGroups(prev => [...prev, { itemName: '', brands: [{ ...INITIAL_BRAND }] }]);

  const handleRemoveItemGroup = (index: number) =>
    setItemGroups(prev => prev.filter((_, i) => i !== index));

  const handleItemNameChange = (index: number, value: string) => {
    setDupError('');
    setItemGroups(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], itemName: value };
      return updated;
    });
  };

  // ── BRAND VARIANT HANDLERS ──
  const handleBrandChange = (itemIdx: number, brandIdx: number, field: keyof BrandVariant, value: string | number | null) => {
    setItemGroups(prev => {
      const updated = [...prev];
      const brandsCopy = [...updated[itemIdx].brands];
      brandsCopy[brandIdx] = { ...brandsCopy[brandIdx], [field]: value };
      updated[itemIdx] = { ...updated[itemIdx], brands: brandsCopy };
      return updated;
    });
  };

  const handleAddBrand = (itemIdx: number) => {
    setItemGroups(prev => {
      const updated = [...prev];
      updated[itemIdx] = {
        ...updated[itemIdx],
        brands: [...updated[itemIdx].brands, { ...INITIAL_BRAND }],
      };
      return updated;
    });
  };

  const handleRemoveBrand = (itemIdx: number, brandIdx: number) => {
    setItemGroups(prev => {
      const updated = [...prev];
      updated[itemIdx] = {
        ...updated[itemIdx],
        brands: updated[itemIdx].brands.filter((_, i) => i !== brandIdx),
      };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDupError('');
    setSupplierError('');
    setSubmitAttempted(true);

    const normalize = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const validItems = itemGroups.filter(ig => ig.itemName?.trim());

    if (!validItems.length) {
      setDupError('Please fill in at least one item name before saving.');
      return;
    }

    const formNames = validItems.map(ig => normalize(ig.itemName));
    if (formNames.length !== new Set(formNames).size) {
      setDupError('Duplicate item names in your list. Each item must have a unique name.');
      return;
    }

    const conflict = validItems.find(ig =>
      existingProducts.some(p => normalize(p.item_name || '') === normalize(ig.itemName))
    );
    if (conflict) {
      setDupError(`"${conflict.itemName}" already exists in inventory.`);
      return;
    }

    for (const ig of validItems) {
      const brandsWithUom = ig.brands.filter(b => b.uom && b.uom !== 'Select');
      if (!brandsWithUom.length) {
        setDupError(`Please select a Unit of Measure for at least one brand under "${ig.itemName}".`);
        return;
      }
      const missingBrand = ig.brands.find(b => b.brand_id === null);
      if (missingBrand) {
        setDupError(`Please select a brand under "${ig.itemName}". Use "— No Brand" if not applicable.`);
        return;
      }
      const missingCost = ig.brands.find(b => b.unitCost === '' || b.unitCost === null);
      if (missingCost) {
        setDupError(`Unit Cost is required for all brands under "${ig.itemName}".`);
        return;
      }
      const missingPrice = ig.brands.find(b => b.sellingPrice === '' || b.sellingPrice === null);
      if (missingPrice) {
        setDupError(`Selling Price is required for all brands under "${ig.itemName}".`);
        return;
      }
    }

    if (!supplierEntries[0]?.supplierName) {
      setDupError('At least one supplier is required.');
      return;
    }

    const validSuppliers = supplierEntries.filter(e => e.supplierName);

    const payload = validItems.map(item => ({
      itemName: item.itemName,
      brands: item.brands.filter(b => b.uom && b.uom !== 'Select').map(b => ({
        brand_id: b.brand_id || undefined,
        brand_name: b.brandName || 'No Brand',
        sku: null,
        uom: b.uom,
        qty: Number(b.qty) || 0,
        unit_price: Number(b.unitCost) || 0,
        selling_price: Number(b.sellingPrice) || 0,
        itemDescription: b.description,
        reorderPoint: Number(b.reorderPoint) || 0,
      })),
      suppliers: validSuppliers.map((sup, i) => ({
        supplierName: sup.supplierName,
        leadTime: Number(sup.leadTime) || 0,
        minOrder: Number(sup.minOrder) || 0,
        isPrimary: i === 0,
      })),
    }));

    onSave(payload);
  };

  if (!isOpen) return null;

  // ── ERROR HELPERS ──
  const itemNameHasError = (itemIdx: number) =>
    submitAttempted && !itemGroups[itemIdx].itemName?.trim();

  const uomHasError = (itemIdx: number, brandIdx: number) =>
    submitAttempted && (!itemGroups[itemIdx].brands[brandIdx].uom || itemGroups[itemIdx].brands[brandIdx].uom === 'Select');

  const brandHasError = (itemIdx: number, brandIdx: number) =>
    submitAttempted && itemGroups[itemIdx].brands[brandIdx].brand_id === null;

  const unitCostHasError = (itemIdx: number, brandIdx: number) =>
    submitAttempted && (itemGroups[itemIdx].brands[brandIdx].unitCost === '' || itemGroups[itemIdx].brands[brandIdx].unitCost === null);

  const sellingPriceHasError = (itemIdx: number, brandIdx: number) =>
    submitAttempted && (itemGroups[itemIdx].brands[brandIdx].sellingPrice === '' || itemGroups[itemIdx].brands[brandIdx].sellingPrice === null);

  const supplierHasError = (idx: number) =>
    submitAttempted && idx === 0 && !supplierEntries[0]?.supplierName;

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1000 }}>
      <div className={s.modalContent} style={{
        maxHeight: '95vh', width: '820px', display: 'flex',
        flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden'
      }}>

        {/* HEADER */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', flexShrink: 0 }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Add Inventory Items</h2>
            <p className={s.subText}>Suppliers entered here will apply to all items and brands below.</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} style={{
          display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0
        }}>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb', minHeight: 0 }}>
            <div style={{ padding: '20px 24px' }}>

              {itemGroups.map((item, itemIdx) => (
                <div key={itemIdx} style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px', marginBottom: '20px' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600, fontSize: '1rem' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{itemIdx + 1}</div>
                      Item Group
                    </div>
                    {itemGroups.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItemGroup(itemIdx)}
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <LuTrash2 size={14} /> Remove
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ ...LABEL_STYLE, color: itemNameHasError(itemIdx) ? '#dc2626' : '#6b7280' }}>
                      Item Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      style={itemNameHasError(itemIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE}
                      value={item.itemName}
                      onChange={e => handleItemNameChange(itemIdx, e.target.value)}
                      placeholder="e.g. Bond Paper A4"
                    />
                    {itemNameHasError(itemIdx) && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Item name is required.</p>
                    )}
                  </div>

                  {item.brands.map((brand, brandIdx) => (
                    <div key={brandIdx} style={{ border: '2px dashed #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '12px', backgroundColor: '#fafafa' }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>
                          {brandIdx + 1} Brand Detail
                        </span>
                        {item.brands.length > 1 && (
                          <button type="button" onClick={() => handleRemoveBrand(itemIdx, brandIdx)}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            <LuTrash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ ...LABEL_STYLE, color: brandHasError(itemIdx, brandIdx) ? '#dc2626' : '#6b7280' }}>
                              Brand Name <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            {/* UPDATED: TRIGGER FOR BRAND MODAL */}
                            <span
                              onClick={() => { setBrandTargetItem(itemIdx); setShowBrandModal(true); }}
                              style={{ cursor: 'pointer', fontSize: '0.65rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}
                            >
                              + New Brand
                            </span>                          
                            </div>
                          
                          <select
                            style={brandHasError(itemIdx, brandIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE}
                            value={brand.brand_id ?? ''}
                            onChange={e => {
                              const selected = brands.find(b => String(b.id) === e.target.value);
                              handleBrandChange(itemIdx, brandIdx, 'brand_id', selected ? selected.id : null);
                              handleBrandChange(itemIdx, brandIdx, 'brandName', selected ? selected.name : '');
                            }}
                          >
                            <option value="">Select Brand</option>
                            {brands.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name === 'No Brand' ? '— No Brand' : b.name}
                              </option>
                            ))}
                          </select>
                          {brandHasError(itemIdx, brandIdx) && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Brand is required.</p>
                          )}
                        </div>
                        <div>
                          <label style={{ ...LABEL_STYLE }}>SKU (Auto)</label>
                          <input
                            style={{ ...DISABLED_STYLE }}
                            value={brand.brandName || item.itemName ? computeSkuPreview(brand.brandName, item.itemName) : ''}
                            readOnly
                            placeholder="Generated after save"
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ ...LABEL_STYLE }}>Description</label>
                        <input
                          style={{ ...FIELD_STYLE }}
                          value={brand.description}
                          onChange={e => handleBrandChange(itemIdx, brandIdx, 'description', e.target.value)}
                          placeholder="Specific brand details..."
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ ...LABEL_STYLE }}>Quantity</label>
                          <input
                            type="number" min="0"
                            style={{ ...FIELD_STYLE }}
                            value={brand.qty}
                            onChange={e => handleBrandChange(itemIdx, brandIdx, 'qty', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label style={{ ...LABEL_STYLE, color: uomHasError(itemIdx, brandIdx) ? '#dc2626' : '#6b7280' }}>
                            Unit (UOM) <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <select
                                style={{ ...(uomHasError(itemIdx, brandIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE), width: '100%' }}
                                value={brand.uom}
                                onChange={e => handleBrandChange(itemIdx, brandIdx, 'uom', e.target.value)}
                              >
                                <option value="Select">Select</option>
                                {uoms.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                              </select>
                              {uomHasError(itemIdx, brandIdx) && (
                                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Please select a unit.</p>
                              )}
                            </div>
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
                            onChange={e => handleBrandChange(itemIdx, brandIdx, 'reorderPoint', e.target.value)}
                            placeholder="20"
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ ...LABEL_STYLE, color: unitCostHasError(itemIdx, brandIdx) ? '#dc2626' : '#6b7280' }}>
                            Unit Cost <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="number" min="0" step="0.01"
                            style={unitCostHasError(itemIdx, brandIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE}
                            value={brand.unitCost}
                            onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()}
                            onChange={e => handleBrandChange(itemIdx, brandIdx, 'unitCost', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label style={{ ...LABEL_STYLE, color: sellingPriceHasError(itemIdx, brandIdx) ? '#dc2626' : '#6b7280' }}>
                            Selling Price <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="number" min="0" step="0.01"
                            style={sellingPriceHasError(itemIdx, brandIdx) ? FIELD_ERROR_STYLE : FIELD_STYLE}
                            value={brand.sellingPrice}
                            onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()}
                            onChange={e => handleBrandChange(itemIdx, brandIdx, 'sellingPrice', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => handleAddBrand(itemIdx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <LuPlus size={14} /> Add Another Brand
                  </button>
                </div>
              ))}

              <button type="button" onClick={handleAddItemGroup}
                style={{ width: '100%', padding: '12px', border: '2px dashed #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                <LuPlus /> Add New Item Category
              </button>
            </div>

            {/* SUPPLIER SECTION */}
            <div style={{ flexShrink: 0, padding: '20px 24px', backgroundColor: '#fff', borderTop: '1px solid #eaeaea' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Supplier Details</h4>
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
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: supplierHasError(idx) ? '#dc2626' : '#555', marginBottom: '4px' }}>
                        Supplier Name {idx === 0 && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>
                      <select style={supplierHasError(idx) ? FIELD_ERROR_STYLE : FIELD_STYLE} value={entry.supplierName} onChange={e => handleSupplierChange(idx, 'supplierName', e.target.value)}>
                        <option value="">Select Supplier</option>
                        {suppliers.map((sup, i) => {
                          const usedElsewhere = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplierName);
                          return (
                            <option key={sup.id || i} value={sup.supplierName} disabled={usedElsewhere} style={{ color: usedElsewhere ? '#9ca3af' : '#374151' }}>
                              {sup.supplierName}
                            </option>
                          );
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
                </div>
              ))}
              <button type="button" onClick={handleAddSupplier}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LuPlus size={14} /> Add Supplier
              </button>
            </div>
          </div>

          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
            {dupError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                 <span>⚠</span> {dupError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={handleCancelClick} className={s.cancelBtn}>Cancel</button>
              <button type="submit" className={s.saveBtn}>Save Inventory</button>
            </div>
          </div>
        </form>

        {showCancelConfirm && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '320px', textAlign: 'center' }}>
              <h3 style={{ marginTop: 0 }}>Discard changes?</h3>
              <p>You have unsaved data. Are you sure you want to exit?</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                <button onClick={() => setShowCancelConfirm(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer' }}>No, stay</button>
                <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}>Yes, discard</button>
              </div>
            </div>
          </div>
        )}
        {showBrandModal && (
        <AddBrandModal
          isOpen={showBrandModal}
          onClose={() => setShowBrandModal(false)}
          onSave={(newBrand) => {
            handleBrandSaved(newBrand);
            setShowBrandModal(false);
          }}
          existingBrands={brands}
        />
      )}
      </div>
      
    </div>
  );
};

export default AddInventoryModal;