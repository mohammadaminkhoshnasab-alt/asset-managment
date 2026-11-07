import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Filter,
  Columns,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Plus,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  ShieldAlert,
  Inbox,
  Check,
} from 'lucide-react';
import type {
  AssetListItem,
  AssetListResponse,
  ColumnDefinition,
  GridFilterGroup,
} from '../../types/asset.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { Button } from '../ui/Button.tsx';
import { AdvancedFilterBuilder } from './AdvancedFilterBuilder.tsx';
import { ActiveFilterSummary } from './ActiveFilterSummary.tsx';

interface AllAssetsViewProps {
  onNavigate: (route: string) => void;
}

const ALL_COLUMNS: ColumnDefinition[] = [
  { id: 'assetNumber', label: 'Asset #', defaultVisible: true, sortable: true, sortField: 'assetNumber', minWidth: '120px' },
  { id: 'serialNumber', label: 'Serial #', defaultVisible: true, sortable: true, sortField: 'serialNumber', minWidth: '130px' },
  { id: 'model', label: 'Model', defaultVisible: true, sortable: true, sortField: 'model', minWidth: '160px' },
  { id: 'type', label: 'Type', defaultVisible: true, sortable: true, sortField: 'type', minWidth: '110px' },
  { id: 'status', label: 'Status', defaultVisible: true, sortable: true, sortField: 'status', minWidth: '120px' },
  { id: 'location', label: 'Location', defaultVisible: true, sortable: true, sortField: 'location', minWidth: '130px' },
  { id: 'acOwner', label: 'AC Owner', defaultVisible: true, sortable: true, sortField: 'acOwner', minWidth: '140px' },
  { id: 'currentUser', label: 'Current User', defaultVisible: true, sortable: true, sortField: 'currentUser', minWidth: '140px' },
  { id: 'updatedAt', label: 'Updated At', defaultVisible: true, sortable: true, sortField: 'updatedAt', minWidth: '140px' },
  { id: 'deviceHealth', label: 'Device Health', defaultVisible: false, sortable: true, sortField: 'deviceHealth', minWidth: '120px' },
  { id: 'acOwnerPersonalCode', label: 'Owner Code', defaultVisible: false, sortable: false, minWidth: '110px' },
  { id: 'currentUsername', label: 'Username', defaultVisible: false, sortable: false, minWidth: '110px' },
  { id: 'department', label: 'Department', defaultVisible: false, sortable: true, sortField: 'department', minWidth: '130px' },
  { id: 'costCenter', label: 'Cost Center', defaultVisible: false, sortable: true, sortField: 'costCenter', minWidth: '120px' },
  { id: 'label', label: 'Label / Tag', defaultVisible: false, sortable: true, sortField: 'label', minWidth: '120px' },
  { id: 'createdAt', label: 'Created At', defaultVisible: false, sortable: true, sortField: 'createdAt', minWidth: '140px' },
  { id: 'id', label: 'UUID', defaultVisible: false, sortable: false, minWidth: '140px' },
];

function readInitialStateFromUrl() {
  if (typeof window === 'undefined') {
    return {
      q: '',
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortOrder: 'desc' as 'asc' | 'desc',
      quickStatus: '',
      filters: undefined as GridFilterGroup | undefined,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '25', 10) || 25));
  const sortBy = params.get('sortBy') || 'updatedAt';
  const sortOrder = (params.get('sortOrder') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
  const quickStatus = params.get('status') || '';

  let filters: GridFilterGroup | undefined;
  const rawFilters = params.get('filters');
  if (rawFilters) {
    try {
      filters = JSON.parse(rawFilters);
    } catch {
      // Ignored if malformed
    }
  }

  return { q, page, pageSize, sortBy, sortOrder, quickStatus, filters };
}

