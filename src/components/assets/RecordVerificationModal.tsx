import React, { useState, useEffect } from 'react';
import type { AssetDetails } from '../../types/asset.ts';
import type {
  CreateVerificationPayload,
  DatePrecisionEnum,
  PhysicalVerificationRecord,
  VerificationOutcomeEnum,
} from '../../types/verification.ts';
import { VERIFICATION_OUTCOME_OPTIONS } from '../../types/verification.ts';
import { Button } from '../ui/Button.tsx';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import {
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Lock,
  X,
  CheckCircle2,
  Check,
  HelpCircle,
  Clock,
  MapPin,
  User,
  Info,
  RotateCcw,
} from 'lucide-react';

interface RecordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDetails;
  csrfToken: string | null;
  previewMode: boolean;
  onVerificationSuccess: (created: PhysicalVerificationRecord) => Promise<void>;
  onUncertainNetworkState: (draft: CreateVerificationPayload) => void;
}

const MONTH_NAMES = [
  '01 - January',
  '02 - February',
  '03 - March',
  '04 - April',
  '05 - May',
  '06 - June',
  '07 - July',
  '08 - August',
  '09 - September',
  '10 - October',
  '11 - November',
  '12 - December',
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getMaxDays(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

export const RecordVerificationModal: React.FC<RecordVerificationModalProps> = ({
  isOpen,
  onClose,
  asset,
  csrfToken,
  previewMode,
  onVerificationSuccess,
  onUncertainNetworkState,
}) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();

  // Form States
  const [outcome, setOutcome] = useState<VerificationOutcomeEnum>('VERIFIED_MATCH');
  const [isSuccessful, setIsSuccessful] = useState<boolean>(true);
  const [datePrecision, setDatePrecision] = useState<DatePrecisionEnum>('DAY');
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [day, setDay] = useState<number>(currentDay);
  const [notes, setNotes] = useState<string>('');

  // UI / Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [networkUncertainWarning, setNetworkUncertainWarning] = useState<boolean>(false);
  const [isBlindResubmitBlocked, setIsBlindResubmitBlocked] = useState<boolean>(false);
  const [isCheckingHistory, setIsCheckingHistory] = useState<boolean>(false);
  const [reconciliationStatus, setReconciliationStatus] = useState<{
    type: 'possible_match' | 'no_match_in_window' | 'error';
    title: string;
    message: string;
    details?: string;
    inspectedCount?: number;
    totalRecords?: number;
    inspectedAt?: string;
    matchedRecord?: PhysicalVerificationRecord;
  } | null>(null);
  const [duplicateRiskAcknowledged, setDuplicateRiskAcknowledged] = useState<boolean>(false);

  // Synchronize day within allowed max days if month or year changes
  useEffect(() => {
    if (datePrecision === 'DAY') {
      const maxDays = getMaxDays(year, month);
      if (day > maxDays) {
        setDay(maxDays);
      }
    }
  }, [year, month, datePrecision, day]);

  if (!isOpen) return null;

  const validateClientSide = (): boolean => {
    const errors: Record<string, string> = {};

    if (!outcome) {
      errors.outcome = 'Outcome is required.';
    }

    if (!year || year < 1900 || year > 2100) {
      errors.year = 'Year must be between 1900 and 2100.';
    }

    if (!month || month < 1 || month > 12) {
      errors.month = 'Month must be between 1 and 12.';
    }

    if (datePrecision === 'DAY') {
      const maxDays = getMaxDays(year, month);
      if (!day || day < 1 || day > maxDays) {
        errors.day = `Day must be between 1 and ${maxDays} for month ${month}/${year}.`;
      }
    }

    if (notes && notes.length > 1000) {
      errors.notes = 'Notes cannot exceed 1000 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCheckVerificationHistory = async () => {
    setIsCheckingHistory(true);
    setErrorMessage(null);
    setDuplicateRiskAcknowledged(false);
    try {
      const res = await fetch(`/api/assets/${asset.id}/verifications?page=1&limit=10`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setReconciliationStatus({
          type: 'error',
          title: 'Incomplete / Failed Read',
          message: `Server returned HTTP ${res.status} when checking verification history.`,
          details: 'Unable to verify server history. Outcome remains UNVERIFIED. Blind resubmission remains locked.',
        });
        return;
      }
      const json = await res.json().catch(() => ({}));
      const records: PhysicalVerificationRecord[] = json.data || [];
      const totalRecords = json.pagination?.total ?? records.length;
      const inspectedAt = new Date().toLocaleTimeString();

      // Find any potential record with matching date and outcome
      const matched = records.find((r) => {
        const matchOutcome = r.outcome === outcome;
        const matchYear = r.verifiedYear === year;
        const matchMonth = r.verifiedMonth === month;
        const matchDay = datePrecision === 'DAY' ? r.verifiedDay === day : r.verifiedDay === null;
        return matchOutcome && matchYear && matchMonth && matchDay;
      });

      if (matched) {
        setReconciliationStatus({
          type: 'possible_match',
          title: 'POSSIBLE MATCH FOUND (Non-Definitive)',
          message: `Inspected Page 1 (10 of ${totalRecords} total records) at ${inspectedAt}. Found a verification record with matching date and outcome (${matched.outcome} on ${matched.verifiedYearMonth || matched.verifiedYear}, ID: ${matched.id.slice(0, 8)}...).`,
          details: 'Notice: Without a per-request idempotency contract, this potential match cannot definitively prove whether your recent POST committed or this is an existing observation. Server outcome remains UNVERIFIED. Review the record or acknowledge duplicate risk before retrying.',
          inspectedCount: records.length,
          totalRecords,
          inspectedAt,
          matchedRecord: matched,
        });
      } else {
        setReconciliationStatus({
          type: 'no_match_in_window',
          title: 'NO MATCH IN INSPECTED WINDOW (Non-Definitive)',
          message: `Inspected Page 1 (${records.length} records of ${totalRecords} total records) at ${inspectedAt}. No record matching outcome and date was found in the 10 most recent records.`,
          details: 'Notice: Absence from the 10 most recent records does NOT definitively prove whether your POST committed on the server. Server outcome remains UNVERIFIED. Your draft is preserved below. To submit again, explicitly acknowledge the potential duplicate risk below.',
          inspectedCount: records.length,
          totalRecords,
          inspectedAt,
        });
      }
    } catch {
      setReconciliationStatus({
        type: 'error',
        title: 'Network Read Error',
        message: 'Network connection failed while checking verification history.',
        details: 'Server could not be reached. State remains UNVERIFIED. Blind resubmission remains locked.',
      });
    } finally {
      setIsCheckingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (previewMode) {
      setErrorMessage(
        'Preview Inspection Mode is active. Mutating verification records is disabled.'
      );
      return;
    }

    if (isBlindResubmitBlocked && !duplicateRiskAcknowledged) {
      setErrorMessage(
        'Blind re-submission is locked following an uncertain transmission. Please check verification history and explicitly acknowledge duplicate-record risk before submitting again.'
      );
      return;
    }

    if (!validateClientSide()) {
      return;
    }

    const payload: CreateVerificationPayload = {
      outcome,
      isSuccessful,
      datePrecision,
      verifiedYear: year,
      verifiedMonth: month,
      verifiedDay: datePrecision === 'DAY' ? day : null,
      notes: notes.trim().length > 0 ? notes.trim() : null,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assets/${asset.id}/verifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 201 && data.status === 'ok') {
        // Confirmed save on server
        setIsBlindResubmitBlocked(false);
        setNetworkUncertainWarning(false);
        setDuplicateRiskAcknowledged(false);
        await onVerificationSuccess(data.data);
        onClose();
      } else if (response.status === 400) {
        setErrorMessage(data.error || 'Invalid verification submission.');
        if (data.field) {
          setFieldErrors((prev) => ({ ...prev, [data.field]: data.error }));
        }
      } else if (response.status === 401) {
        setErrorMessage('Authentication session expired. Please log in again.');
      } else if (response.status === 403) {
        setErrorMessage('CSRF security token missing or invalid. Please refresh the page.');
      } else if (response.status === 404) {
        setErrorMessage(`Asset '${asset.id}' not found.`);
      } else {
        setErrorMessage(data.error || `Server error (${response.status}). Could not record verification.`);
      }
    } catch {
      // Network interrupted during transmission: outcome is uncertain.
      // Retain draft and inform user truthfully; block blind resubmission.
      setNetworkUncertainWarning(true);
      setIsBlindResubmitBlocked(true);
      setDuplicateRiskAcknowledged(false);
      setReconciliationStatus(null);
      setErrorMessage(
        'Network connection interrupted during save. The verification record may or may not have reached the server. Blind re-submission is locked to prevent duplicates. Please check verification history and review server state before retrying.'
      );
      onUncertainNetworkState(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOutcomeMeta = VERIFICATION_OUTCOME_OPTIONS.find((o) => o.value === outcome);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-verification-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="record-verification-title"
                className="text-base font-semibold text-zinc-100 uppercase tracking-wider"
              >
                Record Physical Verification
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Asset: {asset.model} ({asset.assetNumber || 'No Tag'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 rounded hover:bg-zinc-800/60"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* Read-Only Current Asset Context Card */}
          <div className="p-3.5 bg-zinc-900/40 border border-zinc-800 rounded-md space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                Current Authoritative Baseline (Context Only)
              </span>
              <StatusBadge status={asset.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="p-2 bg-zinc-950/60 border border-zinc-800/70 rounded">
                <div className="text-[10px] text-zinc-500 font-mono uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-zinc-400" />
                  Recorded Location
                </div>
                <div className="font-medium text-zinc-200 truncate mt-0.5">
                  {asset.location ? asset.location.name : 'Unassigned'}
                </div>
              </div>

              <div className="p-2 bg-zinc-950/60 border border-zinc-800/70 rounded">
                <div className="text-[10px] text-zinc-500 font-mono uppercase flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  Recorded Current User
                </div>
                <div className="font-medium text-zinc-200 truncate mt-0.5">
                  {asset.currentUser ? asset.currentUser.fullName : 'Unassigned'}
                </div>
              </div>

              <div className="p-2 bg-zinc-950/60 border border-zinc-800/70 rounded">
                <div className="text-[10px] text-zinc-500 font-mono uppercase flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  Recorded AC Owner
                </div>
                <div className="font-medium text-zinc-200 truncate mt-0.5">
                  {asset.acOwner ? asset.acOwner.fullName : 'Unassigned'}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 italic pt-1 border-t border-zinc-800/50">
              * Note: Recording a mismatch documents the physical inspection result truthfully. It will NOT
              automatically reassign location, owner, or status.
            </p>
          </div>

          {/* Reconciliation Status: Possible Match Found */}
          {reconciliationStatus?.type === 'possible_match' && (
            <div
              role="alert"
              className="p-3.5 bg-amber-950/70 border border-amber-600/80 rounded-md text-amber-200 text-xs space-y-2.5"
            >
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                {reconciliationStatus.title}
              </div>
              <p className="leading-relaxed font-mono text-[11px]">
                {reconciliationStatus.message}
              </p>
              {reconciliationStatus.details && (
                <p className="text-[10px] text-zinc-400 leading-relaxed font-mono bg-zinc-900/60 p-2 rounded border border-zinc-800">
                  {reconciliationStatus.details}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {reconciliationStatus.matchedRecord && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (reconciliationStatus.matchedRecord) {
                        await onVerificationSuccess(reconciliationStatus.matchedRecord);
                      }
                      onClose();
                    }}
                    className="text-xs font-mono text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                  >
                    Accept & View Possible Match
                  </Button>
                )}
              </div>
              <label className="flex items-start gap-2 pt-2 border-t border-amber-800/50 cursor-pointer text-amber-200">
                <input
                  type="checkbox"
                  checked={duplicateRiskAcknowledged}
                  onChange={(e) => setDuplicateRiskAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded border-amber-600 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-[11px] font-mono leading-tight">
                  I have reviewed the server history above and understand that resubmitting carries a risk of creating a duplicate verification record.
                </span>
              </label>
            </div>
          )}

          {/* Reconciliation Status: No Match in Inspected Window */}
          {reconciliationStatus?.type === 'no_match_in_window' && (
            <div
              role="status"
              className="p-3.5 bg-blue-950/60 border border-blue-600/70 rounded-md text-blue-200 text-xs space-y-2.5 font-mono text-[11px]"
            >
              <div className="flex items-center gap-1.5 font-bold text-blue-300">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                {reconciliationStatus.title}
              </div>
              <p className="leading-relaxed">{reconciliationStatus.message}</p>
              {reconciliationStatus.details && (
                <p className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-900/60 p-2 rounded border border-zinc-800">
                  {reconciliationStatus.details}
                </p>
              )}
              <label className="flex items-start gap-2 pt-2 border-t border-blue-800/50 cursor-pointer text-blue-200">
                <input
                  type="checkbox"
                  checked={duplicateRiskAcknowledged}
                  onChange={(e) => setDuplicateRiskAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded border-blue-500 bg-zinc-900 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-[11px] font-mono leading-tight">
                  I have reviewed the server history above and understand that resubmitting carries a risk of creating a duplicate verification record.
                </span>
              </label>
            </div>
          )}

          {/* Reconciliation Status: Error */}
          {reconciliationStatus?.type === 'error' && (
            <div
              role="alert"
              className="p-3 bg-red-950/60 border border-red-700/80 rounded-md text-red-200 text-xs space-y-1.5"
            >
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                {reconciliationStatus.title}
              </div>
              <p className="leading-relaxed font-mono text-[11px]">
                {reconciliationStatus.message}
              </p>
              {reconciliationStatus.details && (
                <p className="text-[10px] text-zinc-400 font-mono">
                  {reconciliationStatus.details}
                </p>
              )}
              <label className="flex items-start gap-2 pt-2 border-t border-red-800/50 cursor-pointer text-red-200">
                <input
                  type="checkbox"
                  checked={duplicateRiskAcknowledged}
                  onChange={(e) => setDuplicateRiskAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded border-red-600 bg-zinc-900 text-red-500 focus:ring-red-500"
                />
                <span className="text-[11px] font-mono leading-tight">
                  I understand that history read failed and resubmitting carries a risk of creating a duplicate record.
                </span>
              </label>
            </div>
          )}

          {/* Uncertain Network Warning Banner with Safe Reconciliation Action */}
          {networkUncertainWarning && (
            <div
              role="alert"
              className="p-3.5 bg-amber-950/60 border border-amber-600/80 rounded-md text-amber-200 text-xs space-y-2"
            >
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                Transmission Outcome Uncertain — Re-submission Locked
              </div>
              <p className="leading-relaxed font-mono text-[11px]">
                A network interruption occurred during save. Your draft is preserved below. Blind duplicate re-submission
                is locked to prevent duplicate records. Please check the server&apos;s authoritative history before retrying.
              </p>
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCheckVerificationHistory}
                  disabled={isCheckingHistory || isSubmitting}
                  className="flex items-center gap-1.5 text-xs text-amber-200 border-amber-600/70 hover:bg-amber-900/40 font-mono"
                >
                  {isCheckingHistory ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      Checking Verification History...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Check Verification History
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* General Error Banner */}
          {errorMessage && !networkUncertainWarning && (
            <div
              role="alert"
              className="p-3 bg-red-950/60 border border-red-700/80 rounded-md text-red-200 text-xs flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-mono text-xs">{errorMessage}</div>
            </div>
          )}

          {/* 1. Verification Outcome */}
          <div className="space-y-1.5">
            <label
              htmlFor="verification-outcome-select"
              className="block text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300"
            >
              Verification Outcome <span className="text-red-400">*</span>
            </label>
            <select
              id="verification-outcome-select"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as VerificationOutcomeEnum)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              disabled={isSubmitting}
            >
              {VERIFICATION_OUTCOME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedOutcomeMeta && (
              <p className="text-[11px] text-zinc-400 pt-0.5 font-mono">
                {selectedOutcomeMeta.description}
              </p>
            )}
            {fieldErrors.outcome && (
              <p className="text-xs text-red-400 font-mono">{fieldErrors.outcome}</p>
            )}
          </div>

          {/* 2. Date Precision Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
              Calendar Date Precision <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition-all ${
                  datePrecision === 'DAY'
                    ? 'bg-zinc-900 border-emerald-600/80 text-zinc-100 ring-1 ring-emerald-500/30'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="datePrecision"
                  value="DAY"
                  checked={datePrecision === 'DAY'}
                  onChange={() => setDatePrecision('DAY')}
                  disabled={isSubmitting}
                  className="mt-0.5 accent-emerald-500"
                />
                <div>
                  <div className="text-xs font-semibold text-zinc-200">DAY Precision</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Exact inspection day is known (Year, Month, Day).
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition-all ${
                  datePrecision === 'MONTH'
                    ? 'bg-zinc-900 border-emerald-600/80 text-zinc-100 ring-1 ring-emerald-500/30'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="datePrecision"
                  value="MONTH"
                  checked={datePrecision === 'MONTH'}
                  onChange={() => setDatePrecision('MONTH')}
                  disabled={isSubmitting}
                  className="mt-0.5 accent-emerald-500"
                />
                <div>
                  <div className="text-xs font-semibold text-zinc-200">MONTH Precision</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Only month is known (e.g. historical audits without exact day).
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Conditional Date Fields */}
          <div className="p-4 bg-zinc-900/30 border border-zinc-800/80 rounded-md space-y-3">
            <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Inspection Date Components ({datePrecision} Precision)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Year */}
              <div>
                <label
                  htmlFor="verify-year"
                  className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
                >
                  Year <span className="text-red-400">*</span>
                </label>
                <input
                  id="verify-year"
                  type="number"
                  min={1900}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
                  disabled={isSubmitting}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                {fieldErrors.year && (
                  <p className="text-[11px] text-red-400 font-mono mt-1">{fieldErrors.year}</p>
                )}
              </div>

              {/* Month */}
              <div>
                <label
                  htmlFor="verify-month"
                  className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
                >
                  Month <span className="text-red-400">*</span>
                </label>
                <select
                  id="verify-month"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  disabled={isSubmitting}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                {fieldErrors.month && (
                  <p className="text-[11px] text-red-400 font-mono mt-1">{fieldErrors.month}</p>
                )}
              </div>

              {/* Day (Only for DAY precision) */}
              <div>
                <label
                  htmlFor="verify-day"
                  className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
                >
                  Day {datePrecision === 'DAY' ? <span className="text-red-400">*</span> : '(N/A)'}
                </label>
                {datePrecision === 'DAY' ? (
                  <select
                    id="verify-day"
                    value={day}
                    onChange={(e) => setDay(parseInt(e.target.value, 10))}
                    disabled={isSubmitting}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  >
                    {Array.from({ length: getMaxDays(year, month) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {String(d).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    id="verify-day-disabled"
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-500 font-mono italic"
                  >
                    Day Unknown (Null)
                  </div>
                )}
                {fieldErrors.day && (
                  <p className="text-[11px] text-red-400 font-mono mt-1">{fieldErrors.day}</p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-zinc-400">
              {datePrecision === 'DAY' ? (
                <span>
                  Exact date: <strong className="text-zinc-200">{year}-{String(month).padStart(2, '0')}-{String(day).padStart(2, '0')}</strong>.
                </span>
              ) : (
                <span>
                  Month-only: <strong className="text-zinc-200">{year}-{String(month).padStart(2, '0')}</strong> (no synthetic day 1 or guess is invented).
                </span>
              )}
            </p>
          </div>

          {/* 4. Inspection Result Status (isSuccessful) */}
          <div className="p-3.5 bg-zinc-900/40 border border-zinc-800 rounded-md space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isSuccessful}
                onChange={(e) => setIsSuccessful(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-semibold text-zinc-200">
                  Physical inspection successfully completed (Completed Inspection)
                </span>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                  Keep checked if the inspection was carried out to completion (even if a mismatch or defect was observed).
                  Uncheck only if the physical inspection attempt could not be performed (e.g. device locked, site inaccessible).
                </p>
              </div>
            </label>
            {!isSuccessful && (
              <div className="text-[11px] text-amber-400/90 font-mono bg-amber-950/40 p-2 rounded border border-amber-800/50">
                Notice: Unsuccessful inspection attempts are recorded in verification history and audit trail, but do not update the asset&apos;s latest confirmed verification summary.
              </div>
            )}
          </div>

          {/* 5. Notes */}
          <div className="space-y-1.5">
            <label
              htmlFor="verification-notes"
              className="block text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300"
            >
              Inspection Notes <span className="text-zinc-500">(Optional, max 1000 chars)</span>
            </label>
            <textarea
              id="verification-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
              rows={3}
              placeholder="e.g. Verified serial number on barcode sticker; room door was locked so inspected via custodian window..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-mono text-xs"
            />
            {fieldErrors.notes && (
              <p className="text-xs text-red-400 font-mono">{fieldErrors.notes}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            {isBlindResubmitBlocked && !duplicateRiskAcknowledged && (
              <span className="text-[11px] font-mono text-amber-400 mr-auto flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                Re-submission locked pending duplicate risk acknowledgment
              </span>
            )}
            {isBlindResubmitBlocked && duplicateRiskAcknowledged && (
              <span className="text-[11px] font-mono text-blue-400 mr-auto flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Duplicate risk acknowledged by operator
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting || isCheckingHistory}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={
                isSubmitting ||
                previewMode ||
                (isBlindResubmitBlocked && !duplicateRiskAcknowledged) ||
                isCheckingHistory
              }
              className={`flex items-center gap-1.5 text-white ${
                isBlindResubmitBlocked && duplicateRiskAcknowledged
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Recording Verification...
                </>
              ) : isCheckingHistory ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Checking History...
                </>
              ) : isBlindResubmitBlocked && duplicateRiskAcknowledged ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Submit Verification (Acknowledged Retry)
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Record Verification
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
