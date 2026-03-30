/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import styles from "@/css/order.module.css";
import { LuPlus, LuTrash2, LuX, LuMapPin, LuSearch } from "react-icons/lu";

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: any) => void;
  statuses: any[];
  paymentMethods: any[];
  inventoryItems?: any[];
}

const INITIAL_CUSTOMER = {
  customerName: '',
  contactNumber: '',
  deliveryAddress: ''
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  statuses = [],
  paymentMethods = [],
  inventoryItems = []
}) => {
  const s = styles as Record<string, string>;

  const activeInventory = (inventoryItems || []).filter((inv: any) => !inv.is_archived);

  const searchableItems = activeInventory.flatMap((inv: any) =>
    (inv.brands || [])
      .filter((b: any) => Number(b.qty) > 0)
      .map((b: any) => ({
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

  const getDefaultStatus = () => {
    if (!statuses || statuses.length === 0) return 'Preparing';
    const match = statuses.find(st => st.status_name.trim().toLowerCase() === 'preparing');
    return match ? match.status_name.trim() : statuses[0].status_name.trim();
  };

  const getDefaultPayment = () => {
    if (!paymentMethods || paymentMethods.length === 0) return 'Cash';
    const match = paymentMethods.find(pm => pm.status_name.trim().toLowerCase() === 'cash');
    return match ? match.status_name.trim() : paymentMethods[0].status_name.trim();
  };

  const [customerData, setCustomerData] = useState({ ...INITIAL_CUSTOMER });
  const [items, setItems] = useState<any[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');


  useEffect(() => {
    if (isOpen) {
      setCustomerData({ ...INITIAL_CUSTOMER });
      setItems([{
        inventory_id: '',
        brand_id: '',
        brand_name: '—',
        item: '',
        itemDescription: '—',
        quantity: '1',
        amount: 0,
        orderStatus: getDefaultStatus(),
        paymentMethod: getDefaultPayment()
      }]);
      setShowCancelConfirm(false);
      setSubmitAttempted(false);
      setSubmitError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && (statuses.length > 0 || paymentMethods.length > 0)) {
      setItems(prev => prev.map(item => ({
        ...item,
        orderStatus: item.orderStatus || getDefaultStatus(),
        paymentMethod: item.paymentMethod || getDefaultPayment()
      })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, paymentMethods]);

  const isFormDirty = (): boolean => {
    const hasCustomerData =
      customerData.customerName.trim() ||
      customerData.contactNumber.trim() ||
      customerData.deliveryAddress.trim();
    const hasItemData = items.some(item =>
      item.item?.trim() ||
      (item.quantity && String(item.quantity) !== '1') ||
      item.amount > 0
    );
    return !!(hasCustomerData || hasItemData);
  };

  const handleCancelClick = () => {
    if (isFormDirty()) setShowCancelConfirm(true);
    else onClose();
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    onClose();
  };

  const handleItemSelect = (index: number, entry: any) => {
    const newItems = [...items];
    const currentQty = Number(newItems[index].quantity) || 1;
    newItems[index] = {
      ...newItems[index],
      inventory_id: entry.inventory_id,
      brand_id: entry.brand_id,
      brand_name: entry.brand_name,
      item: entry.item_name,
      itemDescription: entry.item_description || 'No Description',
      uom: entry.uom || '',
      quantity: currentQty,
      amount: currentQty * entry.price
    };
    setItems(newItems);
    setActiveSearchIndex(null);
  };

  const handleItemTextChange = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index].item = text;
    const match = searchableItems.find((s: any) => s.item_name.toLowerCase().trim() === text.toLowerCase().trim());
    if (match) {
      newItems[index].inventory_id = match.inventory_id;
      newItems[index].brand_id = match.brand_id;
      newItems[index].brand_name = match.brand_name;
      newItems[index].itemDescription = match.item_description || 'No Description';
      newItems[index].uom = match.uom || '';
      const qtyNum = Number(newItems[index].quantity) || 1;
      newItems[index].amount = qtyNum * match.price;
    } else {
      newItems[index].inventory_id = '';
      newItems[index].brand_id = '';
      newItems[index].brand_name = '—';
      newItems[index].itemDescription = '—';
      newItems[index].amount = 0;
    }
    setItems(newItems);
  };

  const handleQtyChange = (index: number, newQty: string) => {
    const newItems = [...items];
    const qtyNum = Number(newQty) || 0;
    const entry = searchableItems.find((s: any) =>
      String(s.inventory_id) === String(newItems[index].inventory_id) &&
      String(s.brand_id) === String(newItems[index].brand_id)
    );
    const existingPrice = (Number(newItems[index].amount) / (Number(newItems[index].quantity) || 1)) || 0;
    const price = entry ? entry.price : existingPrice;
    newItems[index] = { ...newItems[index], quantity: newQty, amount: price * qtyNum };
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, {
      inventory_id: '',
      brand_id: '',
      brand_name: '—',
      item: '',
      itemDescription: '—',
      quantity: '1',
      amount: 0,
      orderStatus: getDefaultStatus(),
      paymentMethod: getDefaultPayment()
    }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitError('');

    // Required field checks
    if (!customerData.customerName.trim()) {
      setSubmitError('Customer name is required.');
      return;
    }
    if (!customerData.deliveryAddress.trim()) {
      setSubmitError('Delivery address is required.');
      return;
    }
    // Check at least one item has a valid inventory item selected
    const hasValidItem = items.some(item => item.inventory_id && item.item?.trim());
    if (!hasValidItem) {
      setSubmitError('Please select at least one valid item before saving.');
      return;
    }

    const finalItems = items.map(item => ({
      ...item,
      orderStatus: item.orderStatus || getDefaultStatus(),
      paymentMethod: item.paymentMethod || getDefaultPayment()
    }));
    onSave({ ...customerData, items: finalItems });
  };

  if (!isOpen) return null;

  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalAmt = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // ── ERROR HELPERS ──
  const customerNameHasError = () => submitAttempted && !customerData.customerName.trim();
  const addressHasError = () => submitAttempted && !customerData.deliveryAddress.trim();
  const itemHasError = (index: number) => submitAttempted && !items[index].inventory_id && items[index].item?.trim();

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1000 }}>
      <div className={s.modalContent} style={{ maxHeight: '95vh', width: '900px', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden' }}>

        {/* --- HEADER --- */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', flexShrink: 0 }}>
          <div>
            <h2 className={s.headerTitle}>New Order Information</h2>
            <p className={s.headerSubtext}>Enter customer details and add multiple items to this order.</p>
          </div>
          <LuX className={s.closeIcon} onClick={handleCancelClick} />
        </div>

        <form onSubmit={handleSubmit} className={s.orderForm}>

          {/* --- CUSTOMER SECTION (resizable) --- */}
          <div className={s.customerSection}>
            <div className={s.orderSummaryBar}>
              <div>
                <span className={s.summaryLabel}>Order ID</span>
                <span className={s.summaryValue}>-</span>
              </div>
              <div>
                <span className={s.summaryLabel}>Total Items</span>
                <span className={s.summaryValue}>{totalQty}</span>
              </div>
              <div>
                <span className={s.summaryLabel}>Total Amount</span>
                <span className={s.summaryValue}>₱ {totalAmt.toLocaleString()}</span>
              </div>
            </div>

            <h4 className={s.customerSectionTitle}>
              <LuMapPin size={16} /> Customer & Delivery Details
            </h4>

            <div className={s.customerFormGrid}>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE, color: customerNameHasError() ? '#dc2626' : '#6b7280' }}>
                  Customer Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className={s.cleanInput}
                  style={customerNameHasError() ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}}
                  value={customerData.customerName}
                  onChange={(e) => { setSubmitError(''); setCustomerData({ ...customerData, customerName: e.target.value }); }}
                  placeholder="Full Name"
                />
                {customerNameHasError() && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Customer name is required.</p>
                )}
              </div>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Contact Number</label>
                <input className={s.cleanInput} value={customerData.contactNumber} onChange={(e) => setCustomerData({ ...customerData, contactNumber: e.target.value })} placeholder="09XXXXXXXXX" />
              </div>
            </div>

            <div className={s.formGroupFull}>
              <label style={{ ...LABEL_STYLE, color: addressHasError() ? '#dc2626' : '#6b7280' }}>
                Delivery Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className={s.cleanInput}
                style={addressHasError() ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}}
                value={customerData.deliveryAddress}
                onChange={(e) => { setSubmitError(''); setCustomerData({ ...customerData, deliveryAddress: e.target.value }); }}
                placeholder="Street, Barangay, City"
              />
              {addressHasError() && (
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Delivery address is required.</p>
              )}
            </div>
          </div>


          {/* --- ITEM LIST --- */}
          <div className={s.itemList}>
            {items.map((item, index) => (
              <div key={index} className={s.itemCard}>

                <div className={s.itemCardHeader}>
                  <div className={s.itemCardTitle}>
                    <div className={s.itemCardBadge}>{index + 1}</div>
                    Item Details
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} className={s.itemRemoveBtn}>
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                <div className={s.itemTopGrid} style={{ gridTemplateColumns: '2fr 1fr 1.5fr' }}>

                  {/* Search field */}
                  <div className={s.searchFieldWrapper}>
                    <label style={{ ...LABEL_STYLE, color: itemHasError(index) ? '#dc2626' : '#6b7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Item Name <span style={{ color: '#ef4444' }}>*</span></span>
                      <LuSearch size={12} color="#94a3b8" />
                    </label>
                    <input
                      type="text"
                      value={item.item || ''}
                      onChange={(e) => handleItemTextChange(index, e.target.value)}
                      onFocus={() => setActiveSearchIndex(index)}
                      onBlur={() => setTimeout(() => { if (activeSearchIndex === index) setActiveSearchIndex(null); }, 200)}
                      placeholder="Search items..."
                      autoComplete="off"
                      className={(!item.inventory_id && item.item.length > 0) ? s.searchInputInvalid : s.searchInputValid}
                      style={itemHasError(index) ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}}
                    />
                    {itemHasError(index) && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Please select a valid item from the list.</p>
                    )}

                    {activeSearchIndex === index && (
                      <div className={s.searchDropdown}>
                        {searchableItems
                          .filter((entry: any) =>
                            entry.item_name.toLowerCase().includes((item.item || '').toLowerCase()) ||
                            (entry.item_description && entry.item_description.toLowerCase().includes((item.item || '').toLowerCase()))
                          )
                          .map((entry: any, i: number) => (
                            <div
                              key={`${entry.inventory_id}-${entry.brand_id}-${i}`}
                              onMouseDown={() => handleItemSelect(index, entry)}
                              className={s.searchDropdownItem}
                            >
                              <div className={s.searchDropdownItemLeft}>
                                <div className={s.searchDropdownItemName}>{entry.item_name}</div>
                                <div className={s.searchDropdownItemDesc}>
                                  {entry.brand_name !== '—' ? entry.brand_name : (entry.item_description || 'No desc')}
                                </div>
                              </div>
                              <div className={s.searchDropdownItemRight}>
                                <div className={s.searchDropdownItemPrice}>₱{entry.price.toLocaleString()}</div>
                                <div className={s.searchDropdownItemQty}>Avail: {entry.qty} {entry.uom || ''}</div>
                              </div>
                            </div>
                          ))
                        }
                        {searchableItems.filter((entry: any) =>
                          entry.item_name.toLowerCase().includes((item.item || '').toLowerCase())
                        ).length === 0 && item.item.length > 0 && (
                          <div className={s.outOfStockNotice}>No available items found.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Brand */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Brand</label>
                    <div className={s.descFieldValid}>{item.brand_name || '—'}</div>
                  </div>

                  {/* Description */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Description</label>
                    <div className={(!item.inventory_id && item.item.length > 0) ? s.descFieldInvalid : s.descFieldValid}>
                      {item.itemDescription}
                    </div>
                  </div>
                </div>

                <div className={s.itemBottomGrid}>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Quantity <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="number" className={s.cleanInput} value={item.quantity || ''} onChange={(e) => handleQtyChange(index, e.target.value)} style={{ height: '38px' }} />
                  </div>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Amount (₱)</label>
                    <div className={s.amountField}>{Number(item.amount).toLocaleString()}</div>
                  </div>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Status <span style={{ color: '#ef4444' }}>*</span></label>
                    <select className={s.cleanInput} value={item.orderStatus || getDefaultStatus()} onChange={(e) => handleItemChange(index, 'orderStatus', e.target.value)} style={{ height: '38px' }}>
                      {statuses.length === 0 && <option value="Preparing">Preparing</option>}
                      {statuses.map((st: any) => (
                        <option key={st.status_id} value={st.status_name.trim()}>{st.status_name.trim()}</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Payment Method <span style={{ color: '#ef4444' }}>*</span></label>
                    <select className={s.cleanInput} value={item.paymentMethod || getDefaultPayment()} onChange={(e) => handleItemChange(index, 'paymentMethod', e.target.value)} style={{ height: '38px' }}>
                      {paymentMethods.length === 0 && <option value="Cash">Cash</option>}
                      {paymentMethods.map((pm: any) => (
                        <option key={pm.status_id} value={pm.status_name.trim()}>{pm.status_name.trim()}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            ))}

            <button type="button" onClick={handleAddItem} className={s.addItemBtn}>
              <LuPlus /> Add Another Item
            </button>
          </div>

          {/* --- FOOTER --- */}
          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {submitError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                <span>⚠</span> {submitError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={handleCancelClick} className={s.cancelBtn}>Cancel</button>
              <button type="submit" className={s.saveBtn}>Save Order</button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Cancel Confirmation Dialog ── */}
      {showCancelConfirm && (
        <div className={s.confirmOverlay} onClick={() => setShowCancelConfirm(false)}>
          <div className={s.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={s.confirmIconWrap}>
              <div className={s.confirmIcon}>⚠️</div>
            </div>
            <div className={s.confirmTextWrap}>
              <p className={s.confirmTitle}>Discard Changes?</p>
              <p className={s.confirmSubtext}>All entered information will be lost.</p>
            </div>
            <div className={s.confirmButtons}>
              <button className={s.keepEditingBtn} onClick={() => setShowCancelConfirm(false)}>Keep Editing</button>
              <button className={s.discardBtn} onClick={handleConfirmCancel}>Yes, Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddOrderModal;