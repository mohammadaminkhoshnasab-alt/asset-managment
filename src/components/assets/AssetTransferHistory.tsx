import React from 'react';
import type { AssetTransferRecord } from '../../types/transfer.ts';
import { Button } from '../ui/Button.tsx';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Users,
  Building,
  DollarSign,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Ban,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AssetTransferHistoryProps {
  transfers: AssetTransferRecord[];
  activePendingTransfer?: AssetTransferRecord | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onInitiateComplete: (transfer: AssetTransferRecord) => void;
  onInitiateCancel: (transfer: AssetTransferRecord) => void;
  previewMode: boolean;
}

export const AssetTransferHistory: React.FC<AssetTransferHistoryProps> = ({
  transfers,
  activePendingTransfer,
  pagination,
  onPageChange,
  onInitiateComplete,
  onInitiateCancel,
  previewMode,
}) => {
  const activePending = activePendingTransfer !== undefined
    ? activePendingTransfer
    : transfers.find((t) => t.status === 'PENDING');
  const pastTransfers = transfers.filter((t) => t.status !== 'PENDING');

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} ${d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* 1. Active Pending Transfer Banner */}
      {activePending && (
        <div className="p-4 rounded-lg bg-[#141a24] border-2 border-amber-500/60 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#222c3d]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950/70 border border-amber-600/60 text-amber-300">
                PENDING TRANSFER
              </span>
              <span className="text-slate-300">
                Initiated by: <strong>@{activePending.createdBy || 'admin'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Requested: {formatDateTime(activePending.requestedAt)}</span>
            </div>
          </div>

          {/* eForm status */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">eForm Number:</span>
              {activePending.eformNumber ? (
                <span className="px-2 py-0.5 rounded bg-[#1c2433] border border-[#2d3a52] text-amber-300 font-bold">
                  {activePending.eformNumber}
                </span>
              ) : (
                <span className="text-slate-500 italic">
                  — (To be entered at completion)
                </span>
              )}
            </div>

            {activePending.notes && (
              <span className="text-slate-400 truncate max-w-md">
                Notes: <span className="text-slate-200">{activePending.notes}</span>
              </span>
            )}
          </div>

          {/* Requested dimension changes preview */}
          <div className="p-3 rounded bg-[#0d1016] border border-[#1d2330] space-y-1.5 text-[11px]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Requested Modifications (Current Asset assignments remain unchanged until completed):
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {activePending.changeAcOwner && (
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#11141c]">
                  <User className="w-3.5 h-3.5 text-[#ea8c34] shrink-0" />
                  <span className="text-slate-400">AC Owner:</span>
                  <span className="text-rose-400 line-through truncate max-w-[100px]">
                    {activePending.fromPerson?.fullName || 'Unassigned'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-emerald-400 font-semibold truncate">
                    {activePending.toPerson?.fullName || 'None (Clear)'}
                  </span>
                </div>
              )}

              {activePending.changeCurrentUser && (
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#11141c]">
                  <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-slate-400">User:</span>
                  <span className="text-rose-400 line-through truncate max-w-[100px]">
                    {activePending.fromCurrentUser?.fullName || 'Unassigned'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-emerald-400 font-semibold truncate">
                    {activePending.toCurrentUser?.fullName || 'None (Clear)'}
                  </span>
                </div>
              )}

              {activePending.changeDepartment && (
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#11141c]">
                  <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-slate-400">Dept:</span>
                  <span className="text-rose-400 line-through truncate max-w-[100px]">
                    {activePending.fromDepartment || 'None'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-emerald-400 font-semibold truncate">
                    {activePending.toDepartment || 'None'}
                  </span>
                </div>
              )}

              {activePending.changeCostCenter && (
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#11141c]">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-slate-400">CC:</span>
                  <span className="text-rose-400 line-through truncate max-w-[100px]">
                    {activePending.fromCostCenter || 'None'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-emerald-400 font-semibold truncate">
                    {activePending.toCostCenter || 'None'}
                  </span>
                </div>
              )}

              {activePending.changeLocation && (
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#11141c]">
                  <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="text-slate-400">Loc:</span>
                  <span className="text-rose-400 line-through truncate max-w-[100px]">
                    {activePending.fromLocation?.name || 'Unassigned'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-emerald-400 font-semibold truncate">
                    {activePending.toLocation?.name || 'None'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInitiateCancel(activePending)}
              leftIcon={<Ban className="w-3.5 h-3.5" />}
              disabled={previewMode}
            >
              Cancel Transfer
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onInitiateComplete(activePending)}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              disabled={previewMode}
            >
              Complete Transfer (eForm)
            </Button>
          </div>
        </div>
      )}

      {/* 2. Past Transfers Timeline */}
      <div className="space-y-3">
        {pastTransfers.length === 0 && !activePending ? (
          <div className="p-6 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1f2633] rounded">
            NO TRANSFER RECORDS ON FILE FOR THIS ASSET.
          </div>
        ) : (
          pastTransfers.map((t) => (
            <div
              key={t.id}
              className="p-3.5 rounded bg-[#0d1016] border border-[#1b202a] text-xs font-mono space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181d28] pb-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      t.status === 'COMPLETED'
                        ? 'bg-emerald-950/60 border border-emerald-800/50 text-emerald-300'
                        : 'bg-rose-950/60 border border-rose-800/50 text-rose-300'
                    }`}
                  >
                    {t.status}
                  </span>
                  {t.eformNumber && (
                    <span className="px-1.5 py-0.5 rounded bg-[#181d28] border border-[#283244] text-[#ea8c34] font-semibold">
                      eForm: {t.eformNumber}
                    </span>
                  )}
                  <span className="text-slate-400">@{t.createdBy || 'admin'}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-500">
                  <span>
                    {t.status === 'COMPLETED'
                      ? `Completed: ${formatDateTime(t.completedAt)}`
                      : `Cancelled: ${formatDateTime(t.cancelledAt)}`}
                  </span>
                </div>
              </div>

              {/* Dimension summary */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400 text-[11px]">
                {t.changeAcOwner && (
                  <div>
                    <span className="text-slate-500">AC Owner:</span>{' '}
                    <span className="text-slate-300">
                      {t.toPerson ? t.toPerson.fullName : 'Cleared (None)'}
                    </span>
                  </div>
                )}
                {t.changeCurrentUser && (
                  <div>
                    <span className="text-slate-500">User:</span>{' '}
                    <span className="text-slate-300">
                      {t.toCurrentUser ? t.toCurrentUser.fullName : 'Cleared (None)'}
                    </span>
                  </div>
                )}
                {t.changeDepartment && (
                  <div>
                    <span className="text-slate-500">Dept:</span>{' '}
                    <span className="text-slate-300">{t.toDepartment || 'None'}</span>
                  </div>
                )}
                {t.changeCostCenter && (
                  <div>
                    <span className="text-slate-500">CC:</span>{' '}
                    <span className="text-slate-300">{t.toCostCenter || 'None'}</span>
                  </div>
                )}
                {t.changeLocation && (
                  <div>
                    <span className="text-slate-500">Loc:</span>{' '}
                    <span className="text-slate-300">{t.toLocation?.name || 'None'}</span>
                  </div>
                )}
              </div>

              {t.notes && (
                <div className="text-[11px] text-slate-400 italic bg-[#0a0c10] p-2 rounded border border-[#161a22]">
                  {t.notes}
                </div>
              )}
            </div>
          ))
        )}

        {/* Bounded Transfer History Pagination Controls */}
        {pagination && pagination.totalPages > 1 && onPageChange && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 px-1 text-slate-400 text-xs border-t border-[#181d28]">
            <div className="text-[11px] text-slate-500">
              Showing page <strong className="text-slate-300">{pagination.page}</strong> of{' '}
              <strong className="text-slate-300">{pagination.totalPages}</strong> ({pagination.total} total transfers)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
