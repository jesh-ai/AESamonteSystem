'use client';

import React, { useState } from 'react';

interface ExportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which module the requester wants to export from (e.g. "Inventory" or "Sales") */
  targetModule: string;
  /** The employee_id of the requester, stored in localStorage token */
  requesterId: number;
  onSuccess: (msg: string) => void;
}

export default function ExportRequestModal({
  isOpen,
  onClose,
  targetModule,
  requesterId,
  onSuccess,
}: ExportRequestModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRequest = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/export-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_id:  requesterId,
          target_module: targetModule,
        }),
      });

      if (res.ok) {
        onSuccess(`Export request sent to the ${targetModule} Head.`);
        onClose();
      } else {
        const err = await res.json();
        onSuccess(err.message || 'Failed to send request.');
      }
    } catch {
      onSuccess('Network error. Is Flask running?');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '32px',
        width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.2rem', color: '#1e3a8a' }}>
          Request {targetModule} Export
        </h2>
        <p style={{ margin: '0 0 24px', color: '#475569', fontSize: '0.95rem', lineHeight: 1.6 }}>
          You don&apos;t have direct export access for <strong>{targetModule}</strong>.
          Submitting this will notify the <strong>{targetModule} Head</strong> to approve your request.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: '1px solid #cbd5e1',
              background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleRequest}
            disabled={isSubmitting}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: 'none',
              background: '#1e3a8a', color: '#fff', cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontWeight: 500, opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
