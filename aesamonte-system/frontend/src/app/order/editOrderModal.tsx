/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css"; 
import { LuX, LuPlus, LuTrash2, LuSearch } from "react-icons/lu";

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any; 
  onSave: (updatedOrder: any) => void;
  statuses?: any[];       
  paymentMethods?: any[]; 
  inventoryItems?: any[]; 
}

const OrderEditModal = ({ isOpen, onClose, orderData, onSave, statuses = [], paymentMethods = [], inventoryItems = [] }: OrderEditModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData] = useState<any>(null);
  
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  useEffect(() => {
    if (orderData) {
      const initialItems = orderData.items && orderData.items.length > 0 
        ? orderData.items.map((i: any) => ({
            inventory_id: i.inventory_id,
            item: i.item_name || '',
            itemDescription: i.description || '—', 
            quantity: i.order_quantity || '',
            amount: i.amount || 0 
          }))
        : [{ inventory_id: '', item: '', itemDescription: '—', quantity: '1', amount: 0 }];

      setFormData({
        id: orderData.id,
        customerName: orderData.name || orderData.customer, 
        contact: orderData.contact || '',
        address: orderData.address || '',
        status: orderData.status || 'Preparing',
        paymentMethod: orderData.paymentMethod || 'Cash',
        items: initialItems
      });
    }
  }, [orderData]);

  const handleItemSelect = (index: number, selectedInvId: string) => {
    const safeItems = formData.items || [];
    const newItems = [...safeItems];
    
    const selectedInv = inventoryItems.find((inv: any) => String(inv.id) === selectedInvId);
    
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
    setFormData({ ...formData, items: newItems });
    setActiveSearchIndex(null); 
  };

  const handleItemTextChange = (index: number, text: string) => {
    const safeItems = formData.items || [];
    const newItems = [...safeItems];
    newItems[index].item = text;
    
    const match = inventoryItems.find((inv: any) => inv.item_name.toLowerCase().trim() === text.toLowerCase().trim());
    
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
    
    setFormData({ ...formData, items: newItems });
  };

  const handleQtyChange = (index: number, newQty: string) => {
    const safeItems = formData.items || [];
    const newItems = [...safeItems];
    const qtyNum = Number(newQty) || 0;
    
    const invItem = inventoryItems.find((inv: any) => String(inv.id) === String(newItems[index].inventory_id));
    const existingPrice = (Number(newItems[index].amount) / (Number(newItems[index].quantity) || 1)) || 0;
    const price = invItem ? Number(invItem.price) : existingPrice;

    newItems[index] = { 
      ...newItems[index], 
      quantity: newQty,
      amount: price * qtyNum 
    };
    setFormData({ ...formData, items: newItems });
  };

  const handleAddItem = () => {
    const safeItems = formData.items || [];
    setFormData({
      ...formData,
      items: [...safeItems, { inventory_id: '', item: '', itemDescription: '—', quantity: '1', amount: 0 }]
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

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}> 
      <div className={s.modalContent} style={{ width: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        
        {/* --- HEADER --- */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
           <div className={s.modalTitleGroup}>
             <h2 className={s.title} style={{ fontSize: '1.25rem', margin: '0 0 4px 0' }}>Edit Order Details</h2>
             <p className={s.subText} style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Update customer information, items, and fulfillment status.</p>
           </div>
           <LuX onClick={onClose} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666', fontSize: '1.5rem' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>
          
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

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Customer Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Customer Name</label>
                <input className={s.cleanInput} value={formData.customerName || ''} onChange={(e) => setFormData({...formData, customerName: e.target.value})} />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Contact Number</label>
                <input className={s.cleanInput} value={formData.contact || ''} onChange={(e) => setFormData({...formData, contact: e.target.value})} />
              </div>
            </div>
            <div className={s.formGroupFull}>
              <label className={s.miniLabel}>Delivery Address</label>
              <input className={s.cleanInput} value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Fulfillment & Payment</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Status</label>
                <select className={s.cleanInput} value={safeStatus.trim()} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                  {statuses.length === 0 && <option value={safeStatus.trim()}>{safeStatus.trim()}</option>}
                  {statuses.map((st: any) => (
                    <option key={st.status_id} value={st.status_name.trim()}>{st.status_name.trim()}</option>
                  ))}
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Payment Method</label>
                <select className={s.cleanInput} value={safePayment.trim()} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}>
                  {paymentMethods.length === 0 && <option value={safePayment.trim()}>{safePayment.trim()}</option>}
                  {paymentMethods.map((pm: any) => (
                    <option key={pm.status_id} value={pm.status_name.trim()}>{pm.status_name.trim()}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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

                 {/* --- THE LAYOUT FIX: Adjusted grid fractions --- */}
                 <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 0.6fr 1fr', gap: '10px' }}>
                   
                   {/* ADDED minWidth: 0 to force CSS Grid to respect column sizes */}
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
                        disabled={!isPreparing}
                        placeholder="Search items..."
                        autoComplete="off"
                        style={{ 
                          height: '38px', padding: '8px 12px', fontSize: '0.9rem',
                          border: (!item.inventory_id && item.item.length > 0) ? '1px solid #ef4444' : '1px solid #d1d5db',
                          backgroundColor: (!item.inventory_id && item.item.length > 0) ? '#fef2f2' : '#fff'
                        }}
                      />
                      
                      {activeSearchIndex === index && isPreparing && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxHeight: '250px', overflowY: 'auto',
                          marginTop: '4px'
                        }}>
                          {inventoryItems
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
                          
                          {inventoryItems.filter((inv: any) => Number(inv.qty) <= 0 && inv.item_name.toLowerCase().includes((item.item || '').toLowerCase())).length > 0 && (
                             <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#ef4444', textAlign: 'center', backgroundColor: '#fef2f2' }}>
                                Some matches are currently Out of Stock.
                             </div>
                          )}
                        </div>
                      )}
                   </div>
                   
                   {/* ADDED minWidth: 0 to force CSS Grid to respect column sizes */}
                   <div className={s.formGroup} style={{ minWidth: 0 }}>
                      <label className={s.miniLabel}>Description</label>
                      <div style={{ 
                            padding: '0 12px', 
                            height: '38px', 
                            borderRadius: '6px', 
                            border: '1px solid #e5e7eb', 
                            fontSize: '0.9rem', 
                            
                            display: 'block',         
                            lineHeight: '36px',       
                            overflow: 'hidden',       
                            whiteSpace: 'nowrap',     
                            textOverflow: 'ellipsis', 
                            width: '100%',            

                            backgroundColor: (!item.inventory_id && item.item.length > 0) ? '#fef2f2' : '#f3f4f6',
                            color: (!item.inventory_id && item.item.length > 0) ? '#ef4444' : '#6b7280'
                          }}>
                         {item.itemDescription}
                      </div>
                   </div>

                   {/* ADDED minWidth: 0 */}
                   <div className={s.formGroup} style={{ minWidth: 0 }}>
                      <label className={s.miniLabel}>Qty</label>
                      <input 
                        type="number" 
                        className={s.cleanInput} 
                        value={item.quantity || ''} 
                        onChange={(e) => handleQtyChange(index, e.target.value)} 
                        disabled={!isPreparing}
                        style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', width: '100%' }}
                      />
                   </div>

                   {/* ADDED minWidth: 0 */}
                   <div className={s.formGroup} style={{ minWidth: 0 }}>
                      <label className={s.miniLabel}>Amount (₱)</label>
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

        <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', marginTop: 0, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={s.saveBtn} onClick={() => onSave({ ...formData, totalQty, totalAmt })}>Save Changes</button>
        </div>

      </div>
    </div>
  );
};

export default OrderEditModal;