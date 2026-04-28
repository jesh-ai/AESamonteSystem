/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Search, PackagePlus } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface Brand {
  brand_id:   number;
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
}

interface NewItemFormState {
  item_name:      string;
  brand_id:       number | '';
  new_brand_name: string;
  description:    string;
  uom_id:         number | '';
  reorder_point:  number;
  selling_price:  number | '';
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

// ── Styles ────────────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  border: '1px solid #e5e7eb', fontSize: '0.875rem',
  color: '#1f2937', outline: 'none', boxSizing: 'border-box',
  background: '#f9fafb',
};

// ── Factories ─────────────────────────────────────────────────────────────────

const BLANK_ITEM = (): ItemRow => ({
  inventory_brand_id: '',
  brand_name:         '',
  item_name:          '',
  uom_name:           '',
  quantity_ordered:   '',
  unit_cost:          '',
});

const BLANK_NEW_ITEM_FORM = (): NewItemFormState => ({
  item_name:      '',
  brand_id:       '',
  new_brand_name: '',
  description:    '',
  uom_id:         '',
  reorder_point:  20,
  selling_price:  '',
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddPOModal({ isOpen, onClose, onSaved, initialItems }: AddPOModalProps) {
  const [suppliers, setSuppliers]               = useState<Supplier[]>([]);
  const [brands, setBrands]                     = useState<Brand[]>([]);
  const [uoms, setUoms]                         = useState<UOM[]>([]);
  const [supplierId, setSupplierId]             = useState<number | ''>('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes]                       = useState('');
  const [items, setItems]                       = useState<ItemRow[]>([BLANK_ITEM()]);
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState('');

  // inline new-item sub-form
  const [showNewItemForm, setShowNewItemForm]   = useState(false);
  const [newBrandMode, setNewBrandMode]         = useState(false);
  const [newItemForm, setNewItemForm]           = useState<NewItemFormState>(BLANK_NEW_ITEM_FORM());
  const [newItemError, setNewItemError]         = useState('');
  const [confirmingNewItem, setConfirmingNewItem] = useState(false);

  // item search state (keyed by row index)
  const [searchQuery, setSearchQuery]     = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, any[]>>({});
  const [searchOpen, setSearchOpen]       = useState<Record<number, boolean>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const justPicked   = useRef<Record<number, boolean>>({});

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    setSupplierId('');
    setExpectedDelivery('');
    setNotes('');
    setError('');
    setShowNewItemForm(false);
    setNewBrandMode(false);
    setNewItemForm(BLANK_NEW_ITEM_FORM());
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
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.filter((s: any) => !s.is_archived));
      }
    } catch { /* silent */ }
  }

  async function fetchBrands() {
    try {
      const res = await fetch('/api/brands');
      if (res.ok) setBrands(await res.json());
    } catch { /* silent */ }
  }

  async function fetchUoms() {
    try {
      const res = await fetch('/api/uom');
      if (res.ok) setUoms(await res.json());
    } catch { /* silent */ }
  }

  // ── Item search ─────────────────────────────────────────────────────────────

  function handleSearchChange(idx: number, value: string) {
    if (justPicked.current[idx]) { justPicked.current[idx] = false; return; }
    setSearchQuery(prev => ({ ...prev, [idx]: value }));
    setSearchOpen(prev => ({ ...prev, [idx]: true }));
    clearTimeout(searchTimers.current[idx]);
    if (!value.trim()) {
      setSearchResults(prev => ({ ...prev, [idx]: [] }));
      return;
    }
    searchTimers.current[idx] = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/inventory/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (res.ok) setSearchResults(prev => ({ ...prev, [idx]: data }));
      } catch { /* silent */ }
    }, 300);
  }

  function handleItemSelect(idx: number, result: any) {
    justPicked.current[idx] = true;
    setSearchQuery(prev => ({ ...prev, [idx]: `${result.item_name} — ${result.brand_name}` }));
    setSearchOpen(prev => ({ ...prev, [idx]: false }));
    setItems(prev => prev.map((row, i) =>
      i !== idx ? row : {
        ...row,
        inventory_brand_id: result.inventory_brand_id,
        brand_name:         result.brand_name,
        item_name:          result.item_name,
        uom_name:           result.uom_name,
        unit_cost:          result.item_selling_price ?? '',
      }
    ));
  }

  function openNewItemForm(idx: number) {
    const query = searchQuery[idx]?.trim() ?? '';
    setSearchOpen(prev => ({ ...prev, [idx]: false }));
    setNewItemForm({ ...BLANK_NEW_ITEM_FORM(), item_name: query });
    setNewItemError('');
    setNewBrandMode(false);
    setShowNewItemForm(true);
  }

  // ── New item sub-form ───────────────────────────────────────────────────────

  function patchNewItem(patch: Partial<NewItemFormState>) {
    setNewItemForm(prev => ({ ...prev, ...patch }));
  }

  async function handleConfirmNewItem() {
    setNewItemError('');
    if (!newItemForm.item_name.trim()) return setNewItemError('Item name is required.');
    if (!newItemForm.uom_id)           return setNewItemError('Unit (UOM) is required.');

    const brand_name = newBrandMode
      ? (newItemForm.new_brand_name.trim() || 'No Brand')
      : (brands.find(b => b.brand_id === Number(newItemForm.brand_id))?.brand_name || 'No Brand');

    setConfirmingNewItem(true);
    try {
      const res = await fetch('/api/inventory/quick-add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name:     newItemForm.item_name.trim(),
          brand_id:      newBrandMode ? null : (newItemForm.brand_id || null),
          brand_name,
          description:   newItemForm.description || null,
          uom_id:        newItemForm.uom_id,
          reorder_point: newItemForm.reorder_point,
          selling_price: Number(newItemForm.selling_price) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewItemError(data.error ?? 'Failed to save item. Please try again.');
        return;
      }

      // Append a standard existing-item row using the real DB id
      const newRow: ItemRow = {
        inventory_brand_id: data.inventory_brand_id,
        brand_name:         data.brand_name,
        item_name:          data.item_name,
        uom_name:           data.uom_name,
        quantity_ordered:   '',
        unit_cost:          '',
      };
      const newIdx = items.length;
      setItems(prev => [...prev, newRow]);
      setSearchQuery(prev => ({ ...prev, [newIdx]: `${data.item_name} — ${data.brand_name}` }));

      setShowNewItemForm(false);
      setNewItemForm(BLANK_NEW_ITEM_FORM());
      setNewBrandMode(false);

    } catch {
      setNewItemError('Network error. Please try again.');
    } finally {
      setConfirmingNewItem(false);
    }
  }

  function handleCancelNewItem() {
    setShowNewItemForm(false);
    setNewItemForm(BLANK_NEW_ITEM_FORM());
    setNewBrandMode(false);
    setNewItemError('');
  }

  // ── Item row mutations ──────────────────────────────────────────────────────

  function addRow() {
    setItems(prev => [...prev, BLANK_ITEM()]);
  }

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
    if (!supplierId)        return setError('Please select a supplier.');
    if (!expectedDelivery)  return setError('Please set an expected delivery date.');
    if (items.length === 0) return setError('Add at least one item.');

    for (const [i, row] of items.entries()) {
      if (!row.inventory_brand_id) return setError(`Row ${i + 1}: select an item.`);
      if (!row.quantity_ordered || Number(row.quantity_ordered) <= 0)
        return setError(`Row ${i + 1}: quantity must be greater than 0.`);
      if (!row.unit_cost || Number(row.unit_cost) <= 0)
        return setError(`Row ${i + 1}: unit cost must be greater than 0.`);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/purchases/draft', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id:       supplierId,
          expected_delivery: expectedDelivery,
          notes:             notes.trim() || null,
          items: items.map(row => ({
            inventory_brand_id: row.inventory_brand_id,
            quantity_ordered:   Number(row.quantity_ordered),
            unit_cost:          Number(row.unit_cost),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create PO.'); return; }
      onSaved();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const totalCost = items.reduce((sum, r) =>
    sum + (Number(r.quantity_ordered) || 0) * (Number(r.unit_cost) || 0), 0
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#fff', width: '820px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#164163' }}>Create Purchase Order</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Supplier + Expected Delivery */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={LABEL}>Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))} style={INPUT}>
                <option value="">— Select supplier —</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL}>Expected Delivery *</label>
              <input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} style={INPUT} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={LABEL}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Items section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ ...LABEL, margin: 0 }}>Items *</label>
              <button
                onClick={addRow}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#164163', background: 'none', border: '1px solid #164163', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}
              >
                <Plus size={13} /> Add Row
              </button>
            </div>

            {/* ── Inline new-item sub-form ── */}
            {showNewItemForm && (
              <div style={{ border: '1.5px dashed #cbd5e1', borderRadius: '10px', padding: '16px', background: '#fff', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <PackagePlus size={16} color="#1a4263" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1a4263', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    New Inventory Item
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

                  {/* Item Name — full width */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={LABEL}>Item Name *</label>
                    <input
                      type="text"
                      value={newItemForm.item_name}
                      onChange={e => patchNewItem({ item_name: e.target.value })}
                      placeholder="e.g. Pilot G2 Pen"
                      style={INPUT}
                      autoFocus
                    />
                  </div>

                  {/* Brand Name */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ ...LABEL, marginBottom: 0 }}>Brand Name</label>
                      <button
                        type="button"
                        onClick={() => { setNewBrandMode(m => !m); patchNewItem({ brand_id: '', new_brand_name: '' }); }}
                        style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {newBrandMode ? '← Select existing' : '+ NEW BRAND'}
                      </button>
                    </div>
                    {newBrandMode ? (
                      <input
                        type="text"
                        value={newItemForm.new_brand_name}
                        onChange={e => patchNewItem({ new_brand_name: e.target.value })}
                        placeholder="Enter brand name"
                        style={INPUT}
                      />
                    ) : (
                      <select
                        value={newItemForm.brand_id}
                        onChange={e => patchNewItem({ brand_id: e.target.value ? Number(e.target.value) : '' })}
                        style={INPUT}
                      >
                        <option value="">— No Brand —</option>
                        {brands.map((b, i) => (
                          <option key={b.brand_id ?? `brand-${i}`} value={b.brand_id ?? ''}>{b.brand_name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Unit (UOM) */}
                  <div>
                    <label style={LABEL}>Unit (UOM) *</label>
                    <select
                      value={newItemForm.uom_id}
                      onChange={e => patchNewItem({ uom_id: e.target.value ? Number(e.target.value) : '' })}
                      style={INPUT}
                    >
                      <option value="">— Select UOM —</option>
                      {uoms.map(u => (
                        <option key={u.uom_id} value={u.uom_id}>{u.uom_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description — full width */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={LABEL}>Description</label>
                    <input
                      type="text"
                      value={newItemForm.description}
                      onChange={e => patchNewItem({ description: e.target.value })}
                      placeholder="Optional description"
                      style={INPUT}
                    />
                  </div>

                  {/* Reorder Point */}
                  <div>
                    <label style={LABEL}>Reorder Point</label>
                    <input
                      type="number"
                      min={0}
                      value={newItemForm.reorder_point}
                      onChange={e => patchNewItem({ reorder_point: Number(e.target.value) })}
                      style={INPUT}
                    />
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label style={LABEL}>Selling Price (₱)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={newItemForm.selling_price}
                      onChange={e => patchNewItem({ selling_price: e.target.value === '' ? '' : Number(e.target.value) })}
                      style={INPUT}
                    />
                  </div>
                </div>

                {newItemError && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px' }}>
                    {newItemError}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                  <button
                    type="button"
                    onClick={handleCancelNewItem}
                    disabled={confirmingNewItem}
                    style={{ padding: '7px 16px', borderRadius: '7px', border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.82rem', fontWeight: 600, color: '#374151', cursor: confirmingNewItem ? 'not-allowed' : 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmNewItem}
                    disabled={confirmingNewItem}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', borderRadius: '7px', border: 'none', background: confirmingNewItem ? '#93afc8' : '#1a4263', color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: confirmingNewItem ? 'not-allowed' : 'pointer' }}
                  >
                    <PackagePlus size={14} />
                    {confirmingNewItem ? 'Saving…' : 'Confirm Item'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Items table ── */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Item / Brand', 'UOM', 'Qty Ordered', 'Unit Cost (₱)', 'Subtotal', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>

                      {/* Item / Brand — search combobox */}
                      <td style={{ padding: '8px 10px', minWidth: '220px', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0 8px' }}>
                          <Search size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
                          <input
                            type="text"
                            placeholder="Search item..."
                            value={searchQuery[idx] ?? ''}
                            onChange={e => handleSearchChange(idx, e.target.value)}
                            onFocus={() => setSearchOpen(prev => ({ ...prev, [idx]: true }))}
                            onBlur={() => setTimeout(() => setSearchOpen(prev => ({ ...prev, [idx]: false })), 160)}
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.85rem', padding: '6px 0', width: '100%', color: '#1f2937' }}
                          />
                        </div>
                        {searchOpen[idx] && searchQuery[idx]?.trim() && (
                          <div style={{ position: 'absolute', top: 'calc(100% - 8px)', left: '10px', right: '10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                            {(searchResults[idx] ?? []).map((r: any) => (
                              <button
                                key={r.inventory_brand_id}
                                onMouseDown={() => handleItemSelect(idx, r)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#1f2937' }}
                              >
                                <span style={{ fontWeight: 600 }}>{r.item_name}</span>
                                <span style={{ color: '#6b7280' }}> — {r.brand_name}</span>
                                <span style={{ float: 'right', fontSize: '0.75rem', color: '#9ca3af' }}>{r.uom_name}</span>
                              </button>
                            ))}
                            {(searchResults[idx] ?? []).length > 0 && (
                              <div style={{ borderTop: '1px solid #f3f4f6' }} />
                            )}
                            {!showNewItemForm && (
                              <button
                                onMouseDown={() => openNewItemForm(idx)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '9px 12px', background: '#f8faff', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#3b82f6', borderRadius: '0 0 8px 8px' }}
                              >
                                <PackagePlus size={13} />
                                + Add New Item to Inventory
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* UOM */}
                      <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {row.uom_name || '—'}
                      </td>

                      {/* Qty Ordered */}
                      <td style={{ padding: '8px 10px', width: '110px' }}>
                        <input
                          type="number"
                          min={1}
                          placeholder="0"
                          value={row.quantity_ordered}
                          onChange={e => updateRow(idx, 'quantity_ordered', e.target.value === '' ? '' : Number(e.target.value))}
                          style={{ ...INPUT, textAlign: 'center' }}
                        />
                      </td>

                      {/* Unit Cost */}
                      <td style={{ padding: '8px 10px', width: '130px' }}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={row.unit_cost}
                          onChange={e => updateRow(idx, 'unit_cost', e.target.value === '' ? '' : Number(e.target.value))}
                          style={{ ...INPUT, textAlign: 'center' }}
                        />
                      </td>

                      {/* Subtotal */}
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        ₱{((Number(row.quantity_ordered) || 0) * (Number(row.unit_cost) || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Remove */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button
                          onClick={() => removeRow(idx)}
                          disabled={items.length === 1}
                          style={{ background: 'none', border: 'none', cursor: items.length === 1 ? 'not-allowed' : 'pointer', color: items.length === 1 ? '#d1d5db' : '#ef4444', padding: '4px', borderRadius: '4px' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={4} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>
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
          </div>

          {/* Error */}
          {error && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f3f4f6' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.875rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', background: submitting ? '#93afc8' : '#1a4263', color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? 'Saving…' : 'Save Draft'}
          </button>
        </div>

      </div>
    </div>
  );
}
