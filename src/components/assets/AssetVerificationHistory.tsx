import React from 'react';
import type {
  PhysicalVerificationRecord,
  VerificationOutcomeEnum,
} from '../../types/verification.ts';
import { Button } from '../ui/Button.tsx';
import {
  ShieldCheck,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  User,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

interface AssetVerificationHistoryProps {
  verifications: PhysicalVerificationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
}

export function getOutcomeBadge(outcome: VerificationOutcomeEnum) {
  switch (outcome) {
    case 'VERIFIED_MATCH':
      return {
        label: 'VERIFIED MATCH',
        className: 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300',
        icon: CheckCircle2,
      };
    case 'LOCATION_MISMATCH':
      return {
        label: 'LOCATION MISMATCH',
        className: 'bg-amber-950/80 border-amber-600/70 text-amber-300',
        icon: AlertTriangle,
      };
    case 'USER_MISMATCH':
      return {
        label: 'USER MISMATCH',
        className: 'bg-orange-950/80 border-orange-600/70 text-orange-300',
        icon: AlertTriangle,
      };
    case 'STATUS_MISMATCH':
      return {
        label: 'STATUS MISMATCH',
        className: 'bg-purple-950/80 border-purple-600/70 text-purple-300',
        icon: AlertTriangle,
      };
    case 'NOT_FOUND':
      return {
        label: 'NOT FOUND',
        className: 'bg-rose-950/80 border-rose-600/70 text-rose-300',
        icon: AlertTriangle,
      };
    case 'DAMAGED':
      return {
        label: 'DAMAGED',
        className: 'bg-red-950/80 border-red-600/70 text-red-300',
        icon: AlertTriangle,
      };
    default:
      return {
        label: outcome,
        className: 'bg-zinc-800 border-zinc-700 text-zinc-300',
        icon: ShieldCheck,
      };
  }
}

export const AssetVerificationHistory: React.FC<AssetVerificationHistoryProps> = ({
  verifications,
  total,
  page,
  limit,
  totalPages,
  isLoading,
  onPageChange,
}) => {
  if (isLoading) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-zinc-400 text-xs font-mono">
        <Clock className="w-5 h-5 animate-spin text-emerald-400 mb-2" />
        Loading verification timeline...
      </div>
    );
  }

  if (verifications.length === 0) {
    return (
      <div className="py-6 px-4 text-center border border-dashed border-zinc-800 rounded-md bg-zinc-950/30">
        <ShieldCheck className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-xs text-zinc-400 font-mono">
          No physical verification records found for this asset.
        </p>
        <p className="text-[11px] text-zinc-500 mt-1">
          Click &ldquo;Record Physical Verification&rdquo; to log an inspection attempt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-zinc-800 rounded-md bg-zinc-950/50">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-900/80 text-[11px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
            <tr>
              <th scope="col" className="px-3.5 py-2.5">
                Outcome
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Inspection Date
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Precision
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Attempt Status
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Inspector
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Logged At
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {verifications.map((item) => {
              const badge = getOutcomeBadge(item.outcome);
              const BadgeIcon = badge.icon;

              // Format displayed inspection date faithfully without timezone shifts
              let formattedInspectionDate = '';
              if (item.datePrecision === 'DAY' && item.verifiedDay) {
                formattedInspectionDate = `${item.verifiedYear}-${String(item.verifiedMonth).padStart(
                  2,
                  '0'
                )}-${String(item.verifiedDay).padStart(2, '0')}`;
              } else {
                formattedInspectionDate = `${item.verifiedYear}-${String(item.verifiedMonth).padStart(
                  2,
                  '0'
                )}`;
              }

              return (
                <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                  {/* Outcome */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${badge.className}`}
                    >
                      <BadgeIcon className="w-3 h-3 shrink-0" />
                      {badge.label}
                    </span>
                  </td>

                  {/* Inspection Date */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-zinc-100 font-semibold">
                    {formattedInspectionDate}
                  </td>

                  {/* Precision */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        item.datePrecision === 'DAY'
                          ? 'bg-blue-950/70 border border-blue-700/60 text-blue-300'
                          : 'bg-purple-950/70 border border-purple-700/60 text-purple-300'
                      }`}
                    >
                      {item.datePrecision}
                    </span>
                  </td>

                  {/* Attempt Status (isSuccessful) */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    {item.isSuccessful ? (
                      <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Uncompleted
                      </span>
                    )}
                  </td>

                  {/* Inspector / Verified By */}
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-zinc-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-zinc-500" />
                      {item.verifiedBy}
                    </span>
                  </td>

                  {/* Logged At (Server Creation Timestamp) */}
                  <td
                    className="px-3.5 py-2.5 whitespace-nowrap text-zinc-400 text-[11px]"
                    title={`Record ID: ${item.id}\nCreated: ${item.createdAt}`}
                  >
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>

                  {/* Notes */}
                  <td className="px-3.5 py-2.5 text-zinc-300 max-w-xs truncate text-[11px]">
                    {item.notes || <span className="text-zinc-600 italic">None</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono pt-1">
          <div>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> (
            {total} total records)
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-2 py-1 h-auto text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-2 py-1 h-auto text-xs"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
