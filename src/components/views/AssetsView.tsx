/**
 * IT Asset Management - Hardware Assets View
 * Tabular inventory workspace showcasing all 15 approved fields, operational indicators,
 * subordinate scope isolation, and detail audit drawer with return/handover workflows.
 */

import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Laptop,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  ShieldCheck,
  Building2,
  Calendar,
  FileText,
  Tag,
  Hash,
  Eye,
  Plus,
} from 'lucide-react';
import {
  Asset,
  AssetHistoryEvent,
  AssetLabel,
  AssetStatus,
  Employee,
} from '../../types/asset.ts';
import {
  assetService,
  getActiveTemporaryHandover,
  getSubordinateAssets,
  isNeedsReview,
} from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';
import { ReturnModal } from '../modals/ReturnModal.tsx';
import { HandoverModal } from '../modals/HandoverModal.tsx';

export const AssetsView: React.FC = () => {
  const {
    currentUser,
    selectedAssetNumber,
    setSelectedAssetNumber,
    refreshTrigger,
    triggerRefresh,
  } = useApp();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | AssetStatus>('All');
  const [labelFilter, setLabelFilter] = useState<'All' | AssetLabel>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [operationalFilter, setOperationalFilter] = useState<'All' | 'needs_review' | 'temp' | 'pending'>('All');

  // Modals state
  const [returnAssetTarget, setReturnAssetTarget] = useState<Asset | null>(null);
  const [handoverAssetTarget, setHandoverAssetTarget] = useState<Asset | null>(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);

  // Detail Drawer state
  const [activeDrawerAsset, setActiveDrawerAsset] = useState<Asset | null>(null);
  const [drawerHistory, setDrawerHistory] = useState<AssetHistoryEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    async function load() {
      const [allAssets, allEmployees] = await Promise.all([
        assetService.getAssets(),
        assetService.getEmployees(),
      ]);
      setAssets(allAssets);
      setEmployees(allEmployees);

      if (selectedAssetNumber) {
        const found = allAssets.find((a) => a.assetNumber === selectedAssetNumber);
        if (found) {
          openDrawer(found);
        }
      }
    }
    load();
  }, [refreshTrigger, selectedAssetNumber]);

  const openDrawer = async (asset: Asset) => {
    setActiveDrawerAsset(asset);
    setIsLoadingHistory(true);
    try {
      const history = await assetService.getAssetHistory(asset.assetNumber);
      setDrawerHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const closeDrawer = () => {
    setActiveDrawerAsset(null);
    setSelectedAssetNumber(null);
  };

  // 1. Role-based scope isolation
  let scopedAssets = assets;
  if (currentUser.role === 'Manager / Supervisor') {
    // Visibility based strictly on direct subordinate relationships via directManager
    scopedAssets = getSubordinateAssets(assets, employees, currentUser.name);
  } else if (currentUser.role === 'Employee') {
    scopedAssets = assets.filter((a) => a.personalCode === currentUser.personalCode);
  }

  // 2. Filter application
  const filteredAssets = scopedAssets.filter((asset) => {
    // Search query
    const search = searchQuery.toLowerCase().trim();
    if (search) {
      const match =
        asset.assetNumber.toLowerCase().includes(search) ||
        asset.serialNumber.toLowerCase().includes(search) ||
        asset.model.toLowerCase().includes(search) ||
        asset.currentUserName.toLowerCase().includes(search) ||
        asset.personalCode.toLowerCase().includes(search) ||
        asset.acOwner.toLowerCase().includes(search) ||
        asset.location.toLowerCase().includes(search);
      if (!match) return false;
    }

    // Status filter (In Use, Spare, Disposed)
    if (statusFilter !== 'All' && asset.status !== statusFilter) {
      return false;
    }

    // Label filter (Yes, No)
    if (labelFilter !== 'All' && asset.label !== labelFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'All' && asset.type !== typeFilter) {
      return false;
    }

    // Operational indicator filter
    if (operationalFilter === 'needs_review') {
      if (!isNeedsReview(asset.revision) || asset.status === 'Disposed') return false;
    } else if (operationalFilter === 'temp') {
      if (asset.status !== 'In Use' || !getActiveTemporaryHandover(asset.assetNumber)) return false;
    }

    return true;
  });

  const uniqueTypes = Array.from(new Set(assets.map((a) => a.type)));
  const spareAssets = assets.filter((a) => a.status === 'Spare');

  return (
    <div className="space-y-4">
      {/* Scope banner for Manager or Employee */}
      {currentUser.role === 'Manager / Supervisor' && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Supervisor Scope Active:</strong> Viewing devices assigned to your direct subordinates (matched by manager name: <em>{currentUser.name}</em>).
            </span>
          </div>
          <span className="font-semibold tabular-nums">{filteredAssets.length} Subordinate Assets</span>
        </div>
      )}

      {currentUser.role === 'Employee' && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Personal Equipment View:</strong> Showing assets assigned to Personal Code <em>{currentUser.personalCode}</em>.
            </span>
          </div>
          <span className="font-semibold tabular-nums">{filteredAssets.length} Assigned Devices</span>
        </div>
      )}

      {/* Control Bar: Search & Status Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Asset Number, Serial Number, Model, Assignee, AC Owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-850"
            />
          </div>

          {/* Quick IT Actions for IT Admin */}
          {currentUser.role === 'IT Admin' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setHandoverAssetTarget(undefined as any);
                  setIsHandoverModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Register Handover</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Segmented Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Exact Status Filters: In Use | Spare | Disposed */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg dark:bg-slate-800">
            {(['All', 'In Use', 'Spare', 'Disposed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Operational Indicator Badges Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px] font-medium hidden md:inline">Operational Flags:</span>
            <button
              onClick={() =>
                setOperationalFilter(operationalFilter === 'needs_review' ? 'All' : 'needs_review')
              }
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                operationalFilter === 'needs_review'
                  ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-semibold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              Needs Review Only
            </button>
            <button
              onClick={() => setOperationalFilter(operationalFilter === 'temp' ? 'All' : 'temp')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                operationalFilter === 'temp'
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-semibold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              TEMP Loans Only
            </button>

            {/* Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-white py-1 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="All">All Types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Label Filter ('Yes' | 'No') */}
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value as any)}
              className="rounded-md border border-slate-200 bg-white py-1 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="All">All Labels</option>
              <option value="Yes">Label: Yes</option>
              <option value="No">Label: No</option>
            </select>
          </div>
        </div>
      </div>

      {/* 15-Field Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-3 px-4 sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">
                  Asset Number
                </th>
                <th scope="col" className="py-3 px-3">Status</th>
                <th scope="col" className="py-3 px-3">Operational Indicators</th>
                <th scope="col" className="py-3 px-3">Model</th>
                <th scope="col" className="py-3 px-3">Type</th>
                <th scope="col" className="py-3 px-3">Serial Number</th>
                <th scope="col" className="py-3 px-3">Current Assignee</th>
                <th scope="col" className="py-3 px-3">Personal Code</th>
                <th scope="col" className="py-3 px-3">AC Owner (Accounting/Audit)</th>
                <th scope="col" className="py-3 px-3">Department</th>
                <th scope="col" className="py-3 px-3">Cost Center (CC)</th>
                <th scope="col" className="py-3 px-3">eForm #</th>
                <th scope="col" className="py-3 px-3">Label</th>
                <th scope="col" className="py-3 px-3">Revision Date</th>
                <th scope="col" className="py-3 px-3">Location</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No hardware assets matched the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const needsReview = asset.status !== 'Disposed' && isNeedsReview(asset.revision);
                  const isTemp = asset.status === 'In Use' && !!getActiveTemporaryHandover(asset.assetNumber);

                  return (
                    <tr
                      key={asset.assetNumber}
                      onClick={() => openDrawer(asset)}
                      className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Asset Number (Sticky) */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white sticky left-0 z-10 bg-white dark:bg-slate-900">
                        {asset.assetNumber}
                      </td>

                      {/* 2. Status (In Use | Spare | Disposed) */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            asset.status === 'In Use'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : asset.status === 'Spare'
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {asset.status === 'In Use' && <CheckCircle2 className="h-3 w-3" />}
                          {asset.status}
                        </span>
                      </td>

                      {/* 3. Operational Indicators */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {needsReview && (
                            <span
                              title="Revision date exceeds 6 months"
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900"
                            >
                              Needs Review
                            </span>
                          )}
                          {isTemp && (
                            <span
                              title="Temporary loaner agreement"
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900"
                            >
                              TEMP Handover
                            </span>
                          )}
                          {!needsReview && !isTemp && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* 4. Model */}
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">
                        {asset.model}
                      </td>

                      {/* 5. Type */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {asset.type}
                      </td>

                      {/* 6. Serial Number */}
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {asset.serialNumber}
                      </td>

                      {/* 7. Current Assignee */}
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {asset.currentUserName || <span className="text-slate-400">Unassigned (Stock)</span>}
                      </td>

                      {/* 8. Personal Code */}
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {asset.personalCode || '—'}
                      </td>

                      {/* 9. AC Owner (Official Accounting/Audit Owner) */}
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {asset.acOwner}
                      </td>

                      {/* 10. Department */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {asset.department}
                      </td>

                      {/* 11. Cost Center (CC) */}
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {asset.cc}
                      </td>

                      {/* 12. eForm Number */}
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {asset.eFormNumber}
                      </td>

                      {/* 13. Label (Yes / No) */}
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            asset.label === 'Yes'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {asset.label}
                        </span>
                      </td>

                      {/* 14. Revision Date */}
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {new Date(asset.revision).toLocaleDateString()}
                      </td>

                      {/* 15. Location */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {asset.location}
                      </td>

                      {/* Row Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(asset);
                          }}
                          className="rounded p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="View complete asset history"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Audit History Drawer */}
      {activeDrawerAsset && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={closeDrawer} />
          <div className="relative flex w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 overflow-y-auto">
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {activeDrawerAsset.assetNumber}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      activeDrawerAsset.status === 'In Use'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : activeDrawerAsset.status === 'Spare'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {activeDrawerAsset.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeDrawerAsset.model} · {activeDrawerAsset.type}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body: 15 Approved Fields Grid */}
            <div className="p-6 space-y-6">
              {/* Primary Actions based on status */}
              {currentUser.role === 'IT Admin' && (
                <div className="flex items-center gap-3">
                  {activeDrawerAsset.status === 'In Use' && (
                    <button
                      onClick={() => {
                        setReturnAssetTarget(activeDrawerAsset);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Return Device to IT Stock</span>
                    </button>
                  )}
                  {activeDrawerAsset.status === 'Spare' && (
                    <button
                      onClick={() => {
                        setHandoverAssetTarget(activeDrawerAsset);
                        setIsHandoverModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      <span>Issue Handover to Employee</span>
                    </button>
                  )}
                </div>
              )}

              {/* Complete 15 Field Specification Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 text-xs space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Approved Asset Specifications (15 Fields)
                </h3>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="text-slate-400">Asset Number</span>
                    <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {activeDrawerAsset.assetNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Serial Number</span>
                    <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {activeDrawerAsset.serialNumber}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400">Type</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{activeDrawerAsset.type}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Model</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{activeDrawerAsset.model}</p>
                  </div>

                  {/* Explicit AC Owner definition */}
                  <div className="col-span-2 rounded-lg bg-blue-50/60 p-2.5 border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      AC Owner (Accounting / Audit Owner)
                    </span>
                    <p className="text-xs font-semibold text-blue-950 dark:text-blue-100 mt-0.5">
                      {activeDrawerAsset.acOwner}
                    </p>
                    <p className="text-[10px] text-blue-700/70 dark:text-blue-300/70 mt-0.5">
                      The official registered owner in corporate audit books (separate from current user/department).
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400">Current User Name</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {activeDrawerAsset.currentUserName || 'Unassigned Stock'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Personal Code</span>
                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {activeDrawerAsset.personalCode || '—'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400">Department</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{activeDrawerAsset.department}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Cost Center (CC)</span>
                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200">{activeDrawerAsset.cc}</p>
                  </div>

                  <div>
                    <span className="text-slate-400">eForm Number</span>
                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {activeDrawerAsset.eFormNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Physical Label Attached</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {activeDrawerAsset.label}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400">Revision Check Date</span>
                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {new Date(activeDrawerAsset.revision).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Current Location</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{activeDrawerAsset.location}</p>
                  </div>

                  <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400">General Asset Comment (Preserved during returns)</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5 italic">
                      "{activeDrawerAsset.comment || 'No general comments recorded.'}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Chronological Audit Timeline: Handovers & Returns */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Chronological Event History</span>
                  <span className="text-[10px] text-slate-400">Handovers &amp; Returns</span>
                </h3>

                {isLoadingHistory ? (
                  <p className="text-xs text-slate-400">Loading audit history...</p>
                ) : drawerHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No historical transactions logged for this unit.</p>
                ) : (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {drawerHistory.map((event) => (
                      <div key={event.id} className="relative flex items-start gap-3 pl-7">
                        <div
                          className={`absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                            event.eventType === 'handover' ? 'bg-blue-600' : 'bg-emerald-600'
                          }`}
                        />
                        <div className="w-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {event.eventType === 'handover' ? (
                                <span className="text-blue-600 dark:text-blue-400">
                                  {event.type} Handover
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Stockroom Return
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {new Date(
                                event.eventType === 'handover' ? event.handoverDate : event.returnDate
                              ).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-slate-600 dark:text-slate-300">
                            Employee: <strong>{event.employeeName}</strong> ({event.personalCode})
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                            <span>
                              IT User: <strong>{event.itUserName}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Condition: <strong>{event.condition}</strong>
                            </span>
                          </div>

                          {event.comments && (
                            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-100 dark:border-slate-800">
                              "{event.comments}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnAssetTarget && (
        <ReturnModal
          asset={returnAssetTarget}
          onClose={() => setReturnAssetTarget(null)}
          onSuccess={() => {
            setReturnAssetTarget(null);
            closeDrawer();
            triggerRefresh();
          }}
        />
      )}

      {/* Handover Modal */}
      {isHandoverModalOpen && (
        <HandoverModal
          availableAssets={spareAssets}
          employees={employees}
          preselectedAsset={handoverAssetTarget || undefined}
          onClose={() => {
            setIsHandoverModalOpen(false);
            setHandoverAssetTarget(null);
          }}
          onSuccess={() => {
            setIsHandoverModalOpen(false);
            setHandoverAssetTarget(null);
            closeDrawer();
            triggerRefresh();
          }}
        />
      )}
    </div>
  );
};
