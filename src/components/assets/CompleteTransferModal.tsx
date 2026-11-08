import React, { useState, useEffect } from 'react';
import type { AssetTransferRecord, CompleteTransferPayload } from '../../types/transfer.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import {
  CheckCircle2,
  X,
  AlertCircle,
  FileCheck,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

interface CompleteTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: AssetTransferRecord;
  assetModel: string;
  csrfToken: string | null;
  onCompleted: () => void;
}

export const CompleteTransferModal: React.FC<CompleteTransferModalProps> = ({
  isOpen,
  onClose,
  transfer,
  assetModel,
  csrfToken,
  onCompleted,
}) => {
  const [eformNumber, setEformNumber] = useState(transfer.eformNumber || '');
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUncertainError, setIsUncertainError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEformNumber(transfer.eformNumber || '');
      setCompletionNotes('');
      setErrorMessage(null);
      setIsUncertainError(false);
    }
  }, [isOpen, transfer]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEform = eformNumber.trim();
    if (!trimmedEform) {
      setErrorMessage('eForm Number is mandatory to complete a transfer and cannot be empty.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CompleteTransferPayload = {
        eformNumber: trimmedEform,
        notes: completionNotes.trim() ? completionNotes.trim() : null,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const res = await fetch(
        `/api/assets/${transfer.assetId}/transfers/${transfer.id}/complete`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        onCompleted();
        onClose();
      } else if (res.status === 409) {
        setErrorMessage(
          data.error || 'Conflict detected: Stale transfer state or record is no longer pending.'
        );
      } else if (res.status === 400) {
        setErrorMessage(data.error || 'Invalid completion request parameters.');
      } else if (res.status === 401) {
        setErrorMessage('Administrative session expired. Please re-authenticate.');
      } else if (res.status === 403) {
        setErrorMessage('Security token (CSRF) validation failed. Please refresh the page and try again.');
      } else {
        setErrorMessage(data.error || `Failed to complete transfer (Status: ${res.status}).`);
      }
    } catch {
      // Honest uncertain-network feedback: Persistence may have occurred. Never auto-retry. Keep form state intact.
      setIsUncertainError(true);
      setErrorMessage(
        'Network or verification uncertainty: The completion response could not be confirmed. The transfer completion may have already persisted on the server. Please reload the asset transfer state before attempting to retry, and do NOT repeat submission blindly.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-transfer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg bg-[#11141c] border border-[#232b3b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1d2330] flex items-center justify-between bg-[#0d1016]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="block font-mono text-[10px] tracking-widest text-emerald-400 uppercase font-semibold">
                CONFIRM & COMPLETE TRANSFER
              </span>
              <h2
                id="complete-transfer-modal-title"
                className="text-sm font-semibold tracking-wide text-slate-100 uppercase"
              >
                Complete Workflow: {assetModel}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#181d28] cursor-pointer"
            aria-label="Close complete transfer dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div
              className={`p-3.5 rounded text-xs font-mono flex items-start gap-2.5 ${
                isUncertainError
                  ? 'bg-amber-950/60 border border-amber-700/70 text-amber-200'
                  : 'bg-rose-950/50 border border-rose-800/60 text-rose-300'
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isUncertainError ? 'text-amber-400' : 'text-rose-400'
                }`}
              />
              <div className="space-y-2 flex-1">
                <div>
                  <strong className="block font-semibold">
                    {isUncertainError ? 'Action Unverified (Persistence Possible):' : 'Completion Failed:'}
                  </strong>
                  <span>{errorMessage}</span>
                </div>
                {isUncertainError && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onCompleted();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#181d28] border border-amber-600/60 text-amber-300 hover:text-white hover:bg-[#202736] cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3 text-amber-400" />
                      Reload Transfer State
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-3 rounded bg-amber-950/30 border border-amber-800/40 text-amber-300/90 text-xs font-mono flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Completing this transfer will <strong>atomically commit</strong> the new assignment values to the asset and record an immutable <strong>TRANSFER</strong> audit event.
            </span>
          </div>

          {/* Pending Changes Diff Summary */}
          <div className="p-3.5 rounded bg-[#0a0c10] border border-[#1b202a] font-mono text-xs space-y-2.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 block">
              Assignment Modifications to be Committed:
            </span>

            <div className="space-y-1.5">
              {transfer.changeAcOwner && (
                <div className="flex items-center justify-between p-2 rounded bg-[#0d1016] border border-[#1d2330]">
                  <span className="text-slate-400">AC Owner:</span>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="text-rose-400/80 line-through">
                      {transfer.fromPerson ? transfer.fromPerson.fullName : 'Unassigned'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-emerald-400 font-semibold">
                      {transfer.toPerson ? transfer.toPerson.fullName : 'Unassigned (None)'}
                    </span>
                  </div>
                </div>
              )}

              {transfer.changeCurrentUser && (
                <div className="flex items-center justify-between p-2 rounded bg-[#0d1016] border border-[#1d2330]">
                  <span className="text-slate-400">Current User:</span>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="text-rose-400/80 line-through">
                      {transfer.fromCurrentUser ? transfer.fromCurrentUser.fullName : 'Unassigned'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-emerald-400 font-semibold">
                      {transfer.toCurrentUser ? transfer.toCurrentUser.fullName : 'Unassigned (None)'}
                    </span>
                  </div>
                </div>
              )}

              {transfer.changeDepartment && (
                <div className="flex items-center justify-between p-2 rounded bg-[#0d1016] border border-[#1d2330]">
                  <span className="text-slate-400">Department:</span>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="text-rose-400/80 line-through">
                      {transfer.fromDepartment || 'None'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-emerald-400 font-semibold">
                      {transfer.toDepartment || 'None'}
                    </span>
                  </div>
                </div>
              )}

              {transfer.changeCostCenter && (
                <div className="flex items-center justify-between p-2 rounded bg-[#0d1016] border border-[#1d2330]">
                  <span className="text-slate-400">Cost Center:</span>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="text-rose-400/80 line-through">
                      {transfer.fromCostCenter || 'None'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-emerald-400 font-semibold">
                      {transfer.toCostCenter || 'None'}
                    </span>
                  </div>
                </div>
              )}

              {transfer.changeLocation && (
                <div className="flex items-center justify-between p-2 rounded bg-[#0d1016] border border-[#1d2330]">
                  <span className="text-slate-400">Location:</span>
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="text-rose-400/80 line-through">
                      {transfer.fromLocation ? transfer.fromLocation.name : 'Unassigned'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-emerald-400 font-semibold">
                      {transfer.toLocation ? transfer.toLocation.name : 'Unassigned (None)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Required eForm Number Input */}
          <div className="p-4 rounded bg-[#0a0c10] border border-[#1b202a] space-y-3 font-mono">
            <Input
              label="Mandatory eForm Number *"
              id="complete-transfer-eform"
              value={eformNumber}
              onChange={(e) => setEformNumber(e.target.value)}
              placeholder="e.g. EF-2026-0891"
              required
              helperText="A non-empty eForm Number is mandatory to execute completion. eForm numbers are non-unique and can be reused across assets in the same batch transfer."
            />

            <div>
              <label
                htmlFor="complete-transfer-notes"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Completion Remark / Handoff Note (Optional)
              </label>
              <textarea
                id="complete-transfer-notes"
                rows={2}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Confirmation of physical hardware transfer..."
                className="w-full px-3 py-2 rounded bg-[#0d1016] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-[#1d2330] flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              leftIcon={<FileCheck className="w-4 h-4" />}
            >
              Commit & Complete Transfer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