export const AllAssetsView: React.FC<AllAssetsViewProps> = ({ onNavigate }) => {
  const { status: authStatus, previewMode } = useAuth();
  const initial = useRef(readInitialStateFromUrl());

  const [searchQuery, setSearchQuery] = useState(initial.current.q);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.current.q);
  const [page, setPage] = useState(initial.current.page);
  const [pageSize, setPageSize] = useState(initial.current.pageSize);
  const [sortBy, setSortBy] = useState(initial.current.sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initial.current.sortOrder);
  const [quickStatus, setQuickStatus] = useState(initial.current.quickStatus);
  const [advancedFilters, setAdvancedFilters] = useState<GridFilterGroup | undefined>(
    initial.current.filters
  );

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((col) => {
      init[col.id] = col.defaultVisible;
    });
    return init;
  });

  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== debouncedSearch) {
        setDebouncedSearch(searchQuery);
        setPage(1); // Reset to page 1 on new search
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  // Synchronize query parameters to URL
  const syncStateToUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();

    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (page > 1) params.set('page', String(page));
    if (pageSize !== 25) params.set('pageSize', String(pageSize));
    if (sortBy !== 'updatedAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    if (quickStatus) params.set('status', quickStatus);
    if (advancedFilters && advancedFilters.rules.length > 0) {
      params.set('filters', JSON.stringify(advancedFilters));
    }

    const queryStr = params.toString();
    const newUrl = queryStr ? `/assets?${queryStr}` : '/assets';

    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [debouncedSearch, page, pageSize, sortBy, sortOrder, quickStatus, advancedFilters]);

  useEffect(() => {
    syncStateToUrl();
  }, [syncStateToUrl]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const state = readInitialStateFromUrl();
      setSearchQuery(state.q);
      setDebouncedSearch(state.q);
      setPage(state.page);
      setPageSize(state.pageSize);
      setSortBy(state.sortBy);
      setSortOrder(state.sortOrder);
      setQuickStatus(state.quickStatus);
      setAdvancedFilters(state.filters);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch real assets from GET /api/assets
  const fetchAssets = useCallback(async () => {
    // If in preview mode without authentication, do not call private API
    if (previewMode && authStatus !== 'authenticated') {
      setIsLoading(false);
      setAssets([]);
      setTotalCount(0);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    if (debouncedSearch.trim()) {
      params.set('q', debouncedSearch.trim());
    }
    if (quickStatus) {
      params.set('status', quickStatus);
    }
    if (advancedFilters && advancedFilters.rules.length > 0) {
      params.set('filters', JSON.stringify(advancedFilters));
    }

    try {
      const res = await fetch(`/api/assets?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const json: AssetListResponse = await res.json();

      if (res.ok && json.status === 'ok') {
        setAssets(json.data || []);
        setTotalCount(json.pagination.total);
        setTotalPages(json.pagination.totalPages);
      } else {
        setErrorMessage(json.error || `Server responded with status ${res.status}`);
      }
    } catch (err: any) {
      setErrorMessage('Unable to reach backend service or PostgreSQL database.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, quickStatus, advancedFilters, previewMode, authStatus]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setQuickStatus('');
    setAdvancedFilters(undefined);
    setPage(1);
  };

  const handleToggleColumn = (colId: string) => {
    setVisibleColumns((prev) => {
      const count = Object.values(prev).filter(Boolean).length;
      // Prevent hiding all columns
      if (prev[colId] && count <= 1) return prev;
      return { ...prev, [colId]: !prev[colId] };
    });
  };

  const handleResetColumns = () => {
    const init: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((col) => {
      init[col.id] = col.defaultVisible;
    });
    setVisibleColumns(init);
  };

  const activeFilterCount =
    (debouncedSearch.trim() ? 1 : 0) +
    (quickStatus ? 1 : 0) +
    (advancedFilters ? advancedFilters.rules.length : 0);

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-4">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#1d2330]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-[#ea8c34] uppercase font-bold">
              // WORKSPACE: ALL ASSETS [P08]
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-wider text-slate-100 uppercase font-mono mt-1">
            Hardware Fleet Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            PostgreSQL-backed equipment inventory grid with search, advanced Boolean filtering, and deep audit links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAssets}
            disabled={isLoading}
            leftIcon={<RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            REFRESH
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('/assets/new')}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            NEW ASSET
          </Button>
        </div>
      </div>

      {/* Preview Inspection Mode Notice */}
      {previewMode && authStatus !== 'authenticated' && (
        <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-200 text-xs font-mono flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider block text-amber-300">
              PREVIEW INSPECTION MODE — NON-PERSISTENT GRID SHELL
            </span>
            <p className="text-amber-200/80 text-[11px] leading-relaxed">
              Live PostgreSQL database connectivity and authenticated operator credentials are required to query the real fleet inventory.
              In accordance with P08-AC06, no artificial sample records are fabricated. Log in with the server administrator account to view real data.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#11141c] border border-[#1d2330] rounded-lg">
        {/* Left: Global Search & Quick Status */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Global Search Input */}
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search model, asset #, serial #, label..."
              className="w-full bg-[#0d1017] border border-[#273244] rounded text-xs text-slate-200 pl-9 pr-8 py-2 font-mono focus:border-[#ea8c34] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                title="Clear input"
                aria-label="Clear search input"
              >
                ×
              </button>
            )}
          </div>

          {/* Quick Status Dropdown */}
          <select
            value={quickStatus}
            onChange={(e) => {
              setQuickStatus(e.target.value);
              setPage(1);
            }}
            className="bg-[#0d1017] border border-[#273244] text-slate-300 text-xs font-mono rounded px-3 py-2 focus:border-[#ea8c34] focus:outline-none cursor-pointer"
          >
            <option value="">STATUS: ALL</option>
            <option value="IN_USE">STATUS: IN_USE</option>
            <option value="SPARE">STATUS: SPARE</option>
            <option value="DISPOSED">STATUS: DISPOSED</option>
            <option value="UNKNOWN">STATUS: UNKNOWN</option>
          </select>

          {/* Advanced Filter Builder Button */}
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-mono border transition-colors cursor-pointer ${
              advancedFilters && advancedFilters.rules.length > 0
                ? 'bg-[#ea8c34]/15 border-[#ea8c34]/50 text-[#ea8c34]'
                : 'bg-[#181d28] border-[#273244] text-slate-300 hover:bg-[#202736]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>ADVANCED FILTERS</span>
            {advancedFilters && advancedFilters.rules.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#ea8c34] text-slate-950 font-bold text-[10px] flex items-center justify-center">
                {advancedFilters.rules.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: Column Visibility Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnDropdown((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#181d28] border border-[#273244] hover:bg-[#202736] text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            <Columns className="w-3.5 h-3.5 text-slate-400" />
            <span>COLUMNS</span>
            <span className="text-slate-400 text-[10px]">
              ({Object.values(visibleColumns).filter(Boolean).length}/{ALL_COLUMNS.length})
            </span>
          </button>

          {showColumnDropdown && (
            <div className="absolute right-0 mt-1.5 w-60 bg-[#0d1017] border border-[#273244] rounded-lg shadow-2xl z-40 p-2 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1d2330] px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Visible Columns
                </span>
                <button
                  type="button"
                  onClick={handleResetColumns}
                  className="text-[10px] text-[#ea8c34] hover:underline cursor-pointer"
                >
                  Reset Default
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1">
                {ALL_COLUMNS.map((col) => {
                  const isChecked = visibleColumns[col.id];
                  return (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#181e2b] cursor-pointer text-slate-300 select-none text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleColumn(col.id)}
                        className="rounded border-[#344258] bg-[#141a24] text-[#ea8c34] focus:ring-0 focus:outline-none"
                      />
                      <span className={isChecked ? 'text-slate-200' : 'text-slate-400'}>
                        {col.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Summary Strip */}
      <ActiveFilterSummary
        searchQuery={debouncedSearch}
        quickStatus={quickStatus}
        filters={advancedFilters}
        onClearSearch={() => {
          setSearchQuery('');
          setDebouncedSearch('');
          setPage(1);
        }}
        onClearQuickStatus={() => {
          setQuickStatus('');
          setPage(1);
        }}
        onRemoveRule={(field, op) => {
          if (!advancedFilters) return;
          const cleanGroup = (group: GridFilterGroup): GridFilterGroup | null => {
            const filtered = group.rules
              .map((r) => {
                if ('operator' in r && ('AND' === r.operator || 'OR' === r.operator)) {
                  return cleanGroup(r as GridFilterGroup);
                }
                const rule = r as { field: string; operator: string };
                if (rule.field === field && rule.operator === op) {
                  return null;
                }
                return r;
              })
              .filter((r): r is any => r !== null);
            if (filtered.length === 0) return null;
            return { operator: group.operator, rules: filtered };
          };
          setAdvancedFilters(cleanGroup(advancedFilters) || undefined);
          setPage(1);
        }}
        onClearAll={handleClearAllFilters}
      />

      {/* Error State Banner */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-200 text-xs font-mono flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAssets}>
            RETRY QUERY
          </Button>
        </div>
      )}

      {/* Main Inventory Data Grid */}
      <div className="rounded-lg bg-[#11141c] border border-[#1d2330] overflow-hidden shadow-xl">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-[#0b0e14] border-b border-[#1d2330] text-slate-400 uppercase text-[11px] tracking-wider select-none">
                {ALL_COLUMNS.filter((col) => visibleColumns[col.id]).map((col) => {
                  const isSorted = sortBy === (col.sortField || col.id);
                  return (
                    <th
                      key={col.id}
                      style={{ minWidth: col.minWidth }}
                      className="px-4 py-3 font-semibold"
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.sortField || col.id)}
                          className="flex items-center gap-1.5 hover:text-slate-100 transition-colors cursor-pointer group"
                        >
                          <span>{col.label}</span>
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#ea8c34]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[#ea8c34]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-200" />
                          )}
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-right font-semibold w-24">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1b202a]">
              {isLoading ? (
                // Loading Skeleton Rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse bg-[#11141c]">
                    {ALL_COLUMNS.filter((col) => visibleColumns[col.id]).map((col) => (
                      <td key={`skel-col-${col.id}`} className="px-4 py-3.5">
                        <div className="h-4 bg-[#1b2230] rounded w-3/4" />
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-4 bg-[#1b2230] rounded w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : assets.length === 0 ? (
                // Empty / Zero Results Rows
                <tr>
                  <td
                    colSpan={ALL_COLUMNS.filter((col) => visibleColumns[col.id]).length + 1}
                    className="p-12 text-center"
                  >
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                      <div className="p-3 rounded-full bg-[#181d28] border border-[#273244] text-slate-400">
                        <Inbox className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
                        {activeFilterCount > 0 ? 'No Matching Assets Found' : 'Inventory Registry Empty'}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-mono">
                        {activeFilterCount > 0
                          ? 'No hardware records in the PostgreSQL database match your current search and filter criteria.'
                          : 'No IT equipment has been registered in the database yet.'}
                      </p>
                      {activeFilterCount > 0 ? (
                        <Button variant="outline" size="sm" onClick={handleClearAllFilters}>
                          CLEAR ALL CRITERIA
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onNavigate('/assets/new')}
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                        >
                          REGISTER FIRST ASSET
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                // Actual Data Rows
                assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => onNavigate(`/assets/${asset.id}`)}
                    className="hover:bg-[#161b26] transition-colors cursor-pointer group"
                  >
                    {visibleColumns.assetNumber && (
                      <td className="px-4 py-3 text-slate-200 font-semibold">
                        {asset.assetNumber ? (
                          <span className="text-[#ea8c34] group-hover:underline">
                            {asset.assetNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.serialNumber && (
                      <td className="px-4 py-3 text-slate-300">
                        {asset.serialNumber || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.model && (
                      <td className="px-4 py-3 text-slate-100 font-medium max-w-[200px] truncate" title={asset.model}>
                        {asset.model}
                      </td>
                    )}

                    {visibleColumns.type && (
                      <td className="px-4 py-3 text-slate-300">
                        {asset.type?.name || (
                          <span className="text-slate-400 italic">Unspecified</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.status && (
                      <td className="px-4 py-3">
                        <StatusBadge status={asset.status} size="sm" />
                      </td>
                    )}

                    {visibleColumns.location && (
                      <td className="px-4 py-3 text-slate-300 max-w-[150px] truncate" title={asset.location?.name || ''}>
                        {asset.location?.name || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.acOwner && (
                      <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate" title={asset.acOwner?.fullName || ''}>
                        {asset.acOwner ? (
                          <div>
                            <span className="block text-slate-200">{asset.acOwner.fullName}</span>
                            {asset.acOwner.personalCode && (
                              <span className="block text-[10px] text-slate-400">
                                #{asset.acOwner.personalCode}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.currentUser && (
                      <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate" title={asset.currentUser?.fullName || ''}>
                        {asset.currentUser ? (
                          <div>
                            <span className="block text-slate-200">{asset.currentUser.fullName}</span>
                            {asset.currentUser.username && (
                              <span className="block text-[10px] text-slate-400">
                                @{asset.currentUser.username}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.updatedAt && (
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(asset.updatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    )}

                    {visibleColumns.deviceHealth && (
                      <td className="px-4 py-3 text-slate-300">
                        {asset.deviceHealth?.name || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.acOwnerPersonalCode && (
                      <td className="px-4 py-3 text-slate-300">
                        {asset.acOwner?.personalCode || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.currentUsername && (
                      <td className="px-4 py-3 text-slate-300">
                        {asset.currentUser?.username ? (
                          <span>@{asset.currentUser.username}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.department && (
                      <td className="px-4 py-3 text-slate-300">
                        {asset.department || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.costCenter && (
                      <td className="px-4 py-3 text-slate-300">
                        {asset.costCenter || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.label && (
                      <td className="px-4 py-3 text-slate-300 max-w-[140px] truncate" title={asset.label || ''}>
                        {asset.label || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.createdAt && (
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(asset.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    )}

                    {visibleColumns.id && (
                      <td className="px-4 py-3 text-slate-400 text-[10px] font-mono">
                        {asset.id.slice(0, 8)}...
                      </td>
                    )}

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(`/assets/${asset.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c2331] hover:bg-[#253044] text-slate-200 border border-[#2b374c] text-[11px] font-mono transition-colors cursor-pointer"
                        title="View Asset Details"
                        aria-label={`View details for asset ${asset.assetNumber || asset.model}`}
                      >
                        <span>VIEW</span>
                        <ExternalLink className="w-3 h-3 text-[#ea8c34]" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0d1017] border-t border-[#1d2330] font-mono text-xs">
          {/* Item count */}
          <div className="text-slate-400">
            {totalCount > 0 ? (
              <span>
                Showing <strong className="text-slate-200">{startItem}</strong>–<strong className="text-slate-200">{endItem}</strong> of{' '}
                <strong className="text-slate-200">{totalCount}</strong> assets
              </span>
            ) : (
              <span>0 assets found</span>
            )}
          </div>

          {/* Page Size & Navigation Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-[#181d28] border border-[#273244] text-slate-200 px-2 py-1 rounded text-xs focus:border-[#ea8c34] focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page <= 1 || isLoading}
                className="p-1.5 rounded bg-[#181d28] border border-[#273244] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="First Page"
                aria-label="First page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="p-1.5 rounded bg-[#181d28] border border-[#273244] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 text-slate-300 text-[11px]">
                Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="p-1.5 rounded bg-[#181d28] border border-[#273244] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || isLoading}
                className="p-1.5 rounded bg-[#181d28] border border-[#273244] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Last Page"
                aria-label="Last page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Builder Modal */}
      <AdvancedFilterBuilder
        isOpen={showFilterModal}
        initialFilters={advancedFilters}
        onApply={(filters) => {
          setAdvancedFilters(filters);
          setPage(1);
        }}
        onClose={() => setShowFilterModal(false)}
      />
    </div>
  );
};
