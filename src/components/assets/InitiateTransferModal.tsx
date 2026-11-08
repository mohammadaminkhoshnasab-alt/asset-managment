import React, { useState } from 'react';
import type { AssetDetails } from '../../types/asset.ts';
import type { CreateTransferPayload } from '../../types/transfer.ts';
import type { LookupCatalogsState } from '../../utils/lookupClient.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import {
  ArrowRightLeft,
  X,
  User,
  Users,
  Building,
  DollarSign,
  MapPin,
  AlertCircle,
  FileCheck2,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface InitiateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDetails;
  catalogs: LookupCatalogsState;
  csrfToken: string | null;
  previewMode: boolean;
  onTransferCreated: () => void;
  onCheckState?: () => Promise<any>;
}

export const InitiateTransferModal: React.FC<InitiateTransferModalProps> = ({
  isOpen,
  onClose,
  asset,
  catalogs,
  csrfToken,
  previewMode,
  onTransferCreated,
  onCheckState,
}) => {
  // Dimension Selection Flags
  const [changeAcOwner, setChangeAcOwner] = useState(false);
  const [toPersonId, setToPersonId] = useState<string>('');

  const [changeCurrentUser, setChangeCurrentUser] = useState(false);
  const [toCurrentUserId, setToCurrentUserId] = useState<string>('');

  const [changeDepartment, setChangeDepartment] = useState(false);
  const [toDepartment, setToDepartment] = useState<string>('');

  const [changeCostCenter, setChangeCostCenter] = useState(false);
  const [toCostCenter, setToCostCenter] = useState<string>('');

  const [changeLocation, setChangeLocation] = useState(false);
  const [toLocationId, setToLocationId] = useState<string>('');

  // Workflow fields
  const [eformNumber, setEformNumber] = useState('');
  const [notes, setNotes] = useState('');

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUncertainError, setIsUncertainError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsUncertainError(false);

    if (previewMode) {
      setErrorMessage('Transfer creation is disabled in Preview Inspection Mode. Sign in with administrative credentials.');
      return;
    }

    if (
      !changeAcOwner &&
      !changeCurrentUser &&
      !changeDepartment &&
      !changeCostCenter &&
      !changeLocation
    ) {
      setErrorMessage(
        'Please select at least one dimension to modify (AC Owner, Current User, Department, Cost Center, or Location).'
      );
      return;
    }

    const payload: CreateTransferPayload = {
      changeAcOwner,
      toPersonId: changeAcOwner ? (toPersonId.trim() ? toPersonId.trim() : null) : null,
      changeCurrentUser,
      toCurrentUserId: changeCurrentUser
        ? toCurrentUserId.trim()
          ? toCurrentUserId.trim()
          : null
        : null,
      changeDepartment,
      toDepartment: changeDepartment ? (toDepartment.trim() ? toDepartment.trim() : null) : null,
      changeCostCenter,
      toCostCenter: changeCostCenter ? (toCostCenter.trim() ? toCostCenter.trim() : null) : null,
      changeLocation,
      toLocationId: changeLocation ? (toLocationId.trim() ? toLocationId.trim() : null) : null,
      eformNumber: eformNumber.trim() ? eformNumber.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
    };

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const res = await fetch(`/api/assets/${asset.id}/transfers`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        onTransferCreated();
        onClose();
      } else if (res.status === 409) {
        setErrorMessage(data.error || 'A pending transfer is already active for this asset.');
      } else if (res.status === 401) {
        setErrorMessage('Administrative session expired or unauthorized. Please re-authenticate.');
      } else if (res.status === 403) {
        setErrorMessage('Security token (CSRF) validation failed. Please refresh the page and try again.');
      } else {
        setErrorMessage(data.error || `Failed to initiate transfer (Status: ${res.status}).`);
      }
    } catch {
      // Honest uncertain-network feedback: Persistence may have occurred. Never auto-retry. Keep form state intact.
      setIsUncertainError(true);
      setErrorMessage(
        'Network or communication error: Verification could not be confirmed. The transfer initiation may have already succeeded and persisted on the server. Please reload the transfer state to verify before attempting to submit again, and do NOT resubmit without checking.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="initiate-transfer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-lg bg-[#11141c] border border-[#232b3b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1d2330] flex items-center justify-between bg-[#0d1016]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#181d28] border border-[#262f40] text-[#ea8c34]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <span className="block font-mono text-[10px] tracking-widest text-[#ea8c34] uppercase font-semibold">
                PHASE P10 // CONTROLLED TRANSFER WORKFLOW
              </span>
              <h2
                id="initiate-transfer-modal-title"
                className="text-sm font-semibold tracking-wide text-slate-100 uppercase"
              >
                Initiate Transfer: {asset.model} (SN: {asset.serialNumber || '—'})
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#181d28] cursor-pointer"
            aria-label="Close initiate transfer dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
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
                    {isUncertainError ? 'Action Unverified (Persistence Possible):' : 'Action Blocked:'}
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
                          onTransferCreated();
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

          {previewMode && (
            <div className="p-3 rounded bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs font-mono flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Preview Inspection Mode:</strong> Live transfers cannot be created in preview mode.
              </span>
            </div>
          )}

          <div className="p-3.5 rounded bg-[#0a0c10] border border-[#1b202a] text-xs font-mono text-slate-400 space-y-1">
            <span className="text-[#ea8c34] font-semibold block uppercase tracking-wider">
              // Controlled Invariant Notice
            </span>
            <p className="leading-relaxed text-slate-300">
              Creating a transfer sets status to <strong className="text-amber-300">PENDING</strong>.
              The asset&apos;s active assignments remain unchanged until explicitly confirmed and completed with a validated <strong className="text-slate-100">eForm Number</strong>.
            </p>
          </div>

          {/* Transfer Dimensions Matrix */}
          <div className="space-y-3 font-mono">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 block">
              Transfer Dimensions (Select which fields to modify):
            </span>

            {/* 1. AC Owner */}
            <div className={`p-3.5 rounded border transition-all ${changeAcOwner ? 'bg-[#151922] border-amber-500/50' : 'bg-[#0d1016] border-[#1d2330]'}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changeAcOwner}
                    onChange={(e) => setChangeAcOwner(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2a3447] bg-[#0a0c10] text-[#ea8c34] focus:ring-[#ea8c34]"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <User className="w-3.5 h-3.5 text-[#ea8c34]" />
                    <span>AC OWNER (RESPONSIBLE PERSON)</span>
                  </div>
                </label>
                <span className="text-[11px] text-slate-400">
                  Current: <strong className="text-slate-200">{asset.acOwner ? `${asset.acOwner.fullName} (${asset.acOwner.personalCode || 'No Code'})` : 'Unassigned'}</strong>
                </span>
              </div>

              {changeAcOwner && (
                <div className="mt-3 pl-6 space-y-1.5">
                  <label htmlFor="transfer-to-ac-owner" className="block text-[11px] text-slate-400">
                    New AC Owner Destination:
                  </label>
                  <select
                    id="transfer-to-ac-owner"
                    value={toPersonId}
                    onChange={(e) => setToPersonId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0a0c10] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none"
                  >
                    <option value="">— Unassign / Clear AC Owner (None) —</option>
                    {catalogs.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} {p.personalCode ? `[Personal Code: ${p.personalCode}]` : ''} {p.department ? `— Dept: ${p.department}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 2. Current User */}
            <div className={`p-3.5 rounded border transition-all ${changeCurrentUser ? 'bg-[#151922] border-amber-500/50' : 'bg-[#0d1016] border-[#1d2330]'}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changeCurrentUser}
                    onChange={(e) => setChangeCurrentUser(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2a3447] bg-[#0a0c10] text-[#ea8c34] focus:ring-[#ea8c34]"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <span>CURRENT USER (CUSTODIAL ASSIGNMENT)</span>
                  </div>
                </label>
                <span className="text-[11px] text-slate-400">
                  Current: <strong className="text-slate-200">{asset.currentUser ? `${asset.currentUser.fullName} (@${asset.currentUser.username || 'no-username'})` : 'Unassigned'}</strong>
                </span>
              </div>

              {changeCurrentUser && (
                <div className="mt-3 pl-6 space-y-1.5">
                  <label htmlFor="transfer-to-current-user" className="block text-[11px] text-slate-400">
                    New Current User Destination:
                  </label>
                  <select
                    id="transfer-to-current-user"
                    value={toCurrentUserId}
                    onChange={(e) => setToCurrentUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0a0c10] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none"
                  >
                    <option value="">— Unassign / Clear Current User (None) —</option>
                    {catalogs.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} {p.username ? `[@${p.username}]` : ''} {p.department ? `— Dept: ${p.department}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 3. Department */}
            <div className={`p-3.5 rounded border transition-all ${changeDepartment ? 'bg-[#151922] border-amber-500/50' : 'bg-[#0d1016] border-[#1d2330]'}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changeDepartment}
                    onChange={(e) => setChangeDepartment(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2a3447] bg-[#0a0c10] text-[#ea8c34] focus:ring-[#ea8c34]"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <Building className="w-3.5 h-3.5 text-amber-400" />
                    <span>DEPARTMENT ALLOCATION</span>
                  </div>
                </label>
                <span className="text-[11px] text-slate-400">
                  Current: <strong className="text-slate-200">{asset.department || 'None'}</strong>
                </span>
              </div>

              {changeDepartment && (
                <div className="mt-3 pl-6 space-y-1.5">
                  <label htmlFor="transfer-to-department" className="block text-[11px] text-slate-400">
                    New Department Destination:
                  </label>
                  <input
                    id="transfer-to-department"
                    type="text"
                    value={toDepartment}
                    onChange={(e) => setToDepartment(e.target.value)}
                    placeholder="e.g. Infrastructure Engineering, Finance"
                    className="w-full px-3 py-2 rounded bg-[#0a0c10] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none font-mono"
                  />
                  <span className="block text-[10px] text-slate-500">
                    Leave blank to unassign department.
                  </span>
                </div>
              )}
            </div>

            {/* 4. Cost Center */}
            <div className={`p-3.5 rounded border transition-all ${changeCostCenter ? 'bg-[#151922] border-amber-500/50' : 'bg-[#0d1016] border-[#1d2330]'}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changeCostCenter}
                    onChange={(e) => setChangeCostCenter(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2a3447] bg-[#0a0c10] text-[#ea8c34] focus:ring-[#ea8c34]"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>COST CENTER</span>
                  </div>
                </label>
                <span className="text-[11px] text-slate-400">
                  Current: <strong className="text-slate-200">{asset.costCenter || 'None'}</strong>
                </span>
              </div>

              {changeCostCenter && (
                <div className="mt-3 pl-6 space-y-1.5">
                  <label htmlFor="transfer-to-cost-center" className="block text-[11px] text-slate-400">
                    New Cost Center Destination:
                  </label>
                  <input
                    id="transfer-to-cost-center"
                    type="text"
                    value={toCostCenter}
                    onChange={(e) => setToCostCenter(e.target.value)}
                    placeholder="e.g. CC-1044, CC-IT-OPS"
                    className="w-full px-3 py-2 rounded bg-[#0a0c10] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none font-mono"
                  />
                  <span className="block text-[10px] text-slate-500">
                    Leave blank to unassign cost center.
                  </span>
                </div>
              )}
            </div>

            {/* 5. Location */}
            <div className={`p-3.5 rounded border transition-all ${changeLocation ? 'bg-[#151922] border-amber-500/50' : 'bg-[#0d1016] border-[#1d2330]'}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={changeLocation}
                    onChange={(e) => setChangeLocation(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2a3447] bg-[#0a0c10] text-[#ea8c34] focus:ring-[#ea8c34]"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    <span>PHYSICAL LOCATION</span>
                  </div>
                </label>
                <span className="text-[11px] text-slate-400">
                  Current: <strong className="text-slate-200">{asset.location ? `${asset.location.name} (${asset.location.room || 'General'})` : 'Unassigned'}</strong>
                </span>
              </div>

              {changeLocation && (
                <div className="mt-3 pl-6 space-y-1.5">
                  <label htmlFor="transfer-to-location" className="block text-[11px] text-slate-400">
                    New Location Destination:
                  </label>
                  <select
                    id="transfer-to-location"
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0a0c10] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none"
                  >
                    <option value="">— Unassign / Clear Location (None) —</option>
                    {catalogs.locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.building ? `[Building: ${loc.building}]` : ''} {loc.room ? `[Room: ${loc.room}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Metadata */}
          <div className="p-4 rounded bg-[#0a0c10] border border-[#1b202a] space-y-3 font-mono">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 block">
              Workflow Documentation:
            </span>

            <Input
              label="eForm Number (Optional at creation, mandatory at completion)"
              id="transfer-eform-number"
              value={eformNumber}
              onChange={(e) => setEformNumber(e.target.value)}
              placeholder="e.g. EF-2026-0891 (may repeat across batch transfers)"
              helperText="An eForm Number is non-unique and can legitimately group multiple assets transferred under the same administrative form."
            />

            <div>
              <label
                htmlFor="transfer-notes"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Transfer Justification / Internal Notes (Optional)
              </label>
              <textarea
                id="transfer-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Operational reason for transfer..."
                className="w-full px-3 py-2 rounded bg-[#0d1016] border border-[#2a3447] text-slate-100 text-xs focus:border-[#ea8c34] focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Actions */}
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
              leftIcon={<FileCheck2 className="w-4 h-4" />}
            >
              Create Pending Transfer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
