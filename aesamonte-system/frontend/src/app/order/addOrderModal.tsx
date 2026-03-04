/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
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

  // THE FIX: Filter out archived items immediately
  const activeInventory = (inventoryItems || []).filter((inv: any) => !inv.is_archived);

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

  useEffect(() => {
    if (isOpen) {
      setCustomerData({ ...INITIAL_CUSTOMER });
      setItems([{ 
        inventory_id: '',
        item: '', 
        itemDescription: '—', 
        quantity: '1', 
        amount: 0,
        orderStatus: getDefaultStatus(),
        paymentMethod: getDefaultPayment()
      }]);
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

  const handleItemSelect = (index: number, selectedInvId: string) => {
    const newItems = [...items];
    const selectedInv = activeInventory.find((inv: any) => String(inv.id) === selectedInvId);
    
    if (selectedInv) {
      const currentQty = Number(newItems[index].quantity) || 1;
      newItems[index] = {
        ...newItems[index],
        inventory_id: selectedInv.id,
        item: selectedInv.item_name, 
        itemDescription: selectedInv.item_description || 'No Description',
        quantity: currentQty,
        amount: currentQty * Number(selectedInv.price) 
      };
    }
    setItems(newItems);
    setActiveSearchIndex(null); 
  };

  const handleItemTextChange = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index].item = text;
    
    const match = activeInventory.find((inv: any) => inv.item_name.toLowerCase().trim() === text.toLowerCase().trim());
    
    if (match && Number(match.qty) > 0) {
        newItems[index].inventory_id = match.id;
        newItems[index].itemDescription = match.item_description || 'No Description';
        const qtyNum = Number(newItems[index].quantity) || 1;
        newItems[index].amount = qtyNum * Number(match.price);
    } else if (match && Number(match.qty) <= 0) {
        newItems[index].inventory_id = '';
        newItems[index].itemDescription = 'Out of Stock (Please remove)';
        newItems[index].amount = 0;
    } else {
        newItems[index].inventory_id = '';
        newItems[index].itemDescription = '—';
        newItems[index].amount = 0;
    }
    
    setItems(newItems);
  };

  const handleQtyChange = (index: number, newQty: string) => {
    const newItems = [...items];
    const qtyNum = Number(newQty) || 0;
    
    const invItem = activeInventory.find((inv: any) => String(inv.id) === String(newItems[index].inventory_id));
    const existingPrice = (Number(newItems[index].amount) / (Number(newItems[index].quantity) || 1)) || 0;
    const price = invItem ? Number(invItem.price) : existingPrice;

    newItems[index] = { 
      ...newItems[index], 
      quantity: newQty,
      amount: price * qtyNum 
    };
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
        
        <div className={s.modalHeader} style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className={s.headerTitle} style={{ fontSize: '1.25rem', marginBottom: '4px', fontWeight: 700 }}>New Order Information</h2>
            <p className={s.subText} style={{ color: '#666', fontSize: '0.85rem' }}>Enter customer details and add multiple items to this order.</p>
          </div>
          <LuX onClick={onClose} style={{ cursor: 'pointer', fontSize: '1.5rem', color: '#666' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: '#f9fafb' }}>
          
          <div style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
              
              <div style={{ backgroundColor: '#eff6ff', padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #dbeafe', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order ID</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>-</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Items</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>{totalQty}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>₱ {totalAmt.toLocaleString()}</span>
                </div>
              </div>

              <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LuMapPin size={16} /> Customer & Delivery Details
              </h4>
              <div className={s.formGridTwo} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className={s.formGroup}>
                  <label className={s.miniLabel}>Customer Name</label>
                  <input 
                    className={s.cleanInput}
                    value={customerData.customerName}
                    onChange={(e) => setCustomerData({...customerData, customerName: e.target.value})}
                    placeholder="Full Name"
                    required
                  />
                </div>
                <div className={s.formGroup}>
                  <label className={s.miniLabel}>Contact Number</label>
                  <input className={s.cleanInput} value={customerData.contactNumber} onChange={(e) => setCustomerData({...customerData, contactNumber: e.target.value})} placeholder="09XXXXXXXXX" />
                </div>
              </div>
              <div className={s.formGroupFull}>
                <label className={s.miniLabel}>Delivery Address</label>
                <input className={s.cleanInput} value={customerData.deliveryAddress} onChange={(e) => setCustomerData({...customerData, deliveryAddress: e.target.value})} placeholder="Street, Barangay, City" required />
              </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>{index + 1}</div>
                    Item Details
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '15px', marginBottom: '15px' }}>
                  
                  <div className={s.formGroup} style={{ position: 'relative', minWidth: 0 }}>
                     <label className={s.miniLabel} style={{ display: 'flex', justifyContent: 'space-between' }}>
                       <span>Item Name</span>
                       <LuSearch size={12} color="#94a3b8" />
                     </label>
                     <input 
                       type="text"
                       className={s.cleanInput} 
                       value={item.item || ''} 
                       onChange={(e) => handleItemTextChange(index, e.target.value)}
                       onFocus={() => setActiveSearchIndex(index)}
                       onBlur={() => setTimeout(() => { if (activeSearchIndex === index) setActiveSearchIndex(null); }, 200)}
                       placeholder="Search items..."
                       autoComplete="off"
                       style={{ 
                         height: '38px', padding: '8px 12px', fontSize: '0.9rem', width: '100%',
                         border: (!item.inventory_id && item.item.length > 0) ? '1px solid #ef4444' : '1px solid #d1d5db',
                         backgroundColor: (!item.inventory_id && item.item.length > 0) ? '#fef2f2' : '#fff'
                       }}
                       required
                     />
                     
                     {activeSearchIndex === index && (
                       <div style={{
                         position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                         backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
                         boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxHeight: '250px', overflowY: 'auto',
                         marginTop: '4px'
                       }}>
                         {/* THE FIX: Replaced all inventoryItems with activeInventory */}
                         {activeInventory
                           .filter((inv: any) => Number(inv.qty) > 0)
                           .filter((inv: any) => 
                             inv.item_name.toLowerCase().includes((item.item || '').toLowerCase()) ||
                             (inv.item_description && inv.item_description.toLowerCase().includes((item.item || '').toLowerCase()))
                           )
                           .map((inv: any) => (
                             <div
                               key={inv.id}
                               onMouseDown={() => handleItemSelect(index, String(inv.id))} 
                               style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                               onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                               onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                             >
                               <div style={{ overflow: 'hidden', paddingRight: '10px' }}>
                                 <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.item_name}</div>
                                 <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.item_description || 'No desc'}</div>
                               </div>
                               <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                 <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>₱{inv.price}</div>
                                 <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Avail: {inv.qty}</div>
                               </div>
                             </div>
                           ))
                         }
                         
                         {/* THE FIX: Replaced all inventoryItems with activeInventory */}
                         {activeInventory.filter((inv: any) => Number(inv.qty) <= 0 && inv.item_name.toLowerCase().includes((item.item || '').toLowerCase())).length > 0 && (
                            <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#ef4444', textAlign: 'center', backgroundColor: '#fef2f2' }}>
                               Some matches are currently Out of Stock.
                            </div>
                         )}
                       </div>
                     )}
                  </div>

                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                     <label className={s.miniLabel}>Description</label>
                     <div style={{ 
                           padding: '0 12px', height: '38px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9rem', 
                           display: 'block', lineHeight: '36px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '100%',            
                           backgroundColor: (!item.inventory_id && item.item.length > 0) ? '#fef2f2' : '#f3f4f6',
                           color: (!item.inventory_id && item.item.length > 0) ? '#ef4444' : '#6b7280'
                         }}>
                        {item.itemDescription}
                     </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                  
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                     <label className={s.miniLabel}>Quantity</label>
                     <input 
                       type="number" 
                       className={s.cleanInput} 
                       value={item.quantity || ''} 
                       onChange={(e) => handleQtyChange(index, e.target.value)} 
                       style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', width: '100%' }}
                       required 
                     />
                  </div>

                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                     <label className={s.miniLabel}>Amount (₱)</label>
                     <div style={{ padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                        {Number(item.amount).toLocaleString()}
                     </div>
                  </div>
                  
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Status</label>
                    <select className={s.cleanInput} value={item.orderStatus || getDefaultStatus()} onChange={(e) => handleItemChange(index, 'orderStatus', e.target.value)} style={{ height: '38px' }} required>
                      {statuses.length === 0 && <option value="Preparing">Preparing</option>}
                      {statuses.map((st: any) => (
                        <option key={st.status_id} value={st.status_name.trim()}>
                          {st.status_name.trim()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Payment Method</label>
                    <select className={s.cleanInput} value={item.paymentMethod || getDefaultPayment()} onChange={(e) => handleItemChange(index, 'paymentMethod', e.target.value)} style={{ height: '38px' }} required>
                      {paymentMethods.length === 0 && <option value="Cash">Cash</option>}
                      {paymentMethods.map((pm: any) => (
                        <option key={pm.status_id} value={pm.status_name.trim()}>
                          {pm.status_name.trim()}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>
            ))}
            
            <button type="button" onClick={handleAddItem} style={{ width: '100%', padding: '12px', border: '2px dashed #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LuPlus /> Add Another Item
            </button>
          </div>

          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className={s.cancelBtn}>Cancel</button>
            <button type="submit" className={s.saveBtn}>Save Order</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOrderModal;