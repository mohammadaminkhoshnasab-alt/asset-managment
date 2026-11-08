import React, { useState } from 'react';
import type { AssetTransferRecord, CancelTransferPayload } from '../../types/transfer.ts';
import { Button } from '../ui/Button.tsx';
import {
  AlertTriangle,
  X,
  AlertCircle,
  Ban,
  RefreshCw,
} from 'lucide-react';

interface CancelTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: AssetTransferRecord;
  assetModel: string;
  csrfToken: string | null;
  onCancelled: () => void;
  onCheckState?: () => Promise<any>;
}

export const CancelTransferModal: React.FC<CancelTransferModalProps> = ({
  isOpen,
  onClose,
  transfer,
  assetModel,
  csrfToken,
  onCancelled,
  onCheckState,
}) => {
  const [cancelNotes, setCancelNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUncertainError, setIsUncertainError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload: CancelTransferPayload = {
        notes: cancelNotes.trim() ? cancelNotes.trim() : null,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const res = await fetch(
        `/api/assets/${transfer.assetId}/transfers/${transfer.id}/cancel`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        onCancelled();
        onClose();
      } else if (res.status === 409) {
        setErrorMessage(
          data.error || 'Conflict detected: Transfer is no longer in pending status.'
        );
      } else if (res.status === 401) {
        setErrorMessage('Administrative session expired. Please re-authenticate.');
      } else if (res.status === 403) {
        setErrorMessage('Security token (CSRF) validation failed. Please refresh the page and try again.');
      } else {
        setErrorMessage(data.error || `Failed to cancel transfer (Status: ${res.status}).`);
      }
    } catch {
      // Honest uncertain-network feedback: Persistence may have occurred. Never auto-retry. Keep form state intact.
      setIsUncertainError(true);
      setErrorMessage(
        'Network or verification uncertainty: The cancellation response could not be confirmed. The transfer cancellation may have already persisted on the server. Please reload the asset transfer state before attempting to retry, and do NOT repeat submission blindly.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-transfer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg flex flex-col rounded-lg bg-[#11141c] border border-[#232b3b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1d2330] flex items-center justify-between bg-[#0d1016]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-rose-950/60 border border-rose-800/50 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="block font-mono text-[10px] tracking-widest text-rose-400 uppercase font-semibold">
                CANCEL PENDING TRANSFER
              </span>
              <h2
                id="cancel-transfer-modal-title"
                className="text-sm font-semibold tracking-wide text-slate-100 uppercase"
              >
                Cancel Transfer: {assetModel}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#181d28] cursor-pointer"
            aria-label="Close cancel transfer dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                    {isUncertainError ? 'Action Unverified (Persistence Possible):' : 'Cancellation Failed:'}
                  </strong>
                  <span>{errorMessage}</span>
                </div>
                {isUncertainError && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        if (onCheckState) {
                          await onCheckState();
                        } else {
                          onCancelled();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#181d28] border border-amber-600/60 text-amber-300 hover:text-white hover:bg-[#202736] cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3 text-amber-400" />
                      Check Current Transfer State
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-3.5 rounded bg-[#0a0c10] border border-[#1b202a] text-xs font-mono text-slate-300 space-y-2">
            <p>
              Are you sure you want to cancel this pending transfer request?
            </p>
            <p className="text-slate-400">
              • The transfer status will be marked <strong className="text-rose-400">CANCELLED</strong>.<br />
              • Current asset assignments will remain <strong className="text-slate-200">strictly unchanged</strong>.<br />
              • A transactional audit record will be logged to document the cancellation.
            </p>
          </div>

          <div className="space-y-1.5 font-mono">
            <label
              htmlFor="cancel-transfer-reason"
              className="block text-xs uppercase tracking-wider text-slate-400"
            >
              Cancellation Reason (Optional)
            </label>
            <textarea
              id="cancel-transfer-reason"
              rows={2}
              value={cancelNotes}
              onChange={(e) => setCancelNotes(e.target.value)}
              placeholder="e.g. Employee transfer cancelled by HR; device retained in current department."
              className="w-full px-3 py-2 rounded bg-[#0a0c10] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none font-mono"
            />
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
              Keep Pending
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              leftIcon={<Ban className="w-4 h-4" />}
            >
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
