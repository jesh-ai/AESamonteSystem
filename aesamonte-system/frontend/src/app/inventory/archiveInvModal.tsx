'use client'

import React, { useState } from 'react'
import styles from '@/css/inventory.module.css'
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuArrowLeft,
  LuArchiveRestore,
  LuChevronLeft,
  LuChevronRight
} from 'react-icons/lu'

export interface Product {
  id: string;
  item_name: string;
  item_description: string;
  qty: number;
  uom: string;
  status: string;
  is_archived?: boolean;
  brands?: { brand_name: string; sku: string; qty: number; unit_price: number; selling_price: number }[];
  suppliers?: { supplier_name: string }[];
}

interface ArchiveTableProps {
  products: Product[]
  onRestore: (id: string) => void
  onBack: () => void
}

const ROWS_PER_PAGE = 10;

export default function ArchiveTable({ products, onRestore, onBack }: ArchiveTableProps) {
  const s = styles as Record<string, string>
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  const filteredProducts = products.filter(p => {
    if (!p.is_archived) return false;
    const supplierNames = (p.suppliers || []).map(s => s.supplier_name).join(' ');
    const brandNames = (p.brands || []).map(b => b.brand_name).join(' ');
    const searchStr = `${p.id} ${p.item_name} ${brandNames} ${supplierNames}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aVal = a[sortConfig.key] ?? ''
    const bVal = b[sortConfig.key] ?? ''
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  }

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / ROWS_PER_PAGE));
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const renderPageNumbers = () => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button 
          key={i} 
          className={currentPage === i ? s.pageCircleActive : s.pageCircle} 
          onClick={() => setCurrentPage(i)}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className={s.tableContainer} style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      <div className={s.header}>
        <h1 className={s.title} style={{ color: '#64748b' }}>Archived Inventory</h1>
        <div className={s.controls}>
          <button
            className={s.archiveIconBtn}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#64748b', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            onClick={onBack}
          >
            <LuArrowLeft size={18} /> Back to Active
          </button>
          <div className={s.searchWrapper}>
            <input 
              className={s.searchInput} 
              placeholder="Search archives..." 
              value={searchTerm} 
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }} 
            />
            <LuSearch size={18} />
          </div>
        </div>
      </div>

      <div className={s.tableResponsive}>
        <table className={s.table}>
          <thead>
            <tr>
              {[
                { label: 'ID', key: 'id' },
                { label: 'ITEM', key: 'item_name' },
                { label: 'DESCRIPTION', key: 'item_description' },
                { label: 'TOTAL QTY', key: 'qty' },
                { label: 'UOM', key: 'uom' },
              ].map(col => (
                <th key={col.key} onClick={() => requestSort(col.key as keyof Product)} style={{ cursor: 'pointer' }}>
                  <div className={s.sortableHeader}>
                    <span>{col.label}</span>
                    <div className={s.sortIconsStack}>
                      <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                      <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
              ))}
              <th>BRANDS</th>
              <th>STATUS</th>
              <th className={s.actionHeader}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.length ? (
              paginatedProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ color: '#94a3b8' }}>{p.id}</td>
                  <td style={{ fontWeight: 600, color: '#64748b' }}>{p.item_name}</td>
                  <td style={{ color: '#94a3b8' }}>{p.item_description}</td>
                  <td style={{ color: '#94a3b8' }}>{p.qty}</td>
                  <td style={{ color: '#94a3b8' }}>{p.uom || '—'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    {(p.brands || []).map(b => b.brand_name === 'No Brand' ? '—' : b.brand_name).join(', ') || '—'}
                  </td>
                  <td>
                    <span style={{ backgroundColor: '#e2e8f0', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>ARCHIVED</span>
                  </td>
                  <td className={s.actionCell}>
                    <div className={s.actionWrapper}>
                      <button className={s.archiveBtn} onClick={() => onRestore(p.id)} style={{ color: '#10b981', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
                        <LuArchiveRestore size={16} />
                        <span>Restore</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No archived inventory found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={s.footer}>
        <div className={s.showDataText} style={{ color: '#94a3b8' }}>
          Showing <span className={s.countBadge}>{paginatedProducts.length}</span> of {sortedProducts.length}
        </div>
        <div className={s.pagination}>
          <button className={s.nextBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
            <LuChevronLeft />
          </button>
          {renderPageNumbers()}
          <button className={s.nextBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
            <LuChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}