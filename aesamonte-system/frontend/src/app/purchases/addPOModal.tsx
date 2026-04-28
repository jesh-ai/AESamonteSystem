/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, PackagePlus } from 'lucide-react';
import { LuPlus, LuTrash2, LuSlidersHorizontal } from 'react-icons/lu';
import AddBrandModal from '@/app/inventory/AddBrandModal';
import AddSupplierModal from '@/app/suppliers/addSupplierModal';
import UomModal from '@/app/inventory/UomModal';
import styles from '@/css/inventory.module.css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface Brand {
  brand_id: number;
  brand_name: string;
}

interface UOM {
  uom_id:   number;
  uom_name: string;
}

interface ItemRow {
  inventory_brand_id: number | '';
  brand_name:         string;
  item_name:          string;
  uom_name:           string;
  quantity_ordered:   number | '';
  unit_cost:          number | '';
  expiry_date:        string;
}

interface NewItemFormState {
  item_name:     string;
  brand_id:      number | '';
  description:   string;
  uom_id:        number | '';
  reorder_point: number;
  unit_cost:     number | '';
  selling_price: number | '';
  expiry_date:   string;
}

interface SupplierEntry {
  supplier_id:   number | '';
  supplierName:  string;
  leadTime:      string;
  minOrder:      string;
}

interface AddPOModalProps {
  isOpen:  boolean;
  onClose: () => void;
  onSaved: () => void;
  initialItems?: Array<{
    inventory_brand_id: number;
    item_name: string;
    brand_name: string;
    uom_name: string;
    quantity_ordered: number;
    unit_cost: number;
  }>;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') ?? '') : '';
  return { Authorization: `Bearer ${token}` };
}

// ── Shared style objects ───────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', height: '38px', padding: '8px 12px',
  borderRadius: '6px', border: '1px solid #9ca3af',
  backgroundColor: '#fff', color: '#374151',
  fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
};

// ── Factories ─────────────────────────────────────────────────────────────────

const BLANK_ITEM = (): ItemRow => ({
  inventory_brand_id: '',
  brand_name:         '',
  item_name:          '',
  uom_name:           '',
  quantity_ordered:   '',
  unit_cost:          '',
  expiry_date:        '',
});

const BLANK_NEW_ITEM = (): NewItemFormState => ({
  item_name:     '',
  brand_id:      '',
  description:   '',
  uom_id:        '',
  reorder_point: 20,
  unit_cost:     '',
  selling_price: '',
  expiry_date:   '',
});

