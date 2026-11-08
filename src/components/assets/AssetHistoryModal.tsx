import React, { useState, useEffect, useCallback } from 'react';
import type { AssetAuditEventRecord } from '../../types/asset.ts';
import { Button } from '../ui/Button.tsx';
import {
  History,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Activity,
  AlertCircle,
  FileCode,
} from 'lucide-react';

interface AssetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  assetModel: string;
}

export const AssetHistoryModal: React.FC<AssetHistoryModalProps> = ({
  isOpen,
  onClose,
  assetId,
  assetModel,
}) => {
  const [events, setEvents] = useState<AssetAuditEventRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = 10;

  const fetchHistory = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/assets/${assetId}/history?page=${targetPage}&limit=${limit}`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const json = await res.json();
          setEvents(json.data || []);
          if (json.pagination) {
            setPage(json.pagination.page);
            setTotalPages(json.pagination.totalPages);
            setTotal(json.pagination.total);
          }
        } else if (res.status === 401) {
          setError('Authentication required. Session expired or unauthenticated.');
        } else {
          setError(`Failed to retrieve audit history (Status: ${res.status}).`);
        }
      } catch {
        setError('Network error while retrieving immutable audit events.');
      } finally {
        setIsLoading(false);
      }
    },
    [assetId, limit]
  );

  useEffect(() => {
    if (isOpen) {
      fetchHistory(1);
    }
  }, [isOpen, fetchHistory]);

  if (!isOpen) return null;

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} ${d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })}`;
    } catch {
      return iso;
    }
  };

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return 'null (empty)';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-history-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg bg-[#11141c] border border-[#232b3b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1d2330] flex items-center justify-between bg-[#0d1016]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#181d28] border border-[#262f40] text-[#ea8c34]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <span className="block font-mono text-[10px] tracking-widest text-[#ea8c34] uppercase font-semibold">
                PHASE P04 APPEND-ONLY AUDIT LOG
              </span>
              <h2
                id="audit-history-modal-title"
                className="text-sm font-semibold tracking-wide text-slate-100 uppercase"
              >
                Audit Trail: {assetModel}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#181d28] cursor-pointer"
            aria-label="Close audit history modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
            <span>
              TOTAL COMMITTED AUDIT EVENTS: <strong className="text-slate-200">{total}</strong>
            </span>
            <span>
              ASSET UUID: <strong className="text-[#ea8c34]">{assetId}</strong>
            </span>
          </div>

          {error && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400">
              <div className="w-6 h-6 border-2 border-[#1f2633] border-t-[#ea8c34] rounded-full animate-spin mx-auto mb-2" />
              <span>RETRIEVING AUDIT LEDGER...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1f2633] rounded">
              NO AUDIT EVENTS RECORDED FOR THIS ASSET RECORD.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-md bg-[#0d1016] border border-[#1d2330] space-y-3"
                >
                  {/* Event Meta Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono border-b border-[#1b202a] pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          event.action === 'CREATE'
                            ? 'bg-emerald-950/60 border border-emerald-800/50 text-emerald-300'
                            : event.action === 'TRANSFER'
                            ? 'bg-purple-950/60 border border-purple-800/50 text-purple-300'
                            : event.action === 'TRANSFER_CANCELLED'
                            ? 'bg-rose-950/60 border border-rose-800/50 text-rose-300'
                            : 'bg-sky-950/60 border border-sky-800/50 text-sky-300'
                        }`}
                      >
                        {event.action}
                      </span>
                      {event.eformNumber && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#1c2433] border border-[#2d3a52] text-[#ea8c34] font-semibold">
                          eForm: {event.eformNumber}
                        </span>
                      )}
                      <span className="text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-[#ea8c34]" />
                        <span>{event.actor || 'admin'}</span>
                      </span>
                      <span className="text-slate-500">
                        [{event.source || 'API'}]
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatTimestamp(event.timestamp)}</span>
                    </div>
                  </div>

                  {/* Changed Fields Summary */}
                  <div className="text-xs font-mono space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Activity className="w-3.5 h-3.5 text-[#ea8c34]" />
                      <span>
                        MODIFIED FIELDS ({event.changedFields?.length || 0}):{' '}
                        <strong className="text-slate-200">
                          {event.changedFields?.join(', ') || 'None'}
                        </strong>
                      </span>
                    </div>

                    {/* Diff / Delta Table */}
                    {(event.action === 'UPDATE' || event.action === 'TRANSFER') && event.beforeValues && event.afterValues && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono border-collapse">
                          <thead>
                            <tr className="border-b border-[#1b202a] text-slate-500">
                              <th className="py-1 px-2 font-medium">FIELD</th>
                              <th className="py-1 px-2 font-medium text-rose-400">BEFORE</th>
                              <th className="py-1 px-2 font-medium text-emerald-400">AFTER</th>
                            </tr>
                          </thead>
                          <tbody>
                            {event.changedFields?.map((field) => (
                              <tr key={field} className="border-b border-[#151a24]/50">
                                <td className="py-1 px-2 text-slate-300 font-semibold">
                                  {field}
                                </td>
                                <td className="py-1 px-2 text-rose-300/80 break-all">
                                  {renderValue(event.beforeValues?.[field])}
                                </td>
                                <td className="py-1 px-2 text-emerald-300 break-all">
                                  {renderValue(event.afterValues?.[field])}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {event.action === 'CREATE' && event.afterValues && (
                      <div className="p-2.5 rounded bg-[#0a0c10] border border-[#181d28] text-[11px] font-mono text-slate-400 space-y-1">
                        <span className="text-emerald-400 font-semibold block">
                          INITIAL SPECIFICATION SNAPSHOT:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
                          {Object.entries(event.afterValues).map(([key, val]) => (
                            <div key={key} className="truncate">
                              <span className="text-slate-500">{key}:</span>{' '}
                              <span className="text-slate-200">{renderValue(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="px-5 py-3 border-t border-[#1d2330] bg-[#0d1016] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="text-slate-400">
            PAGE <span className="text-slate-200 font-semibold">{page}</span> OF{' '}
            <span className="text-slate-200 font-semibold">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchHistory(page - 1)}
              disabled={page <= 1 || isLoading}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchHistory(page + 1)}
              disabled={page >= totalPages || isLoading}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
