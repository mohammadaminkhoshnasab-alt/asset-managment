/**
 * IT Asset Management - Return Device Modal (Industrial Redesign)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] shadow-2xl dark:border-[#2B323D] dark:bg-[#12151B]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D2C8B8] p-4 dark:border-[#2B323D] bg-[#E5DFD2]/60 dark:bg-[#181C24]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#B2534C] text-black dark:bg-[#B85D56] dark:text-black">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-industrial-display text-sm font-black uppercase text-[#141312] dark:text-[#F2EFE9]">
                PROCESS RETURN TO IT STOCK
              </h3>
              <p className="text-[10px] font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                DE-ALLOCATE &amp; RE-ENTRY TO INVENTORY
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#6E6960] hover:text-[#141312] hover:bg-[#D2C8B8] dark:text-[#7C8797] dark:hover:text-[#F2EFE9] dark:hover:bg-[#2B323D]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-mono-tabular text-xs">
          {error && (
            <div className="flex items-center gap-2 rounded bg-[#B2534C]/15 p-3 text-xs text-[#B2534C] dark:text-[#E28882] border border-[#B2534C]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Summary Spec Block */}
          <div className="rounded border border-[#D2C8B8] bg-[#E5DFD2]/50 p-3 dark:border-[#2B323D] dark:bg-[#181C24] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#6E6960] dark:text-[#7C8797]">ASSET NUMBER:</span>
              <span className="font-bold text-[#141312] dark:text-[#F2EFE9]">{asset.assetNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E6960] dark:text-[#7C8797]">EQUIPMENT:</span>
              <span className="text-[#141312] dark:text-[#F2EFE9]">{asset.model} ({asset.type})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6E6960] dark:text-[#7C8797]">CURRENT ASSIGNEE:</span>
              <span className="font-bold text-[#141312] dark:text-[#F2EFE9]">
                {asset.currentUserName} ({asset.personalCode})
              </span>
            </div>
          </div>

          {/* Physical Return Inspection Condition */}
          <div className="space-y-1.5">
            <label className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] block">
              HARDWARE INSPECTION CONDITION
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCondition(c.value)}
                  className={`rounded border p-2.5 text-left transition-all ${
                    condition === c.value
                      ? 'border-[#141312] bg-[#141312] text-[#F8F4EC] dark:border-[#F2EFE9] dark:bg-[#F2EFE9] dark:text-[#12151B] font-bold'
                      : 'border-[#D2C8B8] bg-[#E5DFD2]/40 text-[#141312] hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]'
                  }`}
                >
                  <p className="font-bold text-xs">{c.label}</p>
                  <p className="text-[10px] opacity-75 mt-0.5">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Return Remarks / Event Log Comments */}
          <div className="space-y-1.5">
            <label className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] block">
              RETURN AUDIT REMARKS
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Record condition notes, peripherals returned, or reason for return..."
              className="w-full rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 p-2.5 text-xs text-[#141312] focus:border-[#E49C52] focus:outline-none dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]"
            />
            <p className="text-[10px] text-[#6E6960] dark:text-[#7C8797]">
              Stored in the chronological audit log. The asset's existing general comment is preserved unchanged.
            </p>
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D2C8B8] dark:border-[#2B323D]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded border border-[#D2C8B8] px-3.5 py-2 text-xs font-bold text-[#6E6960] hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:text-[#7C8797]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-[#B2534C] text-black dark:bg-[#B85D56] dark:text-black px-4 py-2 text-xs font-black font-industrial-display shadow-xs hover:brightness-105 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? 'PROCESSING RETURN...' : 'CONFIRM STOCK RETURN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
