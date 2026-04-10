'use client';
import React, { useState } from 'react';
import styles from "@/css/inventory.module.css";
import { LuX } from "react-icons/lu";

interface AddBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (brand: { id: number; name: string }) => void;
  existingBrands: { id: number; name: string }[];
}

const AddBrandModal: React.FC<AddBrandModalProps> = ({ isOpen, onClose, onSave, existingBrands }) => {
  const s = styles as Record<string, string>;
  const [brandName, setBrandName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const trimmed = brandName.trim();
    if (!trimmed) { setError('Brand name is required.'); return; }

    const isDuplicate = existingBrands.some(
      b => b.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setError(`"${trimmed}" already exists. Please use a different name.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save brand.'); return; }
      onSave({ id: data.id, name: trimmed });
      setBrandName('');
      setError('');
      onClose();
    } catch {
      setError('Server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1200 }}>
      <div className={s.modalContent} style={{ width: '420px', padding: '24px', borderRadius: '12px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Add New Brand</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>This brand will be added to the dropdown.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <LuX size={20} />
          </button>
        </div>

        {/* Field */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: error ? '#dc2626' : '#6b7280', marginBottom: '6px' }}>
            Brand Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            autoFocus
            value={brandName}
            onChange={e => { setBrandName(e.target.value); if (error) setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. Samsung, Generic, No Brand..."
            style={{
              width: '100%', height: '40px', padding: '8px 12px',
              borderRadius: '6px', fontSize: '0.95rem', outline: 'none',
              border: error ? '1px solid #f87171' : '1px solid #d1d5db',
              backgroundColor: error ? '#fff5f5' : '#fff',
              boxSizing: 'border-box',
            }}
          />
          {error && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} className={s.cancelBtn} disabled={loading}>Cancel</button>
          <button type="button" onClick={handleSubmit} className={s.saveBtn} disabled={loading}>
            {loading ? 'Saving...' : 'Add Brand'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBrandModal;