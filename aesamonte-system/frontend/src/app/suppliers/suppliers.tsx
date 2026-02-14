'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '@/css/suppliers.module.css';
import TopHeader from '@/components/layout/TopHeader';
import {
  LuSearch,
  LuEllipsisVertical,
  LuChevronUp,
  LuChevronDown,
  LuPencil,
  LuArchive,
  LuChevronRight,
  LuChevronLeft,
  LuX // Added for modal close
} from 'react-icons/lu';

/* ================= TYPES ================= */

type Supplier = {
  id: number;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
};

type SortKey = keyof Supplier;

const ROWS_PER_PAGE = 10;

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

  // --- MODAL STATE ---
  const [showModal, setShowModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    supplierName: '',
    address: '',
    contactPerson: '',
    contact: '',
    email: '',
    paymentTerms: 'Cash on Delivery'
  });

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc' | null;
  }>({
    key: 'id',
    direction: 'asc'
  });

  /* ================= FETCH ================= */

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/suppliers')
      .then(res => res.json())
      .then(data => setSuppliers(data))
      .catch(err => console.error('Failed to fetch suppliers', err))
      .finally(() => setIsLoading(false));
  }, []);

  /* ================= HANDLERS ================= */

  // NUMERIC ONLY logic for contact field
  const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const cleanValue = value.replace(/[^\d]/g, ''); // Removes non-digits
    setSupplierFormData({ ...supplierFormData, [name]: cleanValue });
  };

  const handleSort = (key: SortKey) => {
    if (!key) return;
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  /* ================= DATA PROCESSING ================= */

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return suppliers.filter(sup =>
      sup.id.toString().includes(term) ||
      sup.supplierName.toLowerCase().includes(term) ||
      sup.contactPerson.toLowerCase().includes(term) ||
      sup.contactNumber.toLowerCase().includes(term) ||
      sup.email.toLowerCase().includes(term) ||
      sup.address.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (!sortConfig.key || !sortConfig.direction) return arr.sort((a, b) => a.id - b.id);
    return arr.sort((a, b) => {
      const A = a[sortConfig.key!];
      const B = b[sortConfig.key!];
      if (typeof A === 'number' && typeof B === 'number') {
        return sortConfig.direction === 'asc' ? A - B : B - A;
      }
      const strA = String(A).toLowerCase();
      const strB = String(B).toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  /* ================= PAGINATION ================= */

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () =>
    Array.from({ length: totalPages }, (_, i) => (
      <div
        key={i + 1}
        className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
        onClick={() => changePage(i + 1)}
      >{i + 1}</div>
    ));

  if (isLoading) return <div className={s.loadingContainer}>Loading Suppliers...</div>;

  const columns: { label: string; key: SortKey }[] = [
    { label: 'ID', key: 'id' },
    { label: 'SUPPLIER NAME', key: 'supplierName' },
    { label: 'CONTACT PERSON', key: 'contactPerson' },
    { label: 'CONTACT NUMBER', key: 'contactNumber' },
    { label: 'EMAIL', key: 'email' },
    { label: 'ADDRESS', key: 'address' }
  ];

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.tableContainer}>
          <div className={s.header}>
            <h2 className={s.title}>Suppliers</h2>
            <div className={s.controls}>
              <button className={s.archiveIconBtn}><LuArchive size={20} /></button>
              <div className={s.searchWrapper}>
                <input
                  className={s.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <LuSearch size={18} />
              </div>
              {/* ATTACHED MODAL TRIGGER HERE */}
              <button className={s.addButton} onClick={() => setShowModal(true)}>ADD</button>
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key!} onClick={() => handleSort(col.key)} className={s.sortableHeader}>
                    <div className={s.sortHeaderInner}>
                      <span>{col.label}</span>
                      <div className={s.sortIconsStack}>
                        <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                        <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
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
                  <tr key={sup.id} className={i % 2 ? s.altRow : ''}>
                    <td>{sup.id}</td>
                    <td>{sup.supplierName}</td>
                    <td>{sup.contactPerson}</td>
                    <td>{sup.contactNumber}</td>
                    <td>{sup.email}</td>
                    <td>{sup.address}</td>
                    <td className={s.actionCell}>
                      <LuEllipsisVertical
                        className={s.moreIcon}
                        onClick={() => setOpenMenuId(openMenuId === sup.id ? null : sup.id)}
                      />
                      {openMenuId === sup.id && (
                        <div className={s.popupMenu}>
                          <button className={s.popBtnEdit}><LuPencil size={14} /> Edit</button>
                          <button className={s.popBtnArchive}><LuArchive size={14} /> Archive</button>
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

          <div className={s.footer}>
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}
            </div>
            {totalPages > 1 && (
              <div className={s.pagination}>
                <button className={s.nextBtn} onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}><LuChevronLeft /></button>
                {renderPageNumbers()}
                <button className={s.nextBtn} onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}><LuChevronRight /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= REGISTER NEW SUPPLIER MODAL ================= */}
      {showModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title}>Register New Supplier</h2>
                <p className={s.subText}>Create a profile for a new supplier.</p>
              </div>
              <LuX onClick={() => setShowModal(false)} className={s.closeIcon} />
            </div>

            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Supplier Name</label>
                  <input 
                    name="supplierName" 
                    value={supplierFormData.supplierName} 
                    onChange={(e) => setSupplierFormData({...supplierFormData, supplierName: e.target.value})} 
                  />
                </div>
              </div>
              
              <div className={s.formGroupFull}>
                <label>Address</label>
                <input 
                  name="address" 
                  value={supplierFormData.address} 
                  onChange={(e) => setSupplierFormData({...supplierFormData, address: e.target.value})} 
                />
              </div>

              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Contact Person</label>
                  <input 
                    name="contactPerson" 
                    value={supplierFormData.contactPerson} 
                    onChange={(e) => setSupplierFormData({...supplierFormData, contactPerson: e.target.value})} 
                  />
                </div>
                
                <div className={s.formGroup}>
                  <label>Contact No.</label>
                  <input 
                    name="contact" 
                    value={supplierFormData.contact} 
                    onChange={handleNumericInputChange} // NUMERIC ONLY
                  />
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label>Email Address</label>
                <input 
                  name="email" 
                  value={supplierFormData.email} 
                  onChange={(e) => setSupplierFormData({...supplierFormData, email: e.target.value})} 
                />
              </div>

              <h4 className={s.sectionTitle}>Terms & Notes</h4>
              <div className={s.formGroup}>
                <label>Payment Terms</label>
                <select 
                  name="paymentTerms" 
                  value={supplierFormData.paymentTerms} 
                  onChange={(e) => setSupplierFormData({...supplierFormData, paymentTerms: e.target.value})}
                >
                  <option>Cash on Delivery</option>
                  <option>Card</option>
                </select>
              </div>

              <div className={s.modalFooter}>
                <button type="button" onClick={() => setShowModal(false)} className={s.cancelBtn}>Cancel</button>
                <button 
                  type="button" 
                  onClick={() => {
                    console.log("Saving Supplier:", supplierFormData);
                    setShowModal(false);
                  }} 
                  className={s.saveBtn}
                >
                  Create Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}