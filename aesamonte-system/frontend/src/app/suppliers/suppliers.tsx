'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '@/css/suppliers.module.css';
import TopHeader from '@/components/layout/TopHeader';
import ArchiveSupplierTable from './archiveSupModal';
import {
  LuSearch,
  LuEllipsisVertical,
  LuChevronUp,
  LuChevronDown,
  LuPencil,
  LuArchive,
  LuChevronRight,
  LuChevronLeft,
  LuX,
  LuPrinter,
  LuPhone,
  LuMail,
  LuMapPin,
  LuUser
} from 'react-icons/lu';

/* ================= TYPES ================= */

type Supplier = {
  id: number;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
  paymentTerms?: string;
  is_archived?: boolean;
};

type SortKey = keyof Supplier;

const ROWS_PER_PAGE = 10;

/* ================= HELPERS ================= */

const getViewStatusClass = (isArchived: boolean | undefined, s: Record<string, string>) => {
  return isArchived ? s.viewStatusArchived : s.viewStatusActive;
};

const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');

const CREATE_REQUIRED: { field: keyof typeof EMPTY_CREATE_FORM; label: string }[] = [
  { field: 'supplierName', label: 'Supplier Name' },
  { field: 'address',      label: 'Address' },
  { field: 'contactPerson', label: 'Contact Person' },
  { field: 'contact',      label: 'Contact No.' },
];

const EMPTY_CREATE_FORM = {
  supplierName: '',
  address: '',
  contactPerson: '',
  contact: '',
  email: '',
  paymentTerms: 'Cash on Delivery'
};

// Required fields for EDIT modal
const EDIT_REQUIRED: { field: keyof Supplier; label: string }[] = [
  { field: 'supplierName',  label: 'Supplier Name' },
  { field: 'address',       label: 'Address' },
  { field: 'contactPerson', label: 'Contact Person' },
  { field: 'contactNumber', label: 'Contact No.' },
];

const errStyle = { borderColor: '#fca5a5', backgroundColor: '#fff5f5' };

// ── ADDED: matches Add Order LABEL_STYLE ──
const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

/* ================= COMPONENT ================= */