const BLANK_SUPPLIER_ENTRY = (): SupplierEntry => ({
  supplier_id:  '',
  supplierName: '',
  leadTime:     '',
  minOrder:     '',
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddPOModal({ isOpen, onClose, onSaved, initialItems }: AddPOModalProps) {
  const s = styles as Record<string, string>;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands]       = useState<Brand[]>([]);
  const [uoms, setUoms]           = useState<UOM[]>([]);

  // ── Multi-supplier entries ─────────────────────────────────────────────────
  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([BLANK_SUPPLIER_ENTRY()]);
  const [supplierError, setSupplierError]     = useState('');

  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes]                       = useState('');
  const [items, setItems]                       = useState<ItemRow[]>([BLANK_ITEM()]);
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState('');

  // new item popup
  const [showNewItemModal, setShowNewItemModal]   = useState(false);
  const [newItemForm, setNewItemForm]             = useState<NewItemFormState>(BLANK_NEW_ITEM());
  const [newItemError, setNewItemError]           = useState('');
  const [confirmingNewItem, setConfirmingNewItem] = useState(false);

  // sub-modals
  const [showBrandModal, setShowBrandModal]       = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showUomModal, setShowUomModal]           = useState(false);

  // item search
  const [searchQuery, setSearchQuery]     = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, any[]>>({});
  const [searchOpen, setSearchOpen]       = useState<Record<number, boolean>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const justPicked   = useRef<Record<number, boolean>>({});

  // dropdown refs
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const searchInputRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    setSupplierEntries([BLANK_SUPPLIER_ENTRY()]);
    setSupplierError('');
    setExpectedDelivery('');
    setNotes('');
    setError('');
    setShowNewItemModal(false);
    setNewItemForm(BLANK_NEW_ITEM());
    setNewItemError('');
    setSearchQuery({});
    setSearchResults({});
    setSearchOpen({});
    // Pre-fill items from reorder if provided, otherwise start blank
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems.map(it => ({
        inventory_brand_id: it.inventory_brand_id,
        brand_name:         it.brand_name,
        item_name:          it.item_name,
        uom_name:           it.uom_name,
        quantity_ordered:   it.quantity_ordered,
        unit_cost:          it.unit_cost,
        expiry_date:        '',
      })));
      const qMap: Record<number, string> = {};
      initialItems.forEach((it, i) => { qMap[i] = `${it.item_name} — ${it.brand_name}`; });
      setSearchQuery(qMap);
    } else {
      setItems([BLANK_ITEM()]);
    }
    fetchSuppliers();
    fetchBrands();
    fetchUoms();
  }, [isOpen]);

  async function fetchSuppliers() {
    try {
      const res = await fetch('/api/suppliers', { headers: authHeader() });
      if (res.ok) setSuppliers((await res.json()).filter((sup: any) => !sup.is_archived));
    } catch { /* silent */ }
  }
  async function fetchBrands() {
    try {
      const res = await fetch('/api/brands', { headers: authHeader() });
      if (res.ok) setBrands(await res.json());
    } catch { /* silent */ }
  }
  async function fetchUoms() {
    try {
      const res = await fetch('/api/uom', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setUoms(data.map((u: any) => ({
          uom_id:   u.uom_id   ?? u.id,
          uom_name: u.uom_name ?? u.name,
        })));
      }
    } catch { /* silent */ }
  }

  // ── Supplier entry handlers ────────────────────────────────────────────────

  function handleSupplierEntryChange(idx: number, field: keyof SupplierEntry, value: string | number) {
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
        const sup = suppliers.find(s => s.supplier_name === value);
        entry.supplier_id = sup ? sup.supplier_id : '';
      }
      updated[idx] = entry;
      return updated;
    });
  }

  function addSupplierEntry() {
    setSupplierEntries(prev => [...prev, BLANK_SUPPLIER_ENTRY()]);
  }

  function removeSupplierEntry(idx: number) {
    setSupplierError('');
    setSupplierEntries(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Item search ─────────────────────────────────────────────────────────────

  function handleSearchChange(idx: number, value: string) {
  if (justPicked.current[idx]) { justPicked.current[idx] = false; return; }
  setSearchQuery(prev => ({ ...prev, [idx]: value }));
  setSearchOpen(prev  => ({ ...prev, [idx]: true  }));

  // Calculate fixed position for dropdown
  const el = searchInputRefs.current[idx];
  if (el) {
    const rect = el.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  clearTimeout(searchTimers.current[idx]);
  if (!value.trim()) { setSearchResults(prev => ({ ...prev, [idx]: [] })); return; }
  searchTimers.current[idx] = setTimeout(async () => {
    try {
      const res  = await fetch(`/api/inventory/search?q=${encodeURIComponent(value)}`, { headers: authHeader() });
      const data = await res.json();
      if (res.ok) setSearchResults(prev => ({ ...prev, [idx]: data }));
    } catch { /* silent */ }
  }, 300);
}

  function handleItemSelect(idx: number, result: any) {
    justPicked.current[idx] = true;
    setSearchQuery(prev => ({ ...prev, [idx]: `${result.item_name} — ${result.brand_name} (${result.uom_name})` }));
    setSearchOpen(prev  => ({ ...prev, [idx]: false }));
    setItems(prev => prev.map((row, i) => i !== idx ? row : {
      ...row,
      inventory_brand_id: result.inventory_brand_id,
      brand_name:         result.brand_name,
      item_name:          result.item_name,
      uom_name:           result.uom_name,
      unit_cost:          result.item_selling_price ?? '',
    }));
  }

  // ── New item popup ───────────────────────────────────────────────────────────

  function patchNewItem(patch: Partial<NewItemFormState>) {
    setNewItemForm(prev => ({ ...prev, ...patch }));
  }

  function openNewItemModal() {
    setNewItemForm(BLANK_NEW_ITEM()); setNewItemError(''); setShowNewItemModal(true);
  }

  function cancelNewItem() {
    setShowNewItemModal(false); setNewItemForm(BLANK_NEW_ITEM()); setNewItemError('');
  }

  async function handleConfirmNewItem() {
    setNewItemError('');
    if (!newItemForm.item_name.trim()) return setNewItemError('Item name is required.');
    if (!newItemForm.uom_id)           return setNewItemError('Unit (UOM) is required.');

    const brand_name = brands.find(b => b.brand_id === Number(newItemForm.brand_id))?.brand_name || 'No Brand';
    setConfirmingNewItem(true);
    try {
      const res = await fetch('/api/inventory/quick-add', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          item_name:     newItemForm.item_name.trim(),
          brand_id:      newItemForm.brand_id || null,
          brand_name,
          description:   newItemForm.description || null,
          uom_id:        newItemForm.uom_id,
          reorder_point: newItemForm.reorder_point,
          selling_price: Number(newItemForm.selling_price) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNewItemError(data.error ?? 'Failed to save item.'); return; }

      const newIdx = items.length;
      setItems(prev => [...prev, {
        inventory_brand_id: data.inventory_brand_id,
        brand_name:         data.brand_name,
        item_name:          data.item_name,
        uom_name:           data.uom_name,
        quantity_ordered:   '',
        unit_cost:          Number(newItemForm.unit_cost) || '',
        expiry_date:        newItemForm.expiry_date || '',
      }]);
      setSearchQuery(prev => ({ ...prev, [newIdx]: `${data.item_name} — ${data.brand_name}` }));
      setShowNewItemModal(false);
      setNewItemForm(BLANK_NEW_ITEM());
    } catch {
      setNewItemError('Network error. Please try again.');
    } finally {
      setConfirmingNewItem(false);
    }
  }

  // ── Row mutations ───────────────────────────────────────────────────────────

  function addRow() { setItems(prev => [...prev, BLANK_ITEM()]); }

  function removeRow(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setSearchQuery(prev  => { const n = { ...prev };  delete n[idx]; return n; });
    setSearchResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setSearchOpen(prev   => { const n = { ...prev };  delete n[idx]; return n; });
  }

  function updateRow(idx: number, field: keyof ItemRow, value: any) {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError('');
    setSupplierError('');

    const primarySupplier = supplierEntries[0];
    if (!primarySupplier?.supplier_id) return setError('Please select a primary supplier.');
    if (!expectedDelivery)             return setError('Please set an expected delivery date.');
    if (!items.length)                 return setError('Add at least one item.');

    for (const [i, row] of items.entries()) {
      if (!row.inventory_brand_id)                                    return setError(`Row ${i + 1}: select an item.`);
      if (!row.quantity_ordered || Number(row.quantity_ordered) <= 0) return setError(`Row ${i + 1}: quantity must be > 0.`);
      if (!row.unit_cost        || Number(row.unit_cost)        <= 0) return setError(`Row ${i + 1}: unit cost must be > 0.`);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/purchases/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          supplier_id:       primarySupplier.supplier_id,
          expected_delivery: expectedDelivery,
          notes:             notes.trim() || null,
          items: items.map(r => ({
            inventory_brand_id: r.inventory_brand_id,
            quantity_ordered:   Number(r.quantity_ordered),
            unit_cost:          Number(r.unit_cost),
            expiry_date:        r.expiry_date || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create PO.'); return; }
      onSaved(); onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const totalCost = items.reduce((sum, r) =>
    sum + (Number(r.quantity_ordered) || 0) * (Number(r.unit_cost) || 0), 0);

  const brandsForModal = brands.map(b => ({ id: b.brand_id, name: b.brand_name }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Main PO Modal ── */}
      <div className={s.modalOverlay} style={{ zIndex: 3000 }}>
        <div className={s.modalContent} style={{
          width: '940px', maxWidth: '95vw', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column', padding: 0,
          borderRadius: '12px', overflow: 'hidden',
        }}>

          {/* Header */}
          <div className={s.modalHeader} style={{
            padding: '20px 24px', backgroundColor: '#fff',
            borderBottom: '1px solid #eaeaea', flexShrink: 0,
          }}>
            <div className={s.modalTitleGroup}>
              <h2 className={s.title} style={{ fontSize: '1.2rem', marginBottom: '2px' }}>Create Purchase Order</h2>
              <p className={s.subText}>Select items, then assign a supplier and delivery date below.</p>
            </div>
          </div>

          {/* ── Single scrollable body ── */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb', minHeight: 0 }}>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── ITEMS CARD ── */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Items *</span>
                  <button
                    onClick={addRow}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <LuPlus size={14} /> Add Row
                  </button>
                </div>

                {/* Table */}
                <div style={{ overflowY: 'visible' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        {['Item / Brand', 'UOM', 'Qty Ordered', 'Unit Cost (₱)', 'Expiry Date', 'Subtotal', ''].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>

                          {/* Item search */}
                          <td style={{ padding: '8px 10px', minWidth: '220px' }}>
                            {row.inventory_brand_id ? (
                              // ── Selected state: show a pill with a clear button ──
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: '#eff6ff', border: '1px solid #bfdbfe',
                                borderRadius: '6px', padding: '4px 10px',
                              }}>
                                <span style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: 500, flex: 1 }}>
                                  {row.item_name}
                                  <span style={{ color: '#6b7280', fontWeight: 400 }}> — {row.brand_name}</span>
                                </span>
                                <button
                                  type="button"
                                  onMouseDown={() => {
                                    setItems(prev => prev.map((r, i) => i !== idx ? r : BLANK_ITEM()));
                                    setSearchQuery(prev => ({ ...prev, [idx]: '' }));
                                    setSearchResults(prev => ({ ...prev, [idx]: [] }));
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 2px', display: 'flex', lineHeight: 1 }}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              // ── Search state ──
                              <div style={{ position: 'relative' }} ref={el => { searchInputRefs.current[idx] = el; }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f9fafb', border: '1px solid #9ca3af', borderRadius: '6px', padding: '0 8px' }}>
                                  <Search size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
                                  <input
                                    type="text"
                                    placeholder="Search item..."
                                    value={searchQuery[idx] ?? ''}
                                    onChange={e => handleSearchChange(idx, e.target.value)}
                                    onFocus={() => {
                                      setSearchOpen(prev => ({ ...prev, [idx]: true }));
                                    }}
                                    onBlur={() => setTimeout(() => setSearchOpen(prev => ({ ...prev, [idx]: false })), 160)}
                                    style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.875rem', padding: '6px 0', width: '100%', color: '#374151' }}
                                  />
                                </div>
                                {searchOpen[idx] && searchQuery[idx]?.trim() && (
                                  <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 4px)',
                                    left: 0,
                                    minWidth: '400px',
                                    background: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                                    zIndex: 9999,          // ← high enough to escape table stacking
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                  }}>
                                    {(() => {
                                      const pickedIds = new Set(items.map(r => r.inventory_brand_id).filter(Boolean));
                                      const filtered  = (searchResults[idx] ?? []).filter((r: any) => !pickedIds.has(r.inventory_brand_id));
                                      return filtered.length > 0 ? (
                                        filtered.map((r: any) => (
                                          <button
                                            key={r.inventory_brand_id}
                                            onMouseDown={() => handleItemSelect(idx, r)}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              width: '100%',
                                              padding: '10px 12px',
                                              borderBottom: '1px solid #f3f4f6',
                                              textAlign: 'left',
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            <div>
                                              <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>
                                                {r.item_name} — {r.brand_name} ({r.uom_name})
                                              </div>
                                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                Desc: {r.description || 'No description'}
                                              </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
                                              <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>
                                                ₱{Number(r.item_selling_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                              </div>
                                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                Stock: {r.stock_quantity ?? 0}
                                              </div>
                                            </div>
                                          </button>
                                        ))
                                      ) : (
                                        <div style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#9ca3af', fontStyle: 'italic' }}>
                                          No items found.
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          {/* UOM */}
                          <td style={{ padding: '8px 10px', minWidth: '110px' }}>
                            <select
                              value={row.uom_name}
                              onChange={e => updateRow(idx, 'uom_name', e.target.value)}
                              style={{ ...FIELD_STYLE, height: '34px', padding: '4px 8px', fontSize: '0.875rem' }}
                            >
                              <option value=""> UOM </option>
                              {uoms.map(u => (
                                <option key={u.uom_id} value={u.uom_name}>{u.uom_name}</option>
                              ))}
                            </select>
                          </td>

                          {/* Qty */}
                          <td style={{ padding: '8px 10px', width: '100px' }}>
                            <input
                              type="number" min={1} placeholder="0"
                              value={row.quantity_ordered}
                              onChange={e => updateRow(idx, 'quantity_ordered', e.target.value === '' ? '' : Number(e.target.value))}
                              style={{ ...FIELD_STYLE, height: '34px', padding: '4px 8px', fontSize: '0.875rem', textAlign: 'center' }}
                            />
                          </td>

                          {/* Unit Cost */}
                          <td style={{ padding: '8px 10px', width: '120px' }}>
                            <input
                              type="number" min={0} step="0.01" placeholder="0.00"
                              value={row.unit_cost}
                              onChange={e => updateRow(idx, 'unit_cost', e.target.value === '' ? '' : Number(e.target.value))}
                              style={{ ...FIELD_STYLE, height: '34px', padding: '4px 8px', fontSize: '0.875rem', textAlign: 'center' }}
                            />
                          </td>

                          {/* Expiry Date */}
                          <td style={{ padding: '8px 10px', width: '140px' }}>
                            <input
                              type="date"
                              value={row.expiry_date}
                              onChange={e => updateRow(idx, 'expiry_date', e.target.value)}
                              style={{ ...FIELD_STYLE, height: '34px', padding: '4px 8px', fontSize: '0.875rem' }}
                            />
                          </td>

                          {/* Subtotal */}
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', textAlign: 'right' }}>
                            ₱{((Number(row.quantity_ordered) || 0) * (Number(row.unit_cost) || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Remove */}
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              onClick={() => removeRow(idx)}
                              disabled={items.length === 1}
                              style={{ background: 'none', border: 'none', cursor: items.length === 1 ? 'not-allowed' : 'pointer', color: items.length === 1 ? '#d1d5db' : '#ef4444', padding: '4px', display: 'flex' }}
                            >
                              <LuTrash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                        <td colSpan={5} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>
                          Total Cost
                        </td>
                        <td style={{ padding: '10px', fontWeight: 700, fontSize: '0.95rem', color: '#164163', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ₱{totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* + Add New Item to Inventory */}
                <button
                  type="button"
                  onClick={openNewItemModal}
                  style={{ width: '100%', marginTop: '12px', padding: '12px', border: '2px dashed #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', color: '#4b5563', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#2563eb'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#4b5563'; }}
                >
                  <PackagePlus size={15} />
                  + Add New Item to Inventory
                </button>
              </div>

              {/* ── SUPPLIER & DELIVERY CARD ── */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

                {/* Card header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #eaeaea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Supplier Details</h4>
                  <span
                    onClick={() => setShowSupplierModal(true)}
                    style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#007bff', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <LuPlus size={13} /> New Supplier
                  </span>
                </div>

                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {/* Supplier error banner */}
                  {supplierError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                      <span>⚠</span> {supplierError}
                    </div>
                  )}

                  {/* Supplier rows */}
                  {supplierEntries.map((entry, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: `1px solid ${idx === 0 ? '#bfdbfe' : '#e5e7eb'}`,
                        borderRadius: '10px',
                        padding: '14px',
                        backgroundColor: idx === 0 ? '#f0f7ff' : '#fafafa',
                      }}
                    >
                      {/* Row header: badge + remove */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        {idx === 0
                          ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '999px' }}>PRIMARY</span>
                          : <span style={{ fontSize: '0.72rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '999px', border: '1px solid #e5e7eb' }}>Alternate</span>
                        }
                        {supplierEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSupplierEntry(idx)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            <LuTrash2 size={13} /> Remove
                          </button>
                        )}
                      </div>

                      {/* Fields: supplier dropdown | lead time | min order */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>
                            Supplier Name {idx === 0 && <span style={{ color: '#ef4444' }}>*</span>}
                          </label>
                          <select
                            value={entry.supplierName}
                            onChange={e => handleSupplierEntryChange(idx, 'supplierName', e.target.value)}
                            style={FIELD_STYLE}
                          >
                            <option value="">Select Supplier</option>
                            {suppliers.map(sup => {
                              const usedElsewhere = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplier_name);
                              return (
                                <option
                                  key={sup.supplier_id}
                                  value={sup.supplier_name}
                                  disabled={usedElsewhere}
                                  style={{ color: usedElsewhere ? '#9ca3af' : '#374151' }}
                                >
                                  {sup.supplier_name}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Lead Time (Days)</label>
                          <input
                            type="number" min={0} placeholder="e.g. 7"
                            value={entry.leadTime}
                            onChange={e => handleSupplierEntryChange(idx, 'leadTime', e.target.value)}
                            style={FIELD_STYLE}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Min Order (MOQ)</label>
                          <input
                            type="number" min={0} placeholder="e.g. 50"
                            value={entry.minOrder}
                            onChange={e => handleSupplierEntryChange(idx, 'minOrder', e.target.value)}
                            style={FIELD_STYLE}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Supplier link */}
                  <button
                    type="button"
                    onClick={addSupplierEntry}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}
                  >
                    <LuPlus size={14} /> Add Supplier
                  </button>

                  {/* Expected Delivery */}
                  <div>
                    <label style={LABEL_STYLE}>Expected Delivery <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="date"
                      value={expectedDelivery}
                      onChange={e => setExpectedDelivery(e.target.value)}
                      style={FIELD_STYLE}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={LABEL_STYLE}>Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional notes..."
                      style={{ ...FIELD_STYLE, height: 'auto', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                  <span>⚠</span> {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={s.modalFooter} style={{ padding: '16px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0 }}>
            <button type="button" onClick={onClose} className={s.cancelBtn}>Cancel</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={s.saveBtn}
              style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </div>
      </div>

      {/* ── New Item Popup Modal ── */}
      {showNewItemModal && (
        <div className={s.modalOverlay} style={{ zIndex: 3100 }}>
          <div className={s.modalContent} style={{
            width: '580px', maxWidth: '95vw', maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', padding: 0,
            borderRadius: '12px', overflow: 'auto',
          }}>

            {/* Header */}
            <div className={s.modalHeader} style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', flexShrink: 0 }}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title} style={{ fontSize: '1.1rem', marginBottom: '2px' }}>Add New Item to Inventory</h2>
                <p className={s.subText}>This item will be saved to inventory and added to this order.</p>
              </div>
              <button onClick={cancelNewItem} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', display: 'flex', flexShrink: 0 }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f9fafb' }}>

              <div style={{ backgroundColor: '#fafafa', borderRadius: '10px', border: '2px dashed #e2e8f0', padding: '18px' }}>

                {/* Item Name */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={LABEL_STYLE}>Item Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={newItemForm.item_name}
                    onChange={e => patchNewItem({ item_name: e.target.value })}
                    placeholder="e.g. Bond Paper A4"
                    style={FIELD_STYLE}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  {/* Brand */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ ...LABEL_STYLE, marginBottom: 0 }}>Brand Name</label>
                      <span
                        onClick={() => setShowBrandModal(true)}
                        style={{ cursor: 'pointer', fontSize: '0.65rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}
                      >
                        + New Brand
                      </span>
                    </div>
                    <select
                      value={newItemForm.brand_id}
                      onChange={e => patchNewItem({ brand_id: e.target.value ? Number(e.target.value) : '' })}
                      style={FIELD_STYLE}
                    >
                      <option value="">Select Brand</option>
                      {brands.map((b, i) => (
                        <option key={b.brand_id ?? `brand-${i}`} value={b.brand_id ?? ''}>
                          {b.brand_name === 'No Brand' ? '— No Brand' : b.brand_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* UOM */}
                  <div>
                    <label style={LABEL_STYLE}>Unit (UOM) <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <select
                          value={newItemForm.uom_id}
                          onChange={e => patchNewItem({ uom_id: e.target.value ? Number(e.target.value) : '' })}
                          style={{ ...FIELD_STYLE, width: '100%' }}
                        >
                          <option value="">Select</option>
                          {uoms.map(u => (
                            <option key={u.uom_id} value={u.uom_id}>{u.uom_name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        title="Manage Units of Measure"
                        onClick={() => setShowUomModal(true)}
                        style={{ flexShrink: 0, width: '34px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}
                      >
                        <LuSlidersHorizontal size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={LABEL_STYLE}>Description</label>
                  <input
                    type="text"
                    value={newItemForm.description}
                    onChange={e => patchNewItem({ description: e.target.value })}
                    placeholder="Specific brand details..."
                    style={FIELD_STYLE}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  {/* Reorder Point */}
                  <div>
                    <label style={LABEL_STYLE}>Reorder Point</label>
                    <input
                      type="number" min={0}
                      value={newItemForm.reorder_point}
                      onChange={e => patchNewItem({ reorder_point: Number(e.target.value) })}
                      style={{ ...FIELD_STYLE, border: '1px solid #fcd34d' }}
                    />
                  </div>

                  {/* Unit Cost */}
                  <div>
                    <label style={LABEL_STYLE}>Unit Cost (₱)</label>
                    <input
                      type="number" min={0} step="0.01" placeholder="0.00"
                      value={newItemForm.unit_cost}
                      onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()}
                      onChange={e => patchNewItem({ unit_cost: e.target.value === '' ? '' : Number(e.target.value) })}
                      style={FIELD_STYLE}
                    />
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label style={LABEL_STYLE}>Selling Price (₱)</label>
                    <input
                      type="number" min={0} step="0.01" placeholder="0.00"
                      value={newItemForm.selling_price}
                      onKeyDown={e => ['-', 'e', 'E'].includes(e.key) && e.preventDefault()}
                      onChange={e => patchNewItem({ selling_price: e.target.value === '' ? '' : Number(e.target.value) })}
                      style={FIELD_STYLE}
                    />
                  </div>
                </div>

                {/* Expiry Date */}
                <div>
                  <label style={LABEL_STYLE}>Expiry Date (Shelf Life)</label>
                  <input
                    type="date"
                    value={newItemForm.expiry_date}
                    onChange={e => patchNewItem({ expiry_date: e.target.value })}
                    style={FIELD_STYLE}
                  />
                </div>
              </div>

              {newItemError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                  <span>⚠</span> {newItemError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={s.modalFooter} style={{ padding: '16px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0 }}>
              <button type="button" onClick={cancelNewItem} disabled={confirmingNewItem} className={s.cancelBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmNewItem}
                disabled={confirmingNewItem}
                className={s.saveBtn}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: confirmingNewItem ? 0.6 : 1, cursor: confirmingNewItem ? 'not-allowed' : 'pointer' }}
              >
                <PackagePlus size={13} />
                {confirmingNewItem ? 'Saving…' : 'Add to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UOM Modal ── */}
      {showUomModal && (
        <UomModal
          isOpen={showUomModal}
          onClose={() => setShowUomModal(false)}
          onUomAdded={(newUom) => {
            setUoms(prev => [...prev, { uom_id: newUom.id, uom_name: newUom.name }]);
            patchNewItem({ uom_id: newUom.id });
          }}
        />
      )}

      {/* ── Add Brand Modal ── */}
      {showBrandModal && (
        <AddBrandModal
          isOpen={showBrandModal}
          onClose={() => setShowBrandModal(false)}
          onSave={(newBrand) => {
            setBrands(prev => [...prev, { brand_id: newBrand.id, brand_name: newBrand.name }]);
            patchNewItem({ brand_id: newBrand.id });
            setShowBrandModal(false);
          }}
          existingBrands={brandsForModal}
        />
      )}

      {/* ── Add Supplier Modal ── */}
      {showSupplierModal && (
        <AddSupplierModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          onSuccess={() => { fetchSuppliers(); setShowSupplierModal(false); }}
          existingSuppliers={suppliers}
        />
      )}
    </>
  );
}