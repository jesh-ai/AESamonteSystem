'use client';

import React, { useState } from 'react';

interface ExportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which module the requester wants to export from (e.g. "Inventory" or "Sales") */
  targetModule: string;
  /** The employee_id of the requester, stored in localStorage token */
  requesterId?: number;
  onSuccess: (msg: string, type?: 'success' | 'error') => void;
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
          requester_id:  requesterId ?? null,
          target_module: targetModule,
        }),
      });

      if (res.ok) {
        onSuccess(`Export request sent to the ${targetModule} Head.`, 'success');
        onClose();
      } else {
        const err = await res.json();
        onSuccess(err.message || 'Failed to send request.', 'error');
        onClose();
      }
    } catch {
      onSuccess('Network error. Is Flask running?', 'error');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes reqModalFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes reqModalSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          background: '#fff', borderRadius: '16px', width: '420px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
          animation: 'reqModalFadeIn 0.2s ease',
        }}>

          {/* ── Blue banner ── */}
          <div style={{ background: '#1e3a8a', padding: '24px 28px 20px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              Request {targetModule} Export
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
              Access request required
            </p>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '24px 28px' }}>

            {/* Info box */}
            <div style={{
              background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: '10px',
              padding: '14px 16px', marginBottom: '24px',
              display: 'flex', gap: '12px', alignItems: 'flex-start',
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', background: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '1px',
              }}>
                <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>i</span>
              </div>
              <p style={{ margin: 0, color: '#1e40af', fontSize: '0.88rem', lineHeight: 1.6 }}>
                You don&apos;t have direct export access for <strong>{targetModule}</strong>.
                Submitting this will notify the <strong>{targetModule} Head</strong> to approve your request.
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onClose}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: '8px',
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequest}
                disabled={isSubmitting}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: '8px', border: 'none',
                  background: isSubmitting ? '#93c5fd' : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#fff', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(37,99,235,0.35)',
                }}
              >
                {isSubmitting ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5"
                      style={{ animation: 'reqModalSpin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send Request
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}