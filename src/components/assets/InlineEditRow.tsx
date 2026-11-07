import React, { useEffect, useRef } from 'react';
import {
  Save,
  RotateCcw,
  Lock,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  FileEdit,
} from 'lucide-react';
import type {
  AssetListItem,
  PatchAssetFormValues,
  AssetStatusEnum,
} from '../../types/asset.ts';
import type { LookupCatalogsState } from '../../utils/lookupClient.ts';
import { Button } from '../ui/Button.tsx';

interface InlineEditRowProps {
  asset: AssetListItem;
  colSpan: number;
  editForm: PatchAssetFormValues;
  editErrors: Record<string, string>;
  isSubmitting: boolean;
  submitFeedback: {
    type: 'success' | 'error' | 'info';
    message: string;
  } | null;
  catalogs: LookupCatalogsState;
  catalogsLoading: boolean;
  catalogsError: string | null;
  hasChanges: boolean;
  changedFields: string[];
  previewMode: boolean;
  isAuthenticated: boolean;
  onFieldChange: (field: keyof PatchAssetFormValues, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onNavigateToDetails: (id: string) => void;
}

export const InlineEditRow: React.FC<InlineEditRowProps> = ({
  asset,
  colSpan,
  editForm,
  editErrors,
  isSubmitting,
  submitFeedback,
  catalogs,
  catalogsLoading,
  catalogsError,
  hasChanges,
  changedFields,
  previewMode,
  isAuthenticated,
  onFieldChange,
  onSave,
  onCancel,
  onNavigateToDetails,
}) => {
  const isPreviewRestricted = previewMode && !isAuthenticated;
  const modelInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus model input on mount for smooth keyboard workflow
  useEffect(() => {
    if (modelInputRef.current) {
      modelInputRef.current.focus();
    }
  }, []);

  // Handle Escape key to cancel editing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <tr
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="bg-[#121622] border-y-2 border-[#ea8c34] shadow-2xl transition-all select-text"
    >
      <td colSpan={colSpan} className="p-4 sm:p-6 font-mono">
        <div className="space-y-4">
          {/* Header strip with status and mode indicators */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#222a3d]">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded bg-[#ea8c34]/20 border border-[#ea8c34]/40 text-[#ea8c34]">
                <FileEdit className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                    Inline Editing Asset:
                  </span>
                  <span className="text-xs text-[#ea8c34] font-semibold">
                    {asset.assetNumber ? `#${asset.assetNumber}` : asset.model}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2738] text-slate-400 border border-[#2b374c]">
                    UUID: {asset.id.slice(0, 8)}...
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  General 9-field allowlist specification. Modifications will generate an immutable transactional audit record.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasChanges ? (
                <span className="px-2.5 py-1 rounded bg-amber-950/40 border border-amber-600/50 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>Modified ({changedFields.length}): {changedFields.join(', ')}</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-[#1b2230] border border-[#2c364c] text-slate-400 text-[10px] tracking-wider uppercase">
                  No Changes (No-Op)
                </span>
              )}
            </div>
          </div>

          {/* Feedback & Notice Banners */}
          {isPreviewRestricted && (
            <div className="p-3 rounded bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                <strong>PREVIEW INSPECTION MODE:</strong> Inline write operations (PATCH /api/assets/:id) are disabled in read-only preview. Sign in with the administrator account to execute live updates.
              </span>
            </div>
          )}

          {submitFeedback && (
            <div
              className={`p-3 rounded text-xs flex items-center gap-2.5 ${
                submitFeedback.type === 'error'
                  ? 'bg-rose-950/40 border border-rose-800/60 text-rose-200'
                  : submitFeedback.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-200'
                  : 'bg-sky-950/40 border border-sky-800/60 text-sky-200'
              }`}
            >
              {submitFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : submitFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span className="leading-relaxed">{submitFeedback.message}</span>
            </div>
          )}

          {catalogsError && (
            <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-amber-300 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Catalog warning: {catalogsError}. Existing stored identifiers remain preserved.</span>
            </div>
          )}

          {/* Editable General Fields Grid (9 Fields Allowlist) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-[#0a0d14] p-4 rounded-lg border border-[#1e2638]">
            {/* 1. Model (Mandatory) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Model *</span>
                <span className="text-[10px] text-amber-400 font-normal">Required</span>
              </label>
              <input
                ref={modelInputRef}
                type="text"
                value={editForm.model}
                onChange={(e) => onFieldChange('model', e.target.value)}
                placeholder="e.g. Dell Latitude 5540"
                disabled={isSubmitting || isPreviewRestricted}
                className={`w-full bg-[#111622] border rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:outline-none ${
                  editErrors.model
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-[#2b3548] focus:border-[#ea8c34]'
                }`}
              />
              {editErrors.model && (
                <p className="text-[10px] text-rose-400 leading-tight">{editErrors.model}</p>
              )}
            </div>

            {/* 2. Asset Number (Optional & Nullable) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Asset #</span>
                <span className="text-[10px] text-slate-400 font-normal">Nullable</span>
              </label>
              <input
                type="text"
                value={editForm.assetNumber}
                onChange={(e) => onFieldChange('assetNumber', e.target.value)}
                placeholder="e.g. AST-1004"
                disabled={isSubmitting || isPreviewRestricted}
                className={`w-full bg-[#111622] border rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:outline-none ${
                  editErrors.assetNumber
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-[#2b3548] focus:border-[#ea8c34]'
                }`}
              />
              {editErrors.assetNumber && (
                <p className="text-[10px] text-rose-400 leading-tight">{editErrors.assetNumber}</p>
              )}
            </div>

            {/* 3. Serial Number (Optional & Nullable) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Serial #</span>
                <span className="text-[10px] text-slate-400 font-normal">Nullable</span>
              </label>
              <input
                type="text"
                value={editForm.serialNumber}
                onChange={(e) => onFieldChange('serialNumber', e.target.value)}
                placeholder="e.g. SN-883921"
                disabled={isSubmitting || isPreviewRestricted}
                className={`w-full bg-[#111622] border rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:outline-none ${
                  editErrors.serialNumber
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-[#2b3548] focus:border-[#ea8c34]'
                }`}
              />
              {editErrors.serialNumber && (
                <p className="text-[10px] text-rose-400 leading-tight">{editErrors.serialNumber}</p>
              )}
            </div>

            {/* 4. Status (Mandatory Enum) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Operational Status *</span>
                <span className="text-[10px] text-amber-400 font-normal">Required</span>
              </label>
              <select
                value={editForm.status}
                onChange={(e) => onFieldChange('status', e.target.value)}
                disabled={isSubmitting || isPreviewRestricted}
                className={`w-full bg-[#111622] border rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:outline-none cursor-pointer ${
                  editErrors.status
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-[#2b3548] focus:border-[#ea8c34]'
                }`}
              >
                <option value="IN_USE">IN_USE — In active operational deployment</option>
                <option value="SPARE">SPARE — Available pool inventory</option>
                <option value="DISPOSED">DISPOSED — Decommissioned or recycled</option>
                <option value="UNKNOWN">UNKNOWN — Status unverified / pending</option>
              </select>
              {editErrors.status && (
                <p className="text-[10px] text-rose-400 leading-tight">{editErrors.status}</p>
              )}
            </div>

            {/* 5. Asset Type (Lookup) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Asset Type</span>
                {catalogsLoading && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
              </label>
              <select
                value={editForm.typeId}
                onChange={(e) => onFieldChange('typeId', e.target.value)}
                disabled={isSubmitting || isPreviewRestricted}
                className={`w-full bg-[#111622] border rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:outline-none cursor-pointer ${
                  editErrors.typeId
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-[#2b3548] focus:border-[#ea8c34]'
                }`}
              >
                <option value="">None / Unspecified</option>
                {catalogs.assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
                {/* Fallback if current typeId not in catalog */}
                {editForm.typeId && !catalogs.assetTypes.some((t) => t.id === editForm.typeId) && (
                  <option value={editForm.typeId}>
                    {asset.type?.name || `Current (${editForm.typeId.slice(0, 8)}...)`}
                  </option>
                )}
              </select>
              {editErrors.typeId && (
                <p className="text-[10px] text-rose-400 leading-tight">{editErrors.typeId}</p>
              )}
            </div>

            {/* 6. Location (Lookup) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Location</span>
                {catalogsLoading && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
              </label>
              <select
                value={editForm.locationId}
                onChange={(e) => onFieldChange('locationId', e.target.value)}
                disabled={isSubmitting || isPreviewRestricted}
                className={`w-full bg-[#111622] border rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:outline-none cursor-pointer ${
                  editErrors.locationId
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-[#2b3548] focus:border-[#ea8c34]'
                }`}
              >
                <option value="">None / Unspecified</option>
                {catalogs.locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.building ? `(${loc.building})` : ''}
                  </option>
                ))}
                {/* Fallback if current locationId not in catalog */}
                {editForm.locationId && !catalogs.locations.some((l) => l.id === editForm.locationId) && (
                  <option value={editForm.locationId}>
                    {asset.location?.name || `Current (${editForm.locationId.slice(0, 8)}...)`}
                  </option>
                )}
              </select>
              {editErrors.locationId && (
                <p className="text-[10px] text-rose-400 leading-tight">{editErrors.locationId}</p>
              )}
            </div>

            {/* 7. Device Health (Lookup) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Device Health</span>
                {catalogsLoading && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
              </label>
              <select
                value={editForm.deviceHealthId}
                onChange={(e) => onFieldChange('deviceHealthId', e.target.value)}
                disabled={isSubmitting || isPreviewRestricted}
                className={`w-full bg-[#111622] border rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:outline-none cursor-pointer ${
                  editErrors.deviceHealthId
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-[#2b3548] focus:border-[#ea8c34]'
                }`}
              >
                <option value="">None / Unspecified</option>
                {catalogs.deviceHealth.map((dh) => (
                  <option key={dh.id} value={dh.id}>
                    {dh.name}
                  </option>
                ))}
                {/* Fallback if current deviceHealthId not in catalog */}
                {editForm.deviceHealthId && !catalogs.deviceHealth.some((dh) => dh.id === editForm.deviceHealthId) && (
                  <option value={editForm.deviceHealthId}>
                    {asset.deviceHealth?.name || `Current (${editForm.deviceHealthId.slice(0, 8)}...)`}
                  </option>
                )}
              </select>
              {editErrors.deviceHealthId && (
                <p className="text-[10px] text-rose-400 leading-tight">{editErrors.deviceHealthId}</p>
              )}
            </div>

            {/* 8. Label / Barcode Tag */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Label / Barcode Tag
              </label>
              <input
                type="text"
                value={editForm.label}
                onChange={(e) => onFieldChange('label', e.target.value)}
                placeholder="e.g. LAB-FLOOR-2"
                disabled={isSubmitting || isPreviewRestricted}
                className="w-full bg-[#111622] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:border-[#ea8c34] focus:outline-none"
              />
            </div>

            {/* 9. Internal Comment */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Internal Comment / Notes
              </label>
              <input
                type="text"
                value={editForm.comment}
                onChange={(e) => onFieldChange('comment', e.target.value)}
                placeholder="Maintenance or specification note..."
                disabled={isSubmitting || isPreviewRestricted}
                className="w-full bg-[#111622] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-slate-200 font-mono transition-colors focus:border-[#ea8c34] focus:outline-none"
              />
            </div>
          </div>

          {/* Protected Fields Panel (Strictly Read-Only as per P09-AC02 / P09-AC03) */}
          <div className="p-3 bg-[#0d1017] rounded-lg border border-[#1b2332] text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#18202d]">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Protected Lifecycle & Responsibility Fields (Read-Only)</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToDetails(asset.id)}
                className="text-[10px] text-[#ea8c34] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Details & History (P07)</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">AC Owner (P10):</span>
                <span className="text-slate-300 font-medium truncate block">
                  {asset.acOwner ? asset.acOwner.fullName : 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Current User (P10):</span>
                <span className="text-slate-300 font-medium truncate block">
                  {asset.currentUser ? asset.currentUser.fullName : 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Department (P10):</span>
                <span className="text-slate-300 font-medium truncate block">
                  {asset.department || 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Cost Center (P10):</span>
                <span className="text-slate-300 font-medium truncate block">
                  {asset.costCenter || 'None'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              Ownership reassignment and cost-center transfer are reserved for Phase P10. Physical verifications belong to P11.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#1c2332] text-slate-300 border border-[#2b3548] text-[10px]">Esc</kbd> to Cancel</span>
              <span>•</span>
              <span>Explicit Save required</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                CANCEL
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={onSave}
                disabled={isSubmitting || isPreviewRestricted}
                leftIcon={
                  isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )
                }
              >
                {isSubmitting ? 'SAVING...' : hasChanges ? 'SAVE CHANGES' : 'SAVE (NO-OP)'}
              </Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};