export default function Suppliers({
  role,
  onLogout
}: {
  role: string;
  onLogout: () => void;
}) {
  const s = styles as Record<string, string>;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isArchiveView, setIsArchiveView] = useState(false);

  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSupplierForView, setSelectedSupplierForView] = useState<Supplier | null>(null);

  // --- CREATE MODAL STATE ---
  const [showModal, setShowModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({ ...EMPTY_CREATE_FORM });
  const [createDupError, setCreateDupError] = useState('');
  const [createFormError, setCreateFormError] = useState('');
  const [createEmptyFields, setCreateEmptyFields] = useState<Set<string>>(new Set());
  const [showCreateCancelConfirm, setShowCreateCancelConfirm] = useState(false);
  // ── ADDED ──
  const [createSubmitAttempted, setCreateSubmitAttempted] = useState(false);

  // --- EDIT MODAL STATE ---
  const [editModal, setEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Supplier | null>(null);
  const [editOriginalData, setEditOriginalData] = useState<Supplier | null>(null);
  const [editDupError, setEditDupError] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [editEmptyFields, setEditEmptyFields] = useState<Set<string>>(new Set());
  const [editSubmitAttempted, setEditSubmitAttempted] = useState(false);
  const [showEditCancelConfirm, setShowEditCancelConfirm] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  /* ================= FETCH ================= */

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch Suppliers', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  /* ================= CREATE MODAL HELPERS ================= */

  const isCreateFormDirty = (): boolean => {
    return !!(
      supplierFormData.supplierName.trim() ||
      supplierFormData.address.trim() ||
      supplierFormData.contactPerson.trim() ||
      supplierFormData.contact.trim() ||
      supplierFormData.email.trim()
    );
  };

  const clearCreateEmpty = (field: string) => {
    setCreateEmptyFields(prev => { const next = new Set(prev); next.delete(field); return next; });
    if (createFormError) setCreateFormError('');
  };

  const validateCreate = (): boolean => {
    const missing: string[] = [];
    const empty = new Set<string>();
    CREATE_REQUIRED.forEach(({ field, label }) => {
      if (!supplierFormData[field].trim()) { missing.push(label); empty.add(field); }
    });
    setCreateEmptyFields(empty);
    if (missing.length > 0) {
      setCreateFormError(`Please fill in the following required fields: ${missing.join(', ')}.`);
      return false;
    }
    setCreateFormError('');
    return true;
  };

  const handleCloseCreateModal = () => {
    setShowModal(false);
    setSupplierFormData({ ...EMPTY_CREATE_FORM });
    setCreateDupError('');
    setCreateFormError('');
    setCreateEmptyFields(new Set());
    setShowCreateCancelConfirm(false);
    setCreateSubmitAttempted(false); // ── ADDED ──
  };

    const handleCreateCancelClick = () => {
      if (isCreateFormDirty()) setShowCreateCancelConfirm(true);
      else handleCloseCreateModal();
    };

    /* ================= EDIT MODAL HELPERS ================= */

    const isEditFormDirty = (): boolean => {
      if (!editFormData || !editOriginalData) return false;
      return (
        editFormData.supplierName  !== editOriginalData.supplierName  ||
        editFormData.address       !== editOriginalData.address       ||
        editFormData.contactPerson !== editOriginalData.contactPerson ||
        editFormData.contactNumber !== editOriginalData.contactNumber ||
        editFormData.email         !== editOriginalData.email
      );
    };

    const clearEditEmpty = (field: string) => {
      setEditEmptyFields(prev => { const next = new Set(prev); next.delete(field); return next; });
      if (editFormError) setEditFormError('');
    };

    const validateEdit = (): boolean => {
      if (!editFormData) return false;
      const missing: string[] = [];
      const empty = new Set<string>();
      EDIT_REQUIRED.forEach(({ field, label }) => {
        if (!String(editFormData[field] ?? '').trim()) { missing.push(label); empty.add(field); }
      });
      setEditEmptyFields(empty);
      if (missing.length > 0) {
        setEditFormError(`Please fill in the following required fields: ${missing.join(', ')}.`);
        return false;
      }
      setEditFormError('');
      return true;
    };

    const handleOpenEditModal = (sup: Supplier) => {
      setEditFormData({ ...sup });
      setEditOriginalData({ ...sup });
      setEditDupError('');
      setEditFormError('');
      setEditEmptyFields(new Set());
      setEditSubmitAttempted(false);
      setShowEditCancelConfirm(false);
      setEditModal(true);
      setOpenMenuId(null);
    };

    const handleCloseEditModal = () => {
      setEditModal(false);
      setEditFormData(null);
      setEditOriginalData(null);
      setEditDupError('');
      setEditFormError('');
      setEditEmptyFields(new Set());
      setEditSubmitAttempted(false);
      setShowEditCancelConfirm(false);
    };

    const handleEditCancelClick = () => {
      if (isEditFormDirty()) setShowEditCancelConfirm(true);
      else handleCloseEditModal();
    };

    /* ================= HANDLERS ================= */

    const handleCreateSupplier = async () => {
      setCreateSubmitAttempted(true); // ── ADDED ──
      if (!validateCreate()) return;

      const newName = normalize(supplierFormData.supplierName);
      const isDuplicate = suppliers.some(sup => normalize(sup.supplierName) === newName);
      if (isDuplicate) {
        setCreateDupError(`"${supplierFormData.supplierName.trim()}" already exists. Please use a different supplier name.`);
        return;
      }

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: supplierFormData.supplierName,
          address: supplierFormData.address,
          contactPerson: supplierFormData.contactPerson,
          contactNumber: supplierFormData.contact,
          email: supplierFormData.email,
          paymentTerms: supplierFormData.paymentTerms,
        })
      });
      const data = await response.json();
      if (response.ok) {
        await fetchSuppliers();
        handleCloseCreateModal();
        setToastMessage(data.message || 'Supplier created successfully!');
        setIsError(false);
        setShowToast(true);
      } else {
        setToastMessage(data.error || 'Failed to create supplier.');
        setIsError(true);
        setShowToast(true);
      }
    } catch {
      setToastMessage('Network error. Please try again.');
      setIsError(true);
      setShowToast(true);
    }
  };

  const handleEditSupplier = async () => {
    if (!editFormData) return;

    setEditSubmitAttempted(true);

    // 1. Required fields
    if (!validateEdit()) return;

    // 2. No changes check
    if (!isEditFormDirty()) {
      setEditFormError('No changes detected. Please modify at least one field before updating.');
      return;
    }

    // 3. Duplicate name check
    const newName = normalize(editFormData.supplierName);
    const conflict = suppliers.find(
      sup => normalize(sup.supplierName) === newName && sup.id !== editFormData.id
    );
    if (conflict) {
      setEditDupError(`"${editFormData.supplierName.trim()}" already exists. Please use a different supplier name.`);
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: editFormData.supplierName,
          address: editFormData.address,
          contactPerson: editFormData.contactPerson,
          contactNumber: editFormData.contactNumber,
          email: editFormData.email,
        })
      });
      const data = await response.json();
      if (response.ok) {
        await fetchSuppliers();
        handleCloseEditModal();
        setToastMessage(data.message || 'Supplier updated successfully!');
        setIsError(false);
        setShowToast(true);
      } else {
        setToastMessage(data.error || 'Failed to update supplier.');
        setIsError(true);
        setShowToast(true);
      }
    } catch {
      setToastMessage('Network error. Please try again.');
      setIsError(true);
      setShowToast(true);
    }
  };

  const handleToggleArchive = async (id: number) => {
    try {
      const response = await fetch(`/api/suppliers/archive/${id}`, { method: 'PUT' });
      if (response.ok) {
        const apiData = await response.json();
        setSuppliers(prev =>
          prev.map(sup => sup.id === id ? { ...sup, is_archived: apiData.is_archived } : sup)
        );
        setToastMessage(apiData.message);
        setIsError(false);
        setShowToast(true);
        setOpenMenuId(null);
      } else {
        const errorData = await response.json();
        setToastMessage(`Failed: ${errorData.error}`);
        setIsError(true);
        setShowToast(true);
      }
    } catch {
      setToastMessage('Network error.');
      setIsError(true);
      setShowToast(true);
    }
  };

  const handleSort = (key: SortKey) => {
    if (!key) return;
    setSortConfig(prev => {
      if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  const handleOpenView = (supplier: Supplier) => {
    setSelectedSupplierForView(supplier);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedSupplierForView(null);
  };

  const handlePrint = () => {
    if (!selectedSupplierForView) return;
    const pw = window.open('', '_blank');
    if (!pw) {
      alert('Pop-up blocked. Please allow pop-ups for this site in your browser settings, then try again.');
      return;
    }

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Supplier Profile - No. ${String(selectedSupplierForView.id).padStart(4, '0')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 24px 28px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
    .company h1 { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .company p  { font-size: 10px; line-height: 1.65; }
    .receipt-block { text-align: right; }
    .receipt-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
    .receipt-no    { font-size: 24px; font-weight: 900; color: #1a4263; letter-spacing: 2px; }
    .receipt-no span { font-size: 13px; font-weight: 700; color: #000; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; color: #1a4263; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; display: block; margin-bottom: 2px; }
    .info-item span  { font-size: 11px; color: #000; }
    .info-full { margin-bottom: 10px; }
    .info-full label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; display: block; margin-bottom: 2px; }
    .info-full span  { font-size: 11px; color: #000; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .print-footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
    @media print { body { padding: 10px 14px; } @page { margin: 0.4in; size: letter; } }
  </style>
</head>
<body>
  <div class="top">
    <div class="company">
      <h1>AE Samonte Merchandise</h1>
      <p>ALAIN E. SAMONTE - Prop.</p>
      <p>VAT Reg. TIN : 263-884-036-00000</p>
      <p>1457 A. Leon Guinto St., Zone 73 Barangay 676,</p>
      <p>1000 Ermita NCR, City of Manila, First District, Philippines</p>
    </div>
    <div class="receipt-block">
      <div class="receipt-title">SUPPLIER PROFILE</div>
      <div class="receipt-no"><span>S-</span>${String(selectedSupplierForView.id).padStart(4, '0')}</div>
      <div style="margin-top:6px; font-size:10px;">Printed: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div style="margin-top:4px;"><span class="status-badge">${selectedSupplierForView.is_archived ? 'ARCHIVED' : 'ACTIVE'}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Company Information</div>
    <div class="info-full">
      <label>Supplier Name</label>
      <span style="font-size:15px; font-weight:700;">${selectedSupplierForView.supplierName}</span>
    </div>
    <div class="info-full">
      <label>Address</label>
      <span>${selectedSupplierForView.address}</span>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Contact Information</div>
    <div class="info-grid">
      <div class="info-item">
        <label>Contact Person</label>
        <span>${selectedSupplierForView.contactPerson}</span>
      </div>
      <div class="info-item">
        <label>Contact Number</label>
        <span>${selectedSupplierForView.contactNumber}</span>
      </div>
    </div>
    <div class="info-full" style="margin-top:10px;">
      <label>Email Address</label>
      <span>${selectedSupplierForView.email}</span>
    </div>
  </div>
  ${selectedSupplierForView.paymentTerms ? `
  <div class="section">
    <div class="section-title">Payment Terms</div>
    <div class="info-item">
      <label>Terms</label>
      <span>${selectedSupplierForView.paymentTerms}</span>
    </div>
  </div>
  ` : ''}
  <div class="print-footer">
    <div>AE Samonte Merchandise — Supplier Management System</div>
    <div>Document generated on ${new Date().toLocaleString('en-PH')}</div>
  </div>
</body>
</html>`);

    pw.document.close();
    pw.focus();
    pw.print();
  };

  /* ================= DATA PROCESSING ================= */

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return suppliers.filter(sup => {
      const matchesArchiveView = isArchiveView ? Boolean(sup.is_archived) : !sup.is_archived;
      return matchesArchiveView && (
        sup.id.toString().includes(term) ||
        sup.supplierName.toLowerCase().includes(term) ||
        sup.contactPerson.toLowerCase().includes(term) ||
        sup.contactNumber.toLowerCase().includes(term) ||
        sup.email.toLowerCase().includes(term) ||
        sup.address.toLowerCase().includes(term)
      );
    });
  }, [suppliers, searchTerm, isArchiveView]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (!sortConfig.key || !sortConfig.direction) {
      return arr.sort((a, b) => {
        const numA = Number(String(a.id).replace(/\D/g, '')) || 0;
        const numB = Number(String(b.id).replace(/\D/g, '')) || 0;
        return numA - numB;
      });
    }
    const { key, direction } = sortConfig;
    return arr.sort((a, b) => {
      const A = a[key!];
      const B = b[key!];
      if (key === 'id') {
        const numA = Number(String(A).replace(/\D/g, '')) || 0;
        const numB = Number(String(B).replace(/\D/g, '')) || 0;
        return direction === 'asc' ? numA - numB : numB - numA;
      }
      const strA = String(A ?? '').toLowerCase();
      const strB = String(B ?? '').toLowerCase();
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  /* ================= PAGINATION ================= */

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button key={i} className={currentPage === i ? s.pageCircleActive : s.pageCircle} onClick={() => setCurrentPage(i)}>
          {i}
        </button>
      );
    }
    return pages;
  };

  if (isLoading) return <div className={s.loadingContainer}>Loading Suppliers...</div>;

  const columns: { label: string; key: SortKey }[] = [
    { label: 'ID', key: 'id' },
    { label: 'SUPPLIER NAME', key: 'supplierName' },
    { label: 'CONTACT PERSON', key: 'contactPerson' },
    { label: 'CONTACT NUMBER', key: 'contactNumber' },
    { label: 'EMAIL', key: 'email' },
    { label: 'ADDRESS', key: 'address' }
  ];

  /* ================= RENDER ================= */

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {/* TOAST */}
      {showToast && (
        <div className={s.toastOverlay}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
                {isError ? '!' : '✓'}
              </div>
            </div>
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>
              <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      <div className={s.mainContent}>
        {isArchiveView ? (
          <ArchiveSupplierTable
            suppliers={suppliers}
            onRestore={handleToggleArchive}
            onBack={() => setIsArchiveView(false)}
          />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h2 className={s.title}>Suppliers</h2>
              <div className={s.controls}>
                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives">
                  <LuArchive size={20} />
                </button>
                <div className={s.searchWrapper}>
                  <input
                    className={s.searchInput}
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <LuSearch size={18} />
                </div>
                <button className={s.addButton} onClick={() => setShowModal(true)}>ADD</button>
              </div>
            </div>

            <div className={s.tableResponsive}>
              <table className={s.table}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col.key!} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer' }}>
                        <div className={s.sortableHeader}>
                          <span>{col.label}</span>
                          <div className={s.sortIconsStack}>
                            <LuChevronUp size={12} className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                            <LuChevronDown size={12} className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className={s.actionHeader}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length ? (
                    paginated.map((sup, i) => (
                      <tr key={sup.id} className={i % 2 ? s.altRow : ''} onClick={() => handleOpenView(sup)} style={{ cursor: 'pointer' }}>
                        <td>{sup.id}</td>
                        <td><strong>{sup.supplierName}</strong></td>
                        <td>{sup.contactPerson}</td>
                        <td>{sup.contactNumber}</td>
                        <td>{sup.email}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.address}</td>
                        <td className={s.actionCell} onClick={e => e.stopPropagation()}>
                          <LuEllipsisVertical className={s.moreIcon} onClick={() => setOpenMenuId(openMenuId === sup.id ? null : sup.id)} />
                          {openMenuId === sup.id && (
                            <div className={s.popupMenu}>
                              <button className={s.popBtnEdit} onClick={() => handleOpenEditModal(sup)}>
                                <LuPencil size={14} /> Edit
                              </button>
                              <button className={s.popBtnArchive} onClick={() => handleToggleArchive(sup.id)}>
                                <LuArchive size={14} /> Archive
                              </button>
                              <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No suppliers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={s.footer}>
              <div className={s.showDataText}>
                Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}
              </div>
              {totalPages > 1 && (
                <div className={s.pagination}>
                  <button className={s.nextBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                    <LuChevronLeft />
                  </button>
                  {renderPageNumbers()}
                  <button className={s.nextBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                    <LuChevronRight />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= NEW SUPPLIER MODAL ================= */}
      {showModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title}>Register New Supplier</h2>
                <p className={s.subText}>Create a profile for a new supplier.</p>
              </div>
              <LuX onClick={handleCreateCancelClick} className={s.closeIcon} />
            </div>

            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED: label now uses LABEL_STYLE, turns red on error ── */}
                  <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('supplierName') ? '#dc2626' : '#6b7280' }}>
                    Supplier Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    name="supplierName"
                    value={supplierFormData.supplierName}
                    onChange={e => {
                      setCreateDupError('');
                      clearCreateEmpty('supplierName');
                      setSupplierFormData({ ...supplierFormData, supplierName: e.target.value });
                    }}
                    style={createEmptyFields.has('supplierName') || createDupError ? errStyle : {}}
                    placeholder="e.g. Juan dela Cruz Trading"
                  />
                  {/* ── ADDED: helper text below field ── */}
                  {createSubmitAttempted && createEmptyFields.has('supplierName') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Supplier name is required.</p>
                  )}
                </div>
              </div>

              {createDupError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '12px' }}>
                  <span>⚠</span> {createDupError}
                </div>
              )}

              <div className={s.formGroupFull}>
                {/* ── CHANGED ── */}
                <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('address') ? '#dc2626' : '#6b7280' }}>
                  Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  name="address"
                  value={supplierFormData.address}
                  onChange={e => { clearCreateEmpty('address'); setSupplierFormData({ ...supplierFormData, address: e.target.value }); }}
                  style={createEmptyFields.has('address') ? errStyle : {}}
                  placeholder="Street, Barangay, City"
                />
                {/* ── ADDED ── */}
                {createSubmitAttempted && createEmptyFields.has('address') && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Address is required.</p>
                )}
              </div>

              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('contactPerson') ? '#dc2626' : '#6b7280' }}>
                    Contact Person <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    name="contactPerson"
                    value={supplierFormData.contactPerson}
                    onChange={e => { clearCreateEmpty('contactPerson'); setSupplierFormData({ ...supplierFormData, contactPerson: e.target.value }); }}
                    style={createEmptyFields.has('contactPerson') ? errStyle : {}}
                    placeholder="Full name"
                  />
                  {/* ── ADDED ── */}
                  {createSubmitAttempted && createEmptyFields.has('contactPerson') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact person is required.</p>
                  )}
                </div>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('contact') ? '#dc2626' : '#6b7280' }}>
                    Contact No. <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    name="contact"
                    value={supplierFormData.contact}
                    onChange={e => { clearCreateEmpty('contact'); setSupplierFormData({ ...supplierFormData, contact: e.target.value.replace(/[^\d]/g, '') }); }}
                    style={createEmptyFields.has('contact') ? errStyle : {}}
                    placeholder="09XXXXXXXXX"
                  />
                  {/* ── ADDED ── */}
                  {createSubmitAttempted && createEmptyFields.has('contact') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact number is required.</p>
                  )}
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label style={{ ...LABEL_STYLE }}>Email Address</label>
                <input
                  name="email"
                  value={supplierFormData.email}
                  onChange={e => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                  placeholder="supplier@email.com"
                />
              </div>

              <h4 className={s.sectionTitle}>Terms & Notes</h4>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Payment Terms</label>
                <select
                  name="paymentTerms"
                  value={supplierFormData.paymentTerms}
                  onChange={e => setSupplierFormData({ ...supplierFormData, paymentTerms: e.target.value })}
                >
                  <option>Cash on Delivery</option>
                  <option>Card</option>
                </select>
              </div>

              {createFormError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '12px 16px', fontSize: '0.85rem', fontWeight: 500, marginTop: '8px' }}>
                  ⚠ {createFormError}
                </div>
              )}

              <div className={s.modalFooter}>
                <button type="button" onClick={handleCreateCancelClick} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={handleCreateSupplier} className={s.saveBtn}>Create Supplier</button>
              </div>
            </div>
          </div>

          {/* Create discard confirm */}
          {showCreateCancelConfirm && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreateCancelConfirm(false)}>
              <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 36px', width: '380px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#111' }}>Discard Changes?</p>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '28px' }}>All entered information will be lost.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={() => setShowCreateCancelConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #ddd', background: '#fff', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#333' }}>Keep Editing</button>
                  <button onClick={handleCloseCreateModal} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#ef4444', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#fff' }}>Yes, Discard</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= EDIT SUPPLIER MODAL ================= */}
      {editModal && editFormData && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title}>Edit Supplier</h2>
                <p className={s.subText}>Update supplier information.</p>
              </div>
              <LuX onClick={handleEditCancelClick} className={s.closeIcon} />
            </div>

            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('supplierName') ? '#dc2626' : '#6b7280' }}>
                    Supplier Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={editFormData.supplierName}
                    onChange={e => {
                      setEditDupError('');
                      clearEditEmpty('supplierName');
                      setEditFormData({ ...editFormData, supplierName: e.target.value });
                    }}
                    style={editEmptyFields.has('supplierName') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : editDupError ? errStyle : {}}
                  />
                  {/* ── ADDED ── */}
                  {editSubmitAttempted && editEmptyFields.has('supplierName') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Supplier name is required.</p>
                  )}
                </div>
              </div>

              {editDupError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '12px' }}>
                  <span>⚠</span> {editDupError}
                </div>
              )}

              <div className={s.formGroupFull}>
                {/* ── CHANGED ── */}
                <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('address') ? '#dc2626' : '#6b7280' }}>
                  Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={editFormData.address}
                  onChange={e => { clearEditEmpty('address'); setEditFormData({ ...editFormData, address: e.target.value }); }}
                  style={editEmptyFields.has('address') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : {}}
                />
                {/* ── ADDED ── */}
                {editSubmitAttempted && editEmptyFields.has('address') && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Address is required.</p>
                )}
              </div>

              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('contactPerson') ? '#dc2626' : '#6b7280' }}>
                    Contact Person <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={editFormData.contactPerson}
                    onChange={e => { clearEditEmpty('contactPerson'); setEditFormData({ ...editFormData, contactPerson: e.target.value }); }}
                    style={editEmptyFields.has('contactPerson') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : {}}
                  />
                  {/* ── ADDED ── */}
                  {editSubmitAttempted && editEmptyFields.has('contactPerson') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact person is required.</p>
                  )}
                </div>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('contactNumber') ? '#dc2626' : '#6b7280' }}>
                    Contact No. <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={editFormData.contactNumber}
                    onChange={e => { clearEditEmpty('contactNumber'); setEditFormData({ ...editFormData, contactNumber: e.target.value.replace(/[^\d]/g, '') }); }}
                    style={editEmptyFields.has('contactNumber') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : {}}
                  />
                  {/* ── ADDED ── */}
                  {editSubmitAttempted && editEmptyFields.has('contactNumber') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact number is required.</p>
                  )}
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label style={{ ...LABEL_STYLE }}>Email Address</label>
                <input
                  value={editFormData.email}
                  onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>

              {editFormError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '12px 16px', fontSize: '0.85rem', fontWeight: 500, marginTop: '8px' }}>
                  ⚠ {editFormError}
                </div>
              )}

              <div className={s.modalFooter}>
                <button type="button" onClick={handleEditCancelClick} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={handleEditSupplier} className={s.saveBtn}>Update Supplier</button>
              </div>
            </div>
          </div>

          {/* Edit discard confirm */}
          {showEditCancelConfirm && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowEditCancelConfirm(false)}>
              <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 36px', width: '380px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#111' }}>Discard Changes?</p>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '28px' }}>All entered information will be lost.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={() => setShowEditCancelConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #ddd', background: '#fff', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#333' }}>Keep Editing</button>
                  <button onClick={handleCloseEditModal} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#ef4444', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#fff' }}>Yes, Discard</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== VIEW / SUPPLIER PROFILE MODAL ===== */}
      {showViewModal && selectedSupplierForView && (
        <div className={s.viewBackdrop} onClick={closeViewModal}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()}>
            <div className={s.viewModalHeader}>
              <div>
                <h2 className={s.viewCompanyName}>AE Samonte Merchandise</h2>
                <p className={s.viewOrderNumber}>S-{String(selectedSupplierForView.id).padStart(4, '0')}</p>
              </div>
              <div className={s.viewHeaderRight}>
                <button className={s.viewCloseBtn} onClick={closeViewModal}><LuX size={20} /></button>
              </div>
            </div>

            <div className={s.viewSupplierBanner}>
              <div>
                <p className={s.viewSupplierLabel}>Supplier Name</p>
                <p className={s.viewSupplierNameLarge}>{selectedSupplierForView.supplierName}</p>
                <p className={s.viewSupplierAddress}>{selectedSupplierForView.address}</p>
              </div>
            </div>

            <div className={s.viewPrintBody}>
              <div className={s.viewCustomerSection}>
                <p className={s.viewSectionTitle}>Contact Information</p>
                <div className={s.viewSupplierDetailsGrid}>
                  <div className={s.viewDetailItem}>
                    <div className={s.viewDetailIcon}><LuUser size={14} /></div>
                    <div>
                      <p className={s.viewInfoLabel}>Contact Person</p>
                      <p className={s.viewInfoValue}>{selectedSupplierForView.contactPerson || '—'}</p>
                    </div>
                  </div>
                  <div className={s.viewDetailItem}>
                    <div className={s.viewDetailIcon}><LuPhone size={14} /></div>
                    <div>
                      <p className={s.viewInfoLabel}>Contact Number</p>
                      <p className={s.viewInfoValue}>{selectedSupplierForView.contactNumber || '—'}</p>
                    </div>
                  </div>
                  <div className={s.viewDetailItem}>
                    <div className={s.viewDetailIcon}><LuMail size={14} /></div>
                    <div>
                      <p className={s.viewInfoLabel}>Email Address</p>
                      <p className={s.viewInfoValue}>{selectedSupplierForView.email || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedSupplierForView.paymentTerms && (
                <div className={s.viewCustomerSection}>
                  <p className={s.viewSectionTitle}>Terms</p>
                  <div className={s.viewTotalsWrapper}>
                    <div className={s.viewTotalsBox}>
                      <div className={s.viewTotalLine}>
                        <span>Payment Terms</span>
                        <span>{selectedSupplierForView.paymentTerms}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={s.viewModalFooter}>
              <button className={s.viewBtnPrint} onClick={handlePrint}><LuPrinter size={14} /> Print</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}