import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemData: any; 
  onSave: (updatedItem: any) => void;
  suppliers: any[];
}

const EditInventoryModal = ({ isOpen, onClose, itemData, onSave, suppliers }: EditInventoryModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (itemData) {
      setFormData({
        id: itemData.id,
        itemName: itemData.item_name,
        itemDescription: itemData.item_description,
        brand: itemData.brand,
        sku: itemData.sku,
        qty: itemData.qty,
        uom: itemData.uom,
        unitPrice: itemData.unitPrice,
        sellingPrice: itemData.price,
      });
    }
  }, [itemData]);

  if (!isOpen || !formData) return null;

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div className={s.modalOverlay}> 
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
           <h2 className={s.title}>Edit Inventory Item</h2>
        </div>

        <div className={s.modalForm}>
          {/* NON-EDITABLE */}
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Product ID</label>
              <input value={formData.id || ''} readOnly className={s.readOnlyInput} />
            </div>
            <div className={s.formGroup}>
              <label>SKU</label>
              <input value={formData.sku || ''} readOnly className={s.readOnlyInput} />
            </div>
          </div>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Item Name</label>
              <input 
                value={formData.itemName || ''} 
                onChange={(e) => setFormData({...formData, itemName: e.target.value})}
              />
            </div>
            <div className={s.formGroup}>
              <label>Brand</label>
              <input 
                value={formData.brand || ''} 
                onChange={(e) => setFormData({...formData, brand: e.target.value})}
              />
            </div>
          </div>

          <div className={s.formGroupFull}>
            <label>Description</label>
            <textarea 
              className={s.searchInput}
              value={formData.itemDescription || ''} 
              onChange={(e) => setFormData({...formData, itemDescription: e.target.value})}
            />
          </div>

          <div className={s.formRowThree}>
            <div className={s.formGroup}>
              <label>Quantity</label>
              <input 
                type="number"
                value={formData.qty || ''} 
                onChange={(e) => setFormData({...formData, qty: e.target.value})}
              />
            </div>
            <div className={s.formGroup}>
              <label>Unit (UOM)</label>
              <select 
                value={formData.uom || 'Select'} 
                onChange={(e) => setFormData({...formData, uom: e.target.value})}
              >
                <option value="Select">Select</option>
                <option value="Pieces">Pieces</option>
                <option value="Rims">Rims</option>
                <option value="Pad">Pad</option>
                <option value="Roll">Roll</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label>Cost Price</label>
              <input 
                type="number"
                value={formData.unitPrice || ''} 
                onChange={(e) => setFormData({...formData, unitPrice: e.target.value})}
              />
            </div>
          </div>

          <div className={s.formGroup}>
            <label>Selling Price</label>
            <input 
              type="number"
              value={formData.sellingPrice || ''} 
              onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
            />
          </div>
          
          <div className={s.modalFooter}>
            <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={s.saveBtn} onClick={handleSubmit}>
              Update Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditInventoryModal;