'use client';

import { useState } from 'react';
import styles from '@/css/suppliers.module.css';
import { LuX } from 'react-icons/lu';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const EMPTY_FORM = {
  supplierName: '',
  address: '',
  contactPerson: '',
  contact: '',
  email: '',
  paymentTerms: 'Cash on Delivery',
};

export default function AddSupplierModal({ isOpen, onClose, onSuccess }: AddSupplierModalProps) {
  const s = styles as Record<string, string>;
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.supplierName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: form.supplierName,
          address: form.address,
          contactPerson: form.contactPerson,
          contactNumber: form.contact,
          email: form.email,
          paymentTerms: form.paymentTerms,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.message || 'Supplier created successfully!');
        handleClose();
      } else {
        onSuccess(data.error || 'Failed to create supplier.');
      }
    } catch {
      onSuccess('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={s.modalOverlay}>
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title}>Register New Supplier</h2>
            <p className={s.subText}>Create a profile for a new supplier.</p>
          </div>
          <LuX onClick={handleClose} className={s.closeIcon} />
        </div>

        <div className={`${s.modalForm} ${s.mt_20}`}>
          <h4 className={s.sectionTitle}>Company Information</h4>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Supplier Name</label>
              <input
                value={form.supplierName}
                onChange={e => setForm({ ...form, supplierName: e.target.value })}
              />
            </div>
          </div>
          <div className={s.formGroupFull}>
            <label>Address</label>
            <input
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <h4 className={s.sectionTitle}>Primary Contact</h4>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={e => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className={s.formGroup}>
              <label>Contact No.</label>
              <input
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value.replace(/[^\d]/g, '') })}
              />
            </div>
          </div>
          <div className={s.formGroupFull}>
            <label>Email Address</label>
            <input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <h4 className={s.sectionTitle}>Terms & Notes</h4>
          <div className={s.formGroup}>
            <label>Payment Terms</label>
            <select
              value={form.paymentTerms}
              onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
            >
              <option>Cash on Delivery</option>
              <option>Card</option>
            </select>
          </div>

          <div className={s.modalFooter}>
            <button type="button" onClick={handleClose} className={s.cancelBtn}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !form.supplierName.trim()}
              className={s.saveBtn}
            >
              {isSubmitting ? 'Creating…' : 'Create Supplier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
