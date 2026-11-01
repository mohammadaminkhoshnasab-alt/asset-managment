/**
 * IT Asset Management - Hardware Assets View (Industrial Neo-Brutalist Redesign)
 * Scannable high-contrast tabular registry with practical columns,
 * comprehensive 15-field Asset Detail Drawer, role-based scope isolation,
 * and preserved IT Admin Handover & Return actions.
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
  Layers,
  ChevronRight,
  FileSpreadsheet,
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
  const [operationalFilter, setOperationalFilter] = useState<'All' | 'needs_review' | 'temp'>('All');

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
      console.error('Failed to load asset audit history:', err);
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
    scopedAssets = getSubordinateAssets(assets, employees, currentUser.name);
  } else if (currentUser.role === 'Employee') {
    scopedAssets = assets.filter((a) => a.personalCode === currentUser.personalCode);
  }

  // 2. Filter application
  const filteredAssets = scopedAssets.filter((asset) => {
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

    if (statusFilter !== 'All' && asset.status !== statusFilter) {
      return false;
    }

    if (labelFilter !== 'All' && asset.label !== labelFilter) {
      return false;
    }

    if (typeFilter !== 'All' && asset.type !== typeFilter) {
      return false;
    }

    if (operationalFilter === 'needs_review') {
      if (!isNeedsReview(asset.revision) || asset.status === 'Disposed') return false;
    } else if (operationalFilter === 'temp') {
      if (asset.status !== 'In Use' || !getActiveTemporaryHandover(asset.assetNumber)) return false;
    }

    return true;
  });

  const uniqueTypes = Array.from(new Set(assets.map((a) => a.type)));

  return (
    <div className="space-y-4">
      {/* Scope Context Banners for Non-Admin Roles */}
      {currentUser.role === 'Manager / Supervisor' && (
        <div className="flex items-center justify-between rounded-lg border border-[#D2C8B8] bg-[#E5DFD2] p-3 text-xs dark:border-[#2B323D] dark:bg-[#181C24] font-mono-tabular">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#E49C52] dark:bg-[#E7A45F]" />
            <span>
              <strong>SUPERVISOR SCOPE:</strong> Subordinate assets matched by manager: <em>{currentUser.name}</em>
            </span>
          </div>
          <span className="font-bold">{filteredAssets.length} SUBORDINATE ASSETS</span>
        </div>
      )}

      {currentUser.role === 'Employee' && (
        <div className="flex items-center justify-between rounded-lg border border-[#D2C8B8] bg-[#E5DFD2] p-3 text-xs dark:border-[#2B323D] dark:bg-[#181C24] font-mono-tabular">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#5D7F5F] dark:bg-[#668768]" />
            <span>
              <strong>PERSONAL INVENTORY:</strong> Assets assigned to Personal Code: <em>{currentUser.personalCode}</em>
            </span>
          </div>
          <span className="font-bold">{filteredAssets.length} ASSIGNED UNITS</span>
        </div>
      )}

      {/* Control Bar: Search & Status Filters */}
      <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3.5 dark:border-[#2B323D] dark:bg-[#12151B] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6E6960] dark:text-[#7C8797]" />
            <input
              type="text"
              placeholder="Search by Asset Number, Serial Number, Model, Assignee, AC Owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 py-2 pl-9 pr-4 text-xs font-mono-tabular text-[#141312] placeholder-[#6E6960] focus:border-[#E49C52] focus:bg-[#F8F4EC] focus:outline-none dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] dark:placeholder-[#7C8797] dark:focus:bg-[#1F242E]"
            />
          </div>

          {/* Quick IT Admin Action */}
          {currentUser.role === 'IT Admin' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setHandoverAssetTarget(undefined as any);
                  setIsHandoverModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded bg-[#E49C52] dark:bg-[#E7A45F] text-black px-3.5 py-2 text-xs font-bold font-industrial-display shadow-xs hover:brightness-105 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>REGISTER HANDOVER</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Bar: Status, Operational Flags, Type */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#D2C8B8] dark:border-[#2B323D]">
          {/* Exact Status Filters: All | In Use | Spare | Disposed */}
          <div className="flex items-center gap-1 p-0.5 bg-[#E5DFD2] rounded dark:bg-[#181C24]">
            {(['All', 'In Use', 'Spare', 'Disposed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-bold font-industrial-display rounded transition-all ${
                  statusFilter === status
                    ? 'bg-[#141312] text-[#F8F4EC] dark:bg-[#F2EFE9] dark:text-[#12151B] shadow-xs'
                    : 'text-[#6E6960] hover:text-[#141312] dark:text-[#7C8797] dark:hover:text-[#F2EFE9]'
                }`}
              >
                {status.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Operational Indicators & Type Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
            {/* Operational Flags */}
            <button
              onClick={() =>
                setOperationalFilter(operationalFilter === 'needs_review' ? 'All' : 'needs_review')
              }
              className={`px-2.5 py-1 rounded border text-xs font-bold transition-all ${
                operationalFilter === 'needs_review'
                  ? 'bg-[#B2534C] text-black border-[#B2534C] dark:bg-[#B85D56] dark:text-black dark:border-[#B85D56]'
                  : 'border-[#D2C8B8] text-[#6E6960] hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:text-[#7C8797]'
              }`}
            >
              ! NEEDS REVIEW
            </button>

            <button
              onClick={() =>
                setOperationalFilter(operationalFilter === 'temp' ? 'All' : 'temp')
              }
              className={`px-2.5 py-1 rounded border text-xs font-bold transition-all ${
                operationalFilter === 'temp'
                  ? 'bg-[#D2761F] text-black border-[#D2761F] dark:bg-[#D9822B] dark:text-black dark:border-[#D9822B]'
                  : 'border-[#D2C8B8] text-[#6E6960] hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:text-[#7C8797]'
              }`}
            >
              TEMP HANDOVERS
            </button>

            {/* Hardware Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded border border-[#D2C8B8] bg-[#E5DFD2] py-1 px-2 text-xs font-mono-tabular text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] focus:outline-none"
            >
              <option value="All">ALL TYPES ({uniqueTypes.length})</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Tabular Registry (Scannable Practical Columns) */}
      <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] dark:border-[#2B323D] dark:bg-[#12151B] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#D2C8B8] bg-[#E5DFD2] dark:border-[#2B323D] dark:bg-[#181C24] font-industrial-display uppercase text-[11px] font-black text-[#6E6960] dark:text-[#7C8797]">
                <th className="py-3 px-3.5 sticky left-0 z-10 bg-[#E5DFD2] dark:bg-[#181C24] border-r border-[#D2C8B8] dark:border-[#2B323D]">
                  ASSET NUMBER
                </th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3">INDICATORS</th>
                <th className="py-3 px-3">MODEL</th>
                <th className="py-3 px-3">TYPE</th>
                <th className="py-3 px-3">SERIAL NUMBER</th>
                <th className="py-3 px-3">CURRENT ASSIGNEE</th>
                <th className="py-3 px-3">LOCATION</th>
                <th className="py-3 px-3 text-right">ACTION</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#D2C8B8] dark:divide-[#2B323D]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#6E6960] dark:text-[#7C8797] font-mono-tabular">
                    No hardware assets match the active filter criteria.
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
                      className="cursor-pointer hover:bg-[#E5DFD2]/60 dark:hover:bg-[#181C24]/80 transition-colors"
                    >
                      {/* 1. Asset Number (Sticky Left) */}
                      <td className="py-2.5 px-3.5 font-mono-tabular font-bold text-[#141312] dark:text-[#F2EFE9] sticky left-0 z-10 bg-[#F8F4EC] dark:bg-[#12151B] border-r border-[#D2C8B8] dark:border-[#2B323D]">
                        {asset.assetNumber}
                      </td>

                      {/* 2. Exact Status Tag */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-industrial-display uppercase ${
                            asset.status === 'In Use'
                              ? 'bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black'
                              : asset.status === 'Spare'
                              ? 'bg-[#486888] text-white dark:bg-[#4A607A] dark:text-white'
                              : 'bg-[#6E6960]/20 text-[#6E6960] dark:bg-[#7C8797]/30 dark:text-[#C5CCD6]'
                          }`}
                        >
                          {asset.status === 'In Use' && <CheckCircle2 className="h-3 w-3" />}
                          {asset.status}
                        </span>
                      </td>

                      {/* 3. Operational Indicators */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {needsReview && (
                            <span
                              title="Revision date exceeds 6 months"
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold font-mono-tabular bg-[#B2534C] text-black dark:bg-[#B85D56] dark:text-black"
                            >
                              REV
                            </span>
                          )}
                          {isTemp && (
                            <span
                              title="Temporary loaner agreement active"
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold font-mono-tabular bg-[#D2761F] text-black dark:bg-[#D9822B] dark:text-black"
                            >
                              TEMP
                            </span>
                          )}
                          {!needsReview && !isTemp && (
                            <span className="text-[#6E6960] dark:text-[#7C8797] font-mono-tabular text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* 4. Model */}
                      <td className="py-2.5 px-3 font-semibold text-[#141312] dark:text-[#F2EFE9]">
                        {asset.model}
                      </td>

                      {/* 5. Type */}
                      <td className="py-2.5 px-3 text-[#6E6960] dark:text-[#7C8797]">
                        {asset.type}
                      </td>

                      {/* 6. Serial Number */}
                      <td className="py-2.5 px-3 font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                        {asset.serialNumber}
                      </td>

                      {/* 7. Assignee */}
                      <td className="py-2.5 px-3">
                        {asset.currentUserName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#141312] dark:text-[#F2EFE9]">
                              {asset.currentUserName}
                            </span>
                            <span className="font-mono-tabular text-[10px] text-[#6E6960] dark:text-[#7C8797]">
                              ({asset.personalCode})
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono-tabular text-[#6E6960] dark:text-[#7C8797] italic">
                            Unassigned (Stock)
                          </span>
                        )}
                      </td>

                      {/* 8. Location */}
                      <td className="py-2.5 px-3 text-[#6E6960] dark:text-[#7C8797]">
                        {asset.location}
                      </td>

                      {/* 9. Action (Existing Inspect Action) */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(asset);
                          }}
                          className="rounded p-1 text-[#6E6960] hover:text-[#141312] hover:bg-[#E5DFD2] dark:text-[#7C8797] dark:hover:text-[#F2EFE9] dark:hover:bg-[#181C24] transition-colors"
                          title="Inspect complete 15-field spec and audit log"
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

      {/* Asset Detail & Audit History Drawer */}
      {activeDrawerAsset && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={closeDrawer} />
          <div className="relative flex w-full max-w-xl flex-col bg-[#F8F4EC] dark:bg-[#12151B] border-l border-[#D2C8B8] dark:border-[#2B323D] shadow-2xl animate-in slide-in-from-right duration-150 overflow-y-auto">
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D2C8B8] bg-[#F8F4EC]/95 px-6 py-4 dark:border-[#2B323D] dark:bg-[#12151B]/95 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-base font-black text-[#141312] dark:text-[#F2EFE9]">
                  {activeDrawerAsset.assetNumber}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-black font-industrial-display uppercase ${
                    activeDrawerAsset.status === 'In Use'
                      ? 'bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black'
                      : activeDrawerAsset.status === 'Spare'
                      ? 'bg-[#486888] text-white dark:bg-[#4A607A] dark:text-white'
                      : 'bg-[#6E6960]/20 text-[#6E6960] dark:bg-[#7C8797]/30 dark:text-[#C5CCD6]'
                  }`}
                >
                  {activeDrawerAsset.status}
                </span>
              </div>

              <button
                onClick={closeDrawer}
                className="rounded p-1 text-[#6E6960] hover:text-[#141312] hover:bg-[#E5DFD2] dark:text-[#7C8797] dark:hover:text-[#F2EFE9] dark:hover:bg-[#181C24]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body: 15 Approved Fields Grid */}
            <div className="p-6 space-y-6">
              {/* Preserved IT Admin Handover & Return Actions */}
              {currentUser.role === 'IT Admin' && (
                <div className="flex items-center gap-3">
                  {activeDrawerAsset.status === 'In Use' && (
                    <button
                      onClick={() => {
                        setReturnAssetTarget(activeDrawerAsset);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded bg-[#B2534C] text-black dark:bg-[#B85D56] dark:text-black py-2.5 px-4 text-xs font-black font-industrial-display shadow-xs hover:brightness-105 transition-all"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>RETURN DEVICE TO IT STOCK</span>
                    </button>
                  )}
                  {activeDrawerAsset.status === 'Spare' && (
                    <button
                      onClick={() => {
                        setHandoverAssetTarget(activeDrawerAsset);
                        setIsHandoverModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black py-2.5 px-4 text-xs font-black font-industrial-display shadow-xs hover:brightness-105 transition-all"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      <span>ISSUE HANDOVER TO EMPLOYEE</span>
                    </button>
                  )}
                </div>
              )}

              {/* Complete 15 Field Specification Sheet */}
              <div className="rounded-lg border border-[#D2C8B8] bg-[#E5DFD2]/60 p-4 dark:border-[#2B323D] dark:bg-[#181C24] text-xs space-y-3 font-mono-tabular">
                <div className="flex items-center justify-between pb-2 border-b border-[#D2C8B8] dark:border-[#2B323D]">
                  <h3 className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
                    APPROVED ASSET SPECIFICATIONS (15 FIELDS)
                  </h3>
                  <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797]">ENTERPRISE SCHEMA</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">1. Asset Number</span>
                    <p className="font-bold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.assetNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">2. Serial Number</span>
                    <p className="font-bold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.serialNumber}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">3. Type</span>
                    <p className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.type}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">4. Model</span>
                    <p className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.model}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">5. AC Owner</span>
                    <p className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.acOwner}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">6. Status</span>
                    <p className="font-bold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.status}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">7. Current User</span>
                    <p className="font-semibold text-[#141312] dark:text-[#F2EFE9]">
                      {activeDrawerAsset.currentUserName || 'Unassigned (Stock)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">8. Personal Code</span>
                    <p className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.personalCode || '—'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">9. Department</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.department}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">10. Cost Center (CC)</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.cc}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">11. eForm Number</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.eFormNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">12. Physical Label</span>
                    <p className="font-bold text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.label}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">13. Location</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{activeDrawerAsset.location}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">14. Last Revision</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">
                      {new Date(activeDrawerAsset.revision).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="col-span-2 pt-2 border-t border-[#D2C8B8] dark:border-[#2B323D]">
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">15. General Asset Comment</span>
                    <p className="text-xs text-[#141312] dark:text-[#F2EFE9] mt-0.5 bg-[#F8F4EC] dark:bg-[#12151B] p-2.5 rounded border border-[#D2C8B8] dark:border-[#2B323D]">
                      {activeDrawerAsset.comment || 'No general comments recorded.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chronological Audit Event History */}
              <div className="space-y-3">
                <h3 className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
                  EVENT-SOURCED AUDIT TIMELINE
                </h3>

                {isLoadingHistory ? (
                  <div className="p-4 text-center text-xs font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                    Loading audit events...
                  </div>
                ) : drawerHistory.length === 0 ? (
                  <div className="rounded border border-[#D2C8B8] p-4 text-center text-xs font-mono-tabular text-[#6E6960] dark:border-[#2B323D] dark:text-[#7C8797]">
                    No historical handovers or returns recorded for this unit.
                  </div>
                ) : (
                  <div className="space-y-3 font-mono-tabular">
                    {drawerHistory.map((evt) => (
                      <div
                        key={evt.id}
                        className="rounded border border-[#D2C8B8] bg-[#E5DFD2]/40 p-3.5 dark:border-[#2B323D] dark:bg-[#181C24] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              evt.eventType === 'handover'
                                ? 'bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black'
                                : 'bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black'
                            }`}
                          >
                            {evt.eventType}
                          </span>
                          <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797]">
                            {new Date(evt.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-[#141312] dark:text-[#F2EFE9]">
                          Employee: {evt.employeeName} ({evt.personalCode})
                        </p>
                        <p className="text-[11px] text-[#6E6960] dark:text-[#7C8797]">
                          Recorded by: {evt.itUserName} · Condition: <strong>{evt.condition}</strong>
                        </p>
                        {evt.comments && (
                          <p className="text-[11px] text-[#6E6960] dark:text-[#7C8797] italic">
                            "{evt.comments}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals for IT Admin Workflows */}
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

      {isHandoverModalOpen && (
        <HandoverModal
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
