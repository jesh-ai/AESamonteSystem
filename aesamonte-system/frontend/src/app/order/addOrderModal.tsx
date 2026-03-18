/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  // Flatten to one entry per brand variant so each brand is selectable separately
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

  // ── DRAG RESIZER STATE ──
  const [customerHeight, setCustomerHeight] = useState<number | 'auto'>('auto');
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const customerSectionRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = customerSectionRef.current?.offsetHeight ?? 300;
    setCustomerHeight(dragStartHeight.current);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientY - dragStartY.current;
      const newHeight = Math.min(Math.max(dragStartHeight.current + delta, 120), 480);
      setCustomerHeight(newHeight);
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
      setCustomerHeight('auto');
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

  // ── Check if form has any user-entered data ──
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
    if (isFormDirty()) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
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
          <div
            ref={customerSectionRef}
            className={s.customerSection}
            style={{
              height: customerHeight === 'auto' ? 'auto' : `${customerHeight}px`,
              overflow: customerHeight === 'auto' ? 'visible' : 'hidden',
            }}
          >
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
                <label className={s.miniLabel}>Customer Name</label>
                <input className={s.cleanInput} value={customerData.customerName} onChange={(e) => setCustomerData({ ...customerData, customerName: e.target.value })} placeholder="Full Name" required />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Contact Number</label>
                <input className={s.cleanInput} value={customerData.contactNumber} onChange={(e) => setCustomerData({ ...customerData, contactNumber: e.target.value })} placeholder="09XXXXXXXXX" />
              </div>
            </div>

            <div className={s.formGroupFull}>
              <label className={s.miniLabel}>Delivery Address</label>
              <input className={s.cleanInput} value={customerData.deliveryAddress} onChange={(e) => setCustomerData({ ...customerData, deliveryAddress: e.target.value })} placeholder="Street, Barangay, City" required />
            </div>
          </div>

          {/* ── DRAG HANDLE ── */}
          <div className={s.dragHandle} onMouseDown={handleMouseDown} title="Drag to resize">
            <div className={s.dragDots}>
              {[0, 1, 2].map(i => <div key={i} className={s.dragDot} />)}
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
                    <label className={`${s.miniLabel} ${s.searchLabelRow}`}>
                      <span>Item Name</span>
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
                      required
                    />

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
                    <label className={s.miniLabel}>Brand</label>
                    <div className={s.descFieldValid}>{item.brand_name || '—'}</div>
                  </div>

                  {/* Description */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label className={s.miniLabel}>Description</label>
                    <div className={(!item.inventory_id && item.item.length > 0) ? s.descFieldInvalid : s.descFieldValid}>
                      {item.itemDescription}
                    </div>
                  </div>
                </div>

                <div className={s.itemBottomGrid}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Quantity</label>
                    <input type="number" className={s.cleanInput} value={item.quantity || ''} onChange={(e) => handleQtyChange(index, e.target.value)} style={{ height: '38px' }} required />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Amount (₱)</label>
                    <div className={s.amountField}>{Number(item.amount).toLocaleString()}</div>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Status</label>
                    <select className={s.cleanInput} value={item.orderStatus || getDefaultStatus()} onChange={(e) => handleItemChange(index, 'orderStatus', e.target.value)} style={{ height: '38px' }} required>
                      {statuses.length === 0 && <option value="Preparing">Preparing</option>}
                      {statuses.map((st: any) => (
                        <option key={st.status_id} value={st.status_name.trim()}>{st.status_name.trim()}</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Payment Method</label>
                    <select className={s.cleanInput} value={item.paymentMethod || getDefaultPayment()} onChange={(e) => handleItemChange(index, 'paymentMethod', e.target.value)} style={{ height: '38px' }} required>
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
          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0 }}>
            <button type="button" onClick={handleCancelClick} className={s.cancelBtn}>Cancel</button>
            <button type="submit" className={s.saveBtn}>Save Order</button>
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
              <p className={s.confirmSubtext}>
                You have unsaved data in this form. If you cancel now, all entered information will be lost.
              </p>
            </div>
            <div className={s.confirmButtons}>
              <button className={s.keepEditingBtn} onClick={() => setShowCancelConfirm(false)}>
                Keep Editing
              </button>
              <button className={s.discardBtn} onClick={handleConfirmCancel}>
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddOrderModal;