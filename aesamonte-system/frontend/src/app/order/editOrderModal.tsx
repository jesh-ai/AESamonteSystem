import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any; 
  onSave: (updatedOrder: any) => void;
}

const OrderEditModal = ({ isOpen, onClose, orderData, onSave }: OrderEditModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (orderData) {
      setFormData({
        id: orderData.id,
        customerName: orderData.name,
        contact: orderData.contact,
        address: orderData.address,
        item: orderData.item,
        quantity: orderData.quantity,
        amount: orderData.amount,
        status: orderData.status,
        paymentMethod: orderData.paymentMethod
      });
    }
  }, [orderData]);

  if (!isOpen || !formData) return null;

  return (
    <div className={s.modalOverlay}> 
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
           <h2 className={s.title}>Edit Order Details</h2>
        </div>

        <div className={s.modalForm}>
          {/* VIEW-ONLY ORDER ID */}
          <div className={s.formGroup}>
            <label>Order ID</label>
            <input value={formData.id || ''} readOnly className={s.readOnlyInput} />
          </div>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Customer Name</label>
              <input 
                value={formData.customerName || ''} 
                onChange={(e) => setFormData({...formData, customerName: e.target.value})}
              />
            </div>
            <div className={s.formGroup}>
              <label>Contact Number</label>
              <input 
                value={formData.contact || ''} 
                onChange={(e) => setFormData({...formData, contact: e.target.value})}
              />
            </div>
          </div>

          <div className={s.formGroupFull}>
            <label>Delivery Address</label>
            <input 
              value={formData.address || ''} 
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>

          <div className={s.formRowThree}>
            <div className={s.formGroup}>
              <label>Item Ordered</label>
              <input value={formData.item || ''} readOnly className={s.readOnlyInput} />
            </div>
            <div className={s.formGroup}>
              <label>Quantity</label>
              <input 
                type="number"
                value={formData.quantity || ''} 
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              />
            </div>
            <div className={s.formGroup}>
              <label>Total Amount</label>
              <input 
                type="number"
                value={formData.amount || ''} 
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
          </div>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Status</label>
              <select 
                value={formData.status || 'Select'} 
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label>Payment Method</label>
              <select 
                value={formData.paymentMethod || 'Select'} 
                onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
              >
                <option value="Cash">Cash</option>
                <option value="Gcash">Gcash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>
          
          <div className={s.modalFooter}>
            <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={s.saveBtn} onClick={() => onSave(formData)}>
              Update Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderEditModal;