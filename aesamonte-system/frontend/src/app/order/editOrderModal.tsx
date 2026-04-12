/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import styles from "@/css/order.module.css"; 
import { LuX, LuPlus, LuTrash2, LuSearch} from "react-icons/lu";

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any; 
  onSave: (updatedOrder: any) => void;
  statuses?: any[];       
  paymentMethods?: any[]; 
  inventoryItems?: any[]; 
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const FIELD_ERROR_STYLE: React.CSSProperties = {
  border: '1px solid #f87171',
  backgroundColor: '#fff5f5',
};

const OrderEditModal = ({ isOpen, onClose, orderData, onSave, statuses = [], paymentMethods = [], inventoryItems = [] }: OrderEditModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  const activeInventory = (inventoryItems || []).filter((inv: any) => !inv.is_archived);

  const searchableItems = activeInventory.flatMap((inv: any) =>
    (inv.brands || [])
      .filter((b: any) => Number(b.qty) > 0)
      .map((b: any) => ({
        inventory_brand_id: b.inventory_brand_id,
        inventory_id: inv.id,
        brand_id: b.brand_id,
        brand_name: b.brand_name !== 'No Brand' ? b.brand_name : '—',
        item_name: inv.item_name,
        item_description: inv.item_description,
        uom: inv.uom,
        price: Number(b.selling_price ?? 0),
        qty: Number(b.qty),
      }))
  );

  useEffect(() => {
    if (orderData) {
      const initialItems = orderData.items && orderData.items.length > 0
        ? orderData.items.map((i: any) => ({
            inventory_brand_id: i.inventory_brand_id,
            inventory_id: i.inventory_id,
            item: i.item_name || '',
            itemDescription: i.description || '—',
            quantity: i.order_quantity || '',
            amount: i.amount || 0
          }))
        : [{ inventory_id: '', item: '', itemDescription: '—', quantity: '1', amount: 0 }];

      const built = {
        id: orderData.id,
        customerName: orderData.name || orderData.customer, 
        contact: orderData.contact || '',
        address: orderData.address || '',
        status: orderData.status || 'Preparing',
        paymentMethod: orderData.paymentMethod || 'Cash',
        items: initialItems
      };

      setFormData(built);
      setOriginalData(JSON.parse(JSON.stringify(built)));
      setSubmitError('');
      setSubmitAttempted(false);
      setShowCancelConfirm(false);
    }
  }, [orderData]);

  const hasChanges = () => {
    if (!formData || !originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const handleCancelClick = () => {
    if (hasChanges()) setShowCancelConfirm(true);
    else onClose();
  };

  const handleItemSelect = (index: number, entry: any) => {
    const safeItems = formData.items || [];
    const newItems = [...safeItems];
    const currentQty = Number(newItems[index].quantity) || 1;
    newItems[index] = {
      ...newItems[index],
      inventory_brand_id: entry.inventory_brand_id,
      inventory_id: entry.inventory_id,
      brand_id: entry.brand_id,
      brand_name: entry.brand_name,
      item: `${entry.item_name} — ${entry.brand_name} (${entry.uom})`,
      itemDescription: entry.item_description || 'No Description',
      uom: entry.uom || '',
      quantity: currentQty,
      amount: currentQty * entry.price
    };
    setFormData({ ...formData, items: newItems });
    setActiveSearchIndex(null);
  };

  const handleItemTextChange = (index: number, text: string) => {
    const safeItems = formData.items || [];
    const newItems = [...safeItems];
    newItems[index].item = text;
    const match = searchableItems.find((s: any) => s.item_name.toLowerCase().trim() === text.toLowerCase().trim());
    if (match) {
      newItems[index].inventory_brand_id = match.inventory_brand_id;
      newItems[index].inventory_id = match.inventory_id;
      newItems[index].brand_id = match.brand_id;
      newItems[index].brand_name = match.brand_name;
      newItems[index].itemDescription = match.item_description || 'No Description';
      newItems[index].uom = match.uom || '';
      const qtyNum = Number(newItems[index].quantity) || 1;
      newItems[index].amount = qtyNum * match.price;
    } else {
      newItems[index].inventory_brand_id = '';
      newItems[index].inventory_id = '';
      newItems[index].brand_id = '';
      newItems[index].brand_name = '—';
      newItems[index].itemDescription = '—';
      newItems[index].amount = 0;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleQtyChange = (index: number, newQty: string) => {
    const safeItems = formData.items || [];
    const newItems = [...safeItems];
    const qtyNum = Number(newQty) || 0;
    const entry = searchableItems.find((s: any) =>
      String(s.inventory_brand_id) === String(newItems[index].inventory_brand_id)
    );
    const existingPrice = (Number(newItems[index].amount) / (Number(newItems[index].quantity) || 1)) || 0;
    const price = entry ? entry.price : existingPrice;
    newItems[index] = { ...newItems[index], quantity: newQty, amount: price * qtyNum };
    setFormData({ ...formData, items: newItems });
  };

  const handleAddItem = () => {
    const safeItems = formData.items || [];
    setFormData({
      ...formData,
      items: [...safeItems, { inventory_brand_id: '', inventory_id: '', item: '', itemDescription: '—', quantity: '1', amount: 0 }]
    });
  };

  const handleRemoveItem = (index: number) => {
    const safeItems = formData.items || [];
    if (safeItems.length > 1) {
      const newItems = safeItems.filter((_: any, i: number) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  if (!isOpen || !formData) return null;

  const safeItems = formData.items || [];
  const safeStatus = formData.status || 'Preparing';
  const safePayment = formData.paymentMethod || 'Cash';
  const isPreparing = safeStatus.trim().toLowerCase() === 'preparing';

  const totalQty = safeItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
  const totalAmt = safeItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);

  const customerNameHasError = () => submitAttempted && !formData.customerName?.trim();
  const addressHasError = () => submitAttempted && !formData.address?.trim();

  const handleSubmit = () => {
    setSubmitAttempted(true);
    setSubmitError('');
    if (!formData.customerName?.trim()) { setSubmitError('Customer name is required.'); return; }
    if (!formData.address?.trim()) { setSubmitError('Delivery address is required.'); return; }
    if (!hasChanges()) { setSubmitError('No changes detected. Please modify at least one field before updating.'); return; }
    setSubmitError('');
    onSave({ ...formData, totalQty, totalAmt });
  };

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}>
      <div className={s.modalContent} style={{ width: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>

        {/* HEADER */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem', margin: '0 0 4px 0' }}>Edit Order Details</h2>
            <p className={s.subText} style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Update customer information, items, and fulfillment status.</p>
          </div>
          <LuX onClick={handleCancelClick} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666', fontSize: '1.5rem' }} />
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>

          {/* Order Summary Bar */}
          <div style={{ backgroundColor: '#eff6ff', padding: '15px 20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #dbeafe', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order ID</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>{formData.id}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Items</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>{totalQty}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>₱{totalAmt.toLocaleString()}</span>
            </div>
          </div>

          {/* Customer Details */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Customer Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE, color: customerNameHasError() ? '#dc2626' : '#6b7280' }}>
                  Customer Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className={s.cleanInput}
                  style={customerNameHasError() ? FIELD_ERROR_STYLE : {}}
                  value={formData.customerName || ''}
                  onChange={(e) => { setSubmitError(''); setFormData({...formData, customerName: e.target.value}); }}
                />
                {customerNameHasError() && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Customer name is required.</p>
                )}
              </div>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Contact Number</label>
                <input className={s.cleanInput} value={formData.contact || ''} onChange={(e) => setFormData({...formData, contact: e.target.value})} />
              </div>
            </div>
            <div className={s.formGroupFull}>
              <label style={{ ...LABEL_STYLE, color: addressHasError() ? '#dc2626' : '#6b7280' }}>
                Delivery Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className={s.cleanInput}
                style={addressHasError() ? FIELD_ERROR_STYLE : {}}
                value={formData.address || ''}
                onChange={(e) => { setSubmitError(''); setFormData({...formData, address: e.target.value}); }}
              />
              {addressHasError() && (
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Delivery address is required.</p>
              )}
            </div>
          </div>

          {/* Fulfillment & Payment */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Fulfillment & Payment</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Status</label>
                <select className={s.cleanInput} value={safeStatus.trim()} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                  {statuses.length === 0 && <option value={safeStatus.trim()}>{safeStatus.trim()}</option>}
                  {statuses.map((st: any) => (
                    <option key={st.status_id} value={st.status_name.trim()}>{st.status_name.trim()}</option>
                  ))}
                </select>
              </div>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Payment Method</label>
                <select className={s.cleanInput} value={safePayment.trim()} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}>
                  {paymentMethods.length === 0 && <option value={safePayment.trim()}>{safePayment.trim()}</option>}
                  {paymentMethods.map((pm: any) => (
                    <option key={pm.status_id} value={pm.status_name.trim()}>{pm.status_name.trim()}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Order Items</h4>

            {safeItems.map((item: any, index: number) => (
              <div key={index} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: index < safeItems.length - 1 ? '1px dashed #e5e7eb' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>Item {index + 1}</span>
                  {isPreparing && safeItems.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.6fr 1fr', gap: '10px' }}>

                  {/* Item Name */}
                  <div className={s.formGroup} style={{ position: 'relative', minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Item Name <span style={{ color: '#ef4444' }}>*</span></span>
                      <LuSearch size={12} color="#94a3b8" />
                    </label>
                    <input
                      type="text"
                      className={s.cleanInput}
                      value={item.item || ''}
                      onChange={(e) => handleItemTextChange(index, e.target.value)}
                      onFocus={() => setActiveSearchIndex(index)}
                      onBlur={() => setTimeout(() => { if (activeSearchIndex === index) setActiveSearchIndex(null); }, 200)}
                      disabled={!isPreparing}
                      placeholder="Search items..."
                      autoComplete="off"
                      style={{
                        height: '38px', padding: '8px 12px', fontSize: '0.9rem',
                        border: (!item.inventory_brand_id && item.item.length > 0) ? '1px solid #f87171' : '1px solid #d1d5db',
                        backgroundColor: (!item.inventory_brand_id && item.item.length > 0) ? '#fff5f5' : '#fff'
                      }}
                    />
                    {activeSearchIndex === index && isPreparing && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '250px', overflowY: 'auto', marginTop: '4px' }}>
                        {searchableItems
                          .filter((entry: any) =>
                            entry.item_name.toLowerCase().includes((item.item || '').toLowerCase()) ||
                            (entry.item_description && entry.item_description.toLowerCase().includes((item.item || '').toLowerCase()))
                          )
                          .map((entry: any, i: number) => (
                            <div
                              key={entry.inventory_brand_id ?? `${entry.inventory_id}-${entry.brand_id}-${i}`}
                              onMouseDown={() => handleItemSelect(index, entry)}
                              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                            >
                              <div style={{ overflow: 'hidden', paddingRight: '10px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {entry.item_name} &mdash; {entry.brand_name} ({entry.uom})
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Desc: {entry.item_description || 'None'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>₱{entry.price.toLocaleString()}</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Stock: {entry.qty} {entry.uom || ''}</div>
                              </div>
                            </div>
                          ))
                        }
                        {searchableItems.filter((entry: any) =>
                          entry.item_name.toLowerCase().includes((item.item || '').toLowerCase())
                        ).length === 0 && item.item.length > 0 && (
                          <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#ef4444', textAlign: 'center', backgroundColor: '#fef2f2' }}>
                            No available items found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Brand */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Brand</label>
                    <div style={{ padding: '0 12px', height: '38px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9rem', display: 'block', lineHeight: '36px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '100%', backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                      {item.brand_name || '—'}
                    </div>
                  </div>

                  {/* Description */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Description</label>
                    <div style={{ padding: '0 12px', height: '38px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9rem', display: 'block', lineHeight: '36px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '100%', backgroundColor: (!item.inventory_brand_id && item.item.length > 0) ? '#fff5f5' : '#f3f4f6', color: (!item.inventory_brand_id && item.item.length > 0) ? '#ef4444' : '#6b7280' }}>
                      {item.itemDescription}
                    </div>
                  </div>

                  {/* Qty */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Qty <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      className={s.cleanInput}
                      value={item.quantity || ''}
                      onChange={(e) => handleQtyChange(index, e.target.value)}
                      disabled={!isPreparing}
                      style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', width: '100%' }}
                    />
                  </div>

                  {/* Amount */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Amount (₱)</label>
                    <div style={{ padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                      {Number(item.amount).toLocaleString()}
                    </div>
                  </div>

                </div>
              </div>
            ))}

            {isPreparing && (
              <button type="button" onClick={handleAddItem} style={{ width: '100%', padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <LuPlus /> Add Another Item
              </button>
            )}
          </div>

        </div>

        {/* FOOTER */}
        <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', marginTop: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {submitError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>⚠</span> {submitError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className={s.cancelBtn} onClick={handleCancelClick}>Cancel</button>
            <button className={s.saveBtn} onClick={handleSubmit}>Save Changes</button>
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

    </div>
  );
};

export default OrderEditModal;