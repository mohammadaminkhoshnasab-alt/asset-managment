/**
 * IT Asset Management - Return Device Modal
 * Standardized equipment return workflow recording condition, comments, and responsible IT staff.
 */

import React, { useState } from 'react';
import { X, ArrowDownLeft, ShieldCheck, AlertCircle, Info, Camera } from 'lucide-react';
import { Asset, DeviceCondition } from '../../types/asset.ts';
import { assetService } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

interface ReturnModalProps {
  asset: Asset;
  onClose: () => void;
  onSuccess: () => void;
}

const CONDITIONS: { value: DeviceCondition; label: string; desc: string }[] = [
  { value: 'Good', label: 'Good', desc: 'Fully operational, pristine or negligible wear' },
  { value: 'Minor Damage', label: 'Minor Damage', desc: 'Cosmetic scratches, fully functioning hardware' },
  { value: 'Damaged', label: 'Damaged', desc: 'Physical damage, cracked frame, needs inspection' },
  { value: 'Not Working', label: 'Not Working', desc: 'Fails to power on, severe defect' },
];

export const ReturnModal: React.FC<ReturnModalProps> = ({ asset, onClose, onSuccess }) => {
  const { currentUser } = useApp();
  const [condition, setCondition] = useState<DeviceCondition>('Good');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await assetService.executeReturn({
        assetNumber: asset.assetNumber,
        condition,
        comments: comments.trim() || undefined,
        itUserId: currentUser.id,
        itUserName: `${currentUser.name} (${currentUser.role})`,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to process return');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Process Device Return to IT Stock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register inspection and return device into inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Summary Pill */}
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Asset Number:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {asset.assetNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Model / Type:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {asset.model} ({asset.type})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Returning Employee:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {asset.currentUserName || 'N/A'} ({asset.personalCode || 'No code'})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">AC Owner (Accounting):</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {asset.acOwner}
              </span>
            </div>
          </div>

          {/* Condition Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Inspected Device Condition *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCondition(c.value)}
                  className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                    condition === c.value
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xs font-semibold">{c.label}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {c.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Return Comments */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Return Inspection Notes (Stored in Return Audit Record)
            </label>
            <textarea
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="e.g. Returned with original 65W USB-C charger. Casing clean."
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Responsible IT User Record */}
          <div className="flex items-center justify-between rounded-lg bg-blue-50/50 p-2.5 border border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Processed by: <strong>{currentUser.name}</strong> ({currentUser.role})
              </span>
            </div>
          </div>

          {/* Policy Invariant Note */}
          <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
            <span>
              Executing return will transition status to <strong>Spare</strong>, clear employee assignments,
              move location to IT Stockroom, and preserve the asset's existing general comment unchanged.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Processing Return...' : 'Confirm Return to Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
