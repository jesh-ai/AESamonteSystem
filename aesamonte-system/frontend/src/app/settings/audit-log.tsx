'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '@/css/audit-log.module.css';
import { LuSearch, LuChevronUp, LuChevronDown, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

type AuditLog = {
  id: number;
  module?: string;
  recordName?: string;
  actionType?: string;
  performedBy?: string;
  actionDate?: string;
  changedFields?: Record<string, { old?: any; new?: any } | any>;
};

type SortKey = keyof Omit<AuditLog, 'changedFields'>;

const ROWS_PER_PAGE = 10;
const MODULE_ORDER: Record<string, number> = { EMPLOYEE: 1, SUPPLIER: 2, CUSTOMER: 3, INVENTORY: 4 };
const ACTION_ORDER: Record<string, number> = { ADD: 1, UPDATE: 2, ARCHIVE: 3 };

export default function AuditLog({
  role = 'Admin',
  onLogout,
  onBack
}: {
  role?: string;
  onLogout: () => void;
  onBack?: () => void;
}) {
  const s = styles as Record<string, string>;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' | null }>({
    key: 'actionDate',
    direction: 'desc'
  });

  // Fetch logs
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/audit-log')
      .then(res => res.json())
      .then(data => setLogs(data))
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc'
    }));
  };

  const normalizeModule = (mod?: string) => (mod ? mod.toUpperCase() : 'UNKNOWN');
  const normalizeAction = (action?: string) => {
    if (!action) return 'UNKNOWN';
    switch (action.toLowerCase()) {
      case 'add':
      case 'added':
        return 'ADD';
      case 'update':
      case 'updated':
        return 'UPDATE';
      case 'archive':
      case 'archived':
        return 'ARCHIVE';
      default:
        return 'UNKNOWN';
    }
  };

  // Filter logs
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return logs.filter(log => {
      const matchesBasic =
        (log.module?.toLowerCase() ?? '').includes(term) ||
        (log.recordName?.toLowerCase() ?? '').includes(term) ||
        (log.performedBy?.toLowerCase() ?? '').includes(term) ||
        (log.actionType?.toLowerCase() ?? '').includes(term);

      const matchesChangedFields = Object.entries(log.changedFields ?? {}).some(([field, value]) =>
        `${field} ${(typeof value === 'object' && value.new !== undefined ? value.new : value)}`.toLowerCase().includes(term)
      );

      return matchesBasic || matchesChangedFields;
    });
  }, [logs, searchTerm]);

  // Sort logs
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (!sortConfig.key || !sortConfig.direction) return arr;
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    return arr.sort((a, b) => {
      const { key } = sortConfig;
      switch (key) {
        case 'module': {
          const valA = MODULE_ORDER[normalizeModule(a.module)] ?? 999;
          const valB = MODULE_ORDER[normalizeModule(b.module)] ?? 999;
          return (valA - valB) * direction;
        }
        case 'actionType': {
          const valA = ACTION_ORDER[normalizeAction(a.actionType)] ?? 999;
          const valB = ACTION_ORDER[normalizeAction(b.actionType)] ?? 999;
          return (valA - valB) * direction;
        }
        case 'actionDate': {
          const dateA = a.actionDate ? new Date(a.actionDate).getTime() : 0;
          const dateB = b.actionDate ? new Date(b.actionDate).getTime() : 0;
          return (dateA - dateB) * direction;
        }
        case 'recordName':
        case 'performedBy': {
          const strA = (a[key] ?? '').toString().toLowerCase();
          const strB = (b[key] ?? '').toString().toLowerCase();
          return strA.localeCompare(strB) * direction;
        }
        default:
          return 0;
      }
    });
  }, [filtered, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  useEffect(() => setCurrentPage(1), [searchTerm]);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () =>
    Array.from({ length: totalPages }, (_, i) => (
      <div
        key={`page-${i + 1}`}
        className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
        onClick={() => changePage(i + 1)}
      >
        {i + 1}
      </div>
    ));

  if (isLoading) return <div className={s.loadingContainer}>Loading Audit Logs...</div>;

  const columns: { label: string; key: SortKey }[] = [
    { label: 'TIME & DATE', key: 'actionDate' },
    { label: 'RECORD', key: 'recordName' },
    { label: 'MODULE', key: 'module' },
    { label: 'ACTION', key: 'actionType' },
    { label: 'PERFORMED BY', key: 'performedBy' }
  ];

  return (
    <div className={s.container}>
      <div className={s.mainContent}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'inline-block',
              marginBottom: '1rem',
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#1a4263',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            ← Back
          </button>
        )}

        <div className={s.tableContainer}>
          <div className={s.header}>
            <h2 className={s.title}>Audit Logs</h2>
            <div className={s.searchWrapper}>
              <input
                className={s.searchInput}
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <LuSearch size={18} />
            </div>
          </div>

          <table className={s.table}>
            <colgroup>
              <col className={s.dateCol} />
              <col className={s.recordCol} />
              <col className={s.moduleCol} />
              <col className={s.actionCol} />
              <col className={s.performedByCol} />
              <col className={s.changedFieldsCol} />
            </colgroup>

            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)} className={s.sortableHeader}>
                    <div className={s.sortHeaderInner}>
                      <span>{col.label}</span>
                      <div className={s.sortIconsStack}>
                        <LuChevronUp
                          className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                        />
                        <LuChevronDown
                          className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                        />
                      </div>
                    </div>
                  </th>
                ))}
                <th>CHANGED FIELDS</th>
              </tr>
            </thead>

            <tbody>
              {paginated.length ? (
                paginated.map((log, i) => (
                  <tr key={`log-${log.id}-${currentPage}-${i}`} className={i % 2 ? s.altRow : ''}>
                    <td className={s.dateCol}>{log.actionDate ? new Date(log.actionDate).toLocaleString() : '-'}</td>
                    <td className={s.recordCol}>{log.recordName ?? '-'}</td>
                    <td className={s.moduleCol}>{log.module ?? '-'}</td>
                    <td className={s.actionCol}>{log.actionType ?? '-'}</td>
                    <td className={s.performedByCol}>{log.performedBy ?? '-'}</td>
                    <td className={s.changedFieldsCol}>
                      {log.changedFields
                        ? Object.entries(log.changedFields).map(([field, value], idx) => {
                            const oldVal = typeof value === 'object' && value.old !== undefined ? value.old : '-';
                            const newVal = typeof value === 'object' && value.new !== undefined ? value.new : value ?? '-';

                            return log.actionType?.toUpperCase() === 'UPDATE' ? (
                              <div key={`field-${field}-${idx}`} style={{ marginBottom: '0.5rem' }}>
                                <div>
                                  <strong>{field.replace(/_/g, ' ')}:</strong>{' '}
                                  <span className={s.newValue}><em>{newVal}</em></span>
                                </div>
                                <div className={s.oldValue}>OLD: {oldVal}</div>
                              </div>
                            ) : (
                              <div key={`field-${field}-${idx}`} style={{ marginBottom: '0.5rem' }}>
                                <strong>{field.replace(/_/g, ' ')}:</strong> <span className={s.newValue}>{newVal}</span>
                              </div>
                            );
                          })
                        : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className={s.footer}>
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}
            </div>
            {totalPages > 1 && (
              <div className={s.pagination}>
                <button className={s.nextBtn} onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}>
                  <LuChevronLeft />
                </button>
                {renderPageNumbers()}
                <button
                  className={s.nextBtn}
                  onClick={() => changePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <LuChevronRight />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
