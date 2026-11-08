import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import type {
  AssetDetails,
  PatchAssetFormValues,
  AssetAuditEventRecord,
  AssetStatusEnum,
} from '../../types/asset.ts';
import type { AssetTransferRecord } from '../../types/transfer.ts';
import {
  ALLOWED_PATCH_FIELDS,
  validatePatchForm,
  computePatchDelta,
} from '../../utils/assetPatchValidation.ts';
import {
  fetchCatalogs,
  INITIAL_LOOKUP_STATE,
  type LookupCatalogsState,
} from '../../utils/lookupClient.ts';
import { Panel } from '../ui/Panel.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { LoadingState } from '../ui/LoadingState.tsx';
import { AssetHistoryModal } from './AssetHistoryModal.tsx';
import { InitiateTransferModal } from './InitiateTransferModal.tsx';
import { CompleteTransferModal } from './CompleteTransferModal.tsx';
import { CancelTransferModal } from './CancelTransferModal.tsx';
import { AssetTransferHistory } from './AssetTransferHistory.tsx';
import {
  Cpu,
  Sliders,
  UserCheck,
  FileText,
  History,
  Edit3,
  Check,
  Copy,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Clock,
  ShieldCheck,
  Lock,
  Layers,
  Save,
  CheckCircle2,
  ArrowRightLeft,
} from 'lucide-react';

interface AssetDetailsViewProps {
  assetId: string;
  onNavigate: (route: string) => void;
}

export const AssetDetailsView: React.FC<AssetDetailsViewProps> = ({
  assetId,
  onNavigate,
}) => {
  const { previewMode, csrfToken, refreshSession } = useAuth();

  // Primary Asset & History State
  const [asset, setAsset] = useState<AssetDetails | null>(null);
  const [recentHistory, setRecentHistory] = useState<AssetAuditEventRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<PatchAssetFormValues | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Lookups for Edit Form
  const [catalogs, setCatalogs] = useState<LookupCatalogsState>(INITIAL_LOOKUP_STATE);
  const catalogsRef = useRef<LookupCatalogsState>(INITIAL_LOOKUP_STATE);

  // Modals & UI States
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState(false);

  // Transfer Workflow States (Phase P10)
  const [transfers, setTransfers] = useState<AssetTransferRecord[]>([]);
  const [isInitiateTransferOpen, setIsInitiateTransferOpen] = useState(false);
  const [completingTransfer, setCompletingTransfer] = useState<AssetTransferRecord | null>(null);
  const [cancellingTransfer, setCancellingTransfer] = useState<AssetTransferRecord | null>(null);

  // Load Reference Catalogs for Edit Mode & Transfers
  const loadCatalogs = useCallback(async () => {
    try {
      const result = await fetchCatalogs(catalogsRef.current);
      setCatalogs(result.data);
      catalogsRef.current = result.data;
    } catch {
      // Catalogs fallback gracefully
    }
  }, []);

  // Fetch Authoritative Asset Details, Recent History, and Transfers
  const fetchAssetData = useCallback(async () => {
    if (previewMode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [assetRes, historyRes, transferRes] = await Promise.all([
        fetch(`/api/assets/${assetId}`, { credentials: 'include' }),
        fetch(`/api/assets/${assetId}/history?page=1&limit=5`, { credentials: 'include' }),
        fetch(`/api/assets/${assetId}/transfers`, { credentials: 'include' }),
      ]);

      if (assetRes.ok) {
        const assetJson = await assetRes.json();
        setAsset(assetJson.data);
      } else if (assetRes.status === 404) {
        setLoadError(`Asset with UUID '${assetId}' was not found in the database registry.`);
        setIsLoading(false);
        return;
      } else if (assetRes.status === 400) {
        setLoadError("Invalid asset identifier format. Expected standard RFC 4122 UUID.");
        setIsLoading(false);
        return;
      } else if (assetRes.status === 401) {
        setLoadError("Administrative session required or expired (401 Unauthorized). Please sign in.");
        setIsLoading(false);
        return;
      } else {
        setLoadError(`Failed to load asset from server (Status: ${assetRes.status}).`);
        setIsLoading(false);
        return;
      }

      if (historyRes.ok) {
        const historyJson = await historyRes.json();
        setRecentHistory(historyJson.data || []);
        if (historyJson.pagination) {
          setHistoryTotal(historyJson.pagination.total);
        }
      }

      if (transferRes.ok) {
        const transferJson = await transferRes.json();
        setTransfers(transferJson.data || []);
      }
    } catch {
      setLoadError("Network connection error. Server or PostgreSQL database is unreachable.");
    } finally {
      setIsLoading(false);
    }
  }, [assetId, previewMode]);

  useEffect(() => {
    fetchAssetData();
    loadCatalogs();
  }, [fetchAssetData, loadCatalogs]);

  // Enter Edit Mode
  const handleStartEdit = () => {
    if (!asset) return;
    setEditForm({
      model: asset.model,
      assetNumber: asset.assetNumber || '',
      serialNumber: asset.serialNumber || '',
      typeId: asset.typeId || '',
      locationId: asset.locationId || '',
      deviceHealthId: asset.deviceHealthId || '',
      status: asset.status,
      label: asset.label || '',
      comment: asset.comment || '',
    });
    setEditErrors({});
    setSubmitFeedback(null);
    setIsEditing(true);
    loadCatalogs();
  };

  // Cancel Edit Mode
  const handleCancelEdit = () => {
    if (!asset || !editForm) {
      setIsEditing(false);
      return;
    }
    const delta = computePatchDelta(asset, editForm);
    if (delta.hasChanges) {
      if (!window.confirm('Discard unsaved modifications to this asset specification?')) {
        return;
      }
    }
    setIsEditing(false);
    setEditForm(null);
    setEditErrors({});
    setSubmitFeedback(null);
  };

  // Form Input Change Handler
  const handleFieldChange = (field: keyof PatchAssetFormValues, value: string) => {
    if (!editForm) return;
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : null));
    if (editErrors[field]) {
      setEditErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Save Edit Handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || !editForm) return;

    setSubmitFeedback(null);

    // 1. Client-Side Validation
    const validation = validatePatchForm(editForm);
    if (!validation.valid) {
      setEditErrors(validation.errors);
      setSubmitFeedback({
        type: 'error',
        message: 'Please resolve the highlighted validation errors before saving.',
      });
      return;
    }

    // 2. Compute Delta (No-Op Detection)
    const delta = computePatchDelta(asset, editForm);
    if (!delta.hasChanges) {
      setSubmitFeedback({
        type: 'info',
        message: 'No changes detected. Asset remains unchanged (No-Op).',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify(delta.delta),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        // Success: refresh authoritative record & history from backend
        await fetchAssetData();
        setIsEditing(false);
        setEditForm(null);
        setSubmitFeedback({
          type: 'success',
          message: data.message || 'Asset updated successfully and audit event recorded.',
        });
        return;
      }

      // Handle specific error codes without losing user inputs
      if (res.status === 400) {
        setSubmitFeedback({
          type: 'error',
          message: data.error || 'Validation error: Invalid asset parameters.',
        });
        if (data.field) {
          setEditErrors((prev) => ({ ...prev, [data.field]: data.error }));
        }
      } else if (res.status === 409) {
        const conflictField = data.field || 'assetNumber';
        setSubmitFeedback({
          type: 'error',
          message: data.error || 'Duplicate identifier conflict.',
        });
        setEditErrors((prev) => ({ ...prev, [conflictField]: data.error }));
      } else if (res.status === 401) {
        setSubmitFeedback({
          type: 'error',
          message: 'Administrative session expired. Please re-authenticate.',
        });
        refreshSession();
      } else if (res.status === 403) {
        setSubmitFeedback({
          type: 'error',
          message: 'Security validation error (CSRF). Please reload and try again.',
        });
      } else {
        setSubmitFeedback({
          type: 'error',
          message: data.error || `Server error (HTTP ${res.status}). Failed to update asset.`,
        });
      }
    } catch {
      setSubmitFeedback({
        type: 'error',
        message:
          'Network connection interrupted during save. Persistence is unverified. Please reload to check current status before re-attempting.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyUuid = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(assetId);
      setCopiedUuid(true);
      setTimeout(() => setCopiedUuid(false), 2000);
    }
  };

  const formatTimestamp = (iso?: string | null) => {
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

  // =========================================================================
  // RENDER: LOADING STATE
  // =========================================================================
  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingState message="RETRIEVING ASSET SPECIFICATION & AUDIT TRAIL..." />
      </div>
    );
  }

  // =========================================================================
  // RENDER: PREVIEW MODE PLACEHOLDER (Strict Operational Boundary)
  // =========================================================================
  if (previewMode) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="border-b border-[#1d2330] pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[#ea8c34] uppercase tracking-wider">
              PHASE P07 // PREVIEW INSPECTION MODE
            </span>
            <span className="font-mono text-xs text-slate-500">
              // ASSET UUID: {assetId}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase font-mono">
            Asset Details & Audit Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Deep route for individual hardware equipment records and transactional audit history.
          </p>
        </div>

        <Panel
          systemTag="ENVIRONMENT SPECIFICATION"
          title="Live Database Required for Individual Asset Records"
          icon={<Lock className="w-4 h-4 text-amber-400" />}
        >
          <div className="space-y-4 text-sm text-slate-300">
            <div className="p-4 rounded-md bg-[#0a0c10] border border-[#1f2633] font-mono text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>STATUS: PREVIEW INSPECTION MODE (NON-PERSISTENT)</span>
              </div>
              <p className="leading-relaxed">
                Real asset specifications, related lookup foreign keys, and immutable audit trails
                are retrieved directly from PostgreSQL through authenticated session APIs.
                In Preview Mode, simulated or fabricated records are strictly prohibited to prevent
                data pollution.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1d2330]">
              <Button
                variant="outline"
                size="md"
                onClick={() => onNavigate('dashboard')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Dashboard
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate('new-asset')}
              >
                Go to New Asset Form
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ERROR / NOT FOUND / UNREACHABLE
  // =========================================================================
  if (loadError || !asset) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="border-b border-[#1d2330] pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 uppercase tracking-wider">
              ERROR // RECORD UNREACHABLE
            </span>
            <span className="font-mono text-xs text-slate-500">
              // ASSET UUID: {assetId}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase font-mono">
            Unable to Load Asset
          </h1>
        </div>

        <Panel
          systemTag="SYSTEM DIAGNOSTIC"
          title="Asset Record Retrieval Notice"
          icon={<AlertCircle className="w-4 h-4 text-rose-400" />}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-rose-950/20 border border-rose-800/40 text-rose-200 text-xs font-mono">
              {loadError || 'Failed to locate requested asset record.'}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => onNavigate('dashboard')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Dashboard
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={fetchAssetData}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Retry Fetch
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ASSET DETAILS & EDITING VIEW
  // =========================================================================
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Title & Breadcrumb */}
      <div className="border-b border-[#1d2330] pb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[#ea8c34] uppercase tracking-wider">
              PHASE P07 // ASSET DETAILS
            </span>
            <span className="font-mono text-xs text-slate-500">
              // ID: {asset.id.slice(0, 8)}...
            </span>
            <StatusBadge status={asset.status} size="sm" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase font-mono">
            {asset.model}
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Registered: {formatTimestamp(asset.createdAt)} · Last Update: {formatTimestamp(asset.updatedAt)}
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          {!isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryModalOpen(true)}
                leftIcon={<History className="w-4 h-4" />}
              >
                Full Audit Trail ({historyTotal})
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartEdit}
                leftIcon={<Edit3 className="w-4 h-4" />}
              >
                Edit Asset
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                isLoading={isSubmitting}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {submitFeedback && (
        <div
          role="alert"
          className={`p-4 rounded-md border text-xs font-mono space-y-1 ${
            submitFeedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
              : submitFeedback.type === 'info'
              ? 'bg-[#181d28] border-[#29364d] text-slate-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            {submitFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : submitFeedback.type === 'info' ? (
              <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>
              {submitFeedback.type === 'success'
                ? 'OPERATION CONFIRMED'
                : submitFeedback.type === 'info'
                ? 'NOTICE'
                : 'UPDATE FAILED'}
            </span>
          </div>
          <p className="leading-relaxed">{submitFeedback.message}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: HARDWARE IDENTIFICATION */}
      {/* ========================================================================= */}
      <Panel
        systemTag="SECTION 01 // CORE IDENTIFIERS"
        title="Hardware Identification"
        subtitle={
          isEditing
            ? 'Editable general fields: Model, Accounting Asset Number, Serial Number'
            : 'Immutable system UUID and hardware equipment identity'
        }
        icon={<Cpu className="w-4 h-4 text-[#ea8c34]" />}
      >
        <div className="space-y-4">
          {/* Immutable UUID Display */}
          <div className="p-3.5 rounded bg-[#0d1016] border border-[#1f2633] flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="block text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
                SYSTEM ASSET UUID (IMMUTABLE)
              </span>
              <span className="font-mono text-sm text-[#ea8c34] font-bold tracking-wide break-all">
                {asset.id}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUuid}
              leftIcon={
                copiedUuid ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
            >
              {copiedUuid ? 'Copied' : 'Copy UUID'}
            </Button>
          </div>

          {!isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 font-mono text-xs">
              <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
                <span className="block text-[10px] text-slate-500 uppercase">Hardware Model</span>
                <span className="font-bold text-slate-200 text-sm mt-0.5 block truncate">
                  {asset.model}
                </span>
              </div>
              <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
                <span className="block text-[10px] text-slate-500 uppercase">
                  Accounting Asset Number
                </span>
                <span className="font-bold text-slate-200 text-sm mt-0.5 block truncate">
                  {asset.assetNumber || '— (None)'}
                </span>
              </div>
              <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
                <span className="block text-[10px] text-slate-500 uppercase">
                  Manufacturer Serial Number (SN)
                </span>
                <span className="font-bold text-slate-200 text-sm mt-0.5 block truncate">
                  {asset.serialNumber || '— (None)'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <Input
                label="Hardware Model *"
                id="edit-asset-model"
                value={editForm?.model || ''}
                onChange={(e) => handleFieldChange('model', e.target.value)}
                error={editErrors.model}
                helperText="Required hardware equipment model specification."
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Accounting Asset Number (Optional)"
                  id="edit-asset-number"
                  placeholder="e.g. AST-10042"
                  value={editForm?.assetNumber || ''}
                  onChange={(e) => handleFieldChange('assetNumber', e.target.value)}
                  error={editErrors.assetNumber}
                  helperText="Accounting tag. Independent from Serial Number."
                />

                <Input
                  label="Manufacturer Serial Number (SN) (Optional)"
                  id="edit-serial-number"
                  placeholder="e.g. PF3X991A"
                  value={editForm?.serialNumber || ''}
                  onChange={(e) => handleFieldChange('serialNumber', e.target.value)}
                  error={editErrors.serialNumber}
                  helperText="Manufacturer hardware serial. Independent from Asset Number."
                />
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* ========================================================================= */}
      {/* SECTION 2: CLASSIFICATION & CONDITION */}
      {/* ========================================================================= */}
      <Panel
        systemTag="SECTION 02 // LIFECYCLE & TYPE"
        title="Classification & Condition"
        subtitle={
          isEditing
            ? 'Editable general fields: Asset Type, Lifecycle Status, Location, Device Health'
            : 'Operational status, classification catalog, and physical location'
        }
        icon={<Sliders className="w-4 h-4 text-[#ea8c34]" />}
      >
        {!isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase">Classification Type</span>
              <span className="font-semibold text-slate-200 text-sm mt-0.5 block truncate">
                {asset.type?.name || '— (Unassigned)'}
              </span>
            </div>
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase">Lifecycle Status</span>
              <div className="mt-1">
                <StatusBadge status={asset.status} size="sm" />
              </div>
            </div>
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase">Physical Location</span>
              <span className="font-semibold text-slate-200 text-sm mt-0.5 block truncate">
                {asset.location?.name || '— (Unassigned)'}
              </span>
            </div>
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase">Device Health</span>
              <span className="font-semibold text-slate-200 text-sm mt-0.5 block truncate">
                {asset.deviceHealth?.name || '— (Unassigned)'}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-type-select"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Asset Classification Type
              </label>
              <select
                id="edit-type-select"
                value={editForm?.typeId || ''}
                onChange={(e) => handleFieldChange('typeId', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
              >
                <option value="">-- Unassigned / Not Specified --</option>
                {catalogs.assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="edit-status-select"
                  className="block text-xs font-mono tracking-wider uppercase text-slate-400"
                >
                  Lifecycle Status *
                </label>
                {editForm && <StatusBadge status={editForm.status} size="sm" />}
              </div>
              <select
                id="edit-status-select"
                value={editForm?.status || 'SPARE'}
                onChange={(e) => handleFieldChange('status', e.target.value as AssetStatusEnum)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
                required
              >
                <option value="SPARE">SPARE — Available / In Storage</option>
                <option value="IN_USE">IN_USE — Assigned / Active Deployment</option>
                <option value="DISPOSED">DISPOSED — Decommissioned / Written Off</option>
                <option value="UNKNOWN">UNKNOWN — Unverified / Location Pending</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-location-select"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Physical Location
              </label>
              <select
                id="edit-location-select"
                value={editForm?.locationId || ''}
                onChange={(e) => handleFieldChange('locationId', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
              >
                <option value="">-- Unassigned / Not Specified --</option>
                {catalogs.locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.building ? `[${loc.building}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-health-select"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Device Health Status
              </label>
              <select
                id="edit-health-select"
                value={editForm?.deviceHealthId || ''}
                onChange={(e) => handleFieldChange('deviceHealthId', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
              >
                <option value="">-- Unassigned / Not Evaluated --</option>
                {catalogs.deviceHealth.map((health) => (
                  <option key={health.id} value={health.id}>
                    {health.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Panel>

      {/* ========================================================================= */}
      {/* SECTION 3: RESPONSIBILITY & ASSIGNMENT (STRICTLY READ-ONLY BOUNDARY) */}
      {/* ========================================================================= */}
      <Panel
        systemTag="SECTION 03 // RESPONSIBILITY"
        title="Responsibility & Organization"
        subtitle="AC Owner, Current User, department, and cost center"
        icon={<UserCheck className="w-4 h-4 text-[#ea8c34]" />}
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                loadCatalogs();
                setIsInitiateTransferOpen(true);
              }}
              leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
              disabled={previewMode || !!transfers.find((t) => t.status === 'PENDING')}
            >
              Initiate Transfer
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            {/* AC Owner */}
            <div className="p-3.5 rounded bg-[#0a0c10] border border-[#1b202a] space-y-1">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                AC Owner (Officially Responsible)
              </span>
              <span className="font-bold text-slate-200 text-sm block">
                {asset.acOwner?.fullName || '— (No Official Custodian)'}
              </span>
              <div className="pt-1.5 border-t border-[#181d28] flex items-center justify-between text-slate-400 text-[11px]">
                <span>Personnel Code:</span>
                <strong className="text-[#ea8c34]">
                  {asset.acOwner?.personalCode || '— (None on record)'}
                </strong>
              </div>
            </div>

            {/* Current User */}
            <div className="p-3.5 rounded bg-[#0a0c10] border border-[#1b202a] space-y-1">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                Current User (Actual Operator)
              </span>
              <span className="font-bold text-slate-200 text-sm block">
                {asset.currentUser?.fullName || '— (No Current Operator)'}
              </span>
              <div className="pt-1.5 border-t border-[#181d28] flex items-center justify-between text-slate-400 text-[11px]">
                <span>System Username:</span>
                <strong className="text-slate-300">
                  {asset.currentUser?.username ? `@${asset.currentUser.username}` : '—'}
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase">Department Allocation</span>
              <span className="font-semibold text-slate-200 block mt-0.5">
                {asset.department || '— (None Allocated)'}
              </span>
            </div>
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase">Cost Center</span>
              <span className="font-semibold text-slate-200 block mt-0.5">
                {asset.costCenter || '— (None Allocated)'}
              </span>
            </div>
          </div>

          {/* Explicit Boundary Notice */}
          <div className="p-3 rounded bg-[#0d1016] border border-[#1d2330] text-[11px] font-mono text-slate-400 flex items-start gap-2.5">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-slate-200">Controlled Transfer Workflow:</strong> AC Owner,
              Current User, Department, and Cost Center cannot be modified via general asset editing.
              Custodial reassignments and inter-department transfers are strictly reserved for the
              Transfer & eForm workflow (Phase P10).
            </p>
          </div>
        </div>
      </Panel>

      {/* ========================================================================= */}
      {/* SECTION 3.5: CONTROLLED TRANSFER & eFORM WORKFLOW (PHASE P10) */}
      {/* ========================================================================= */}
      <Panel
        systemTag="SECTION 03.5 // TRANSFERS & eFORM"
        title="Controlled Transfer & eForm History"
        subtitle="Auditable per-asset custodial and organizational transfer history"
        icon={<ArrowRightLeft className="w-4 h-4 text-[#ea8c34]" />}
        headerAction={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadCatalogs();
              setIsInitiateTransferOpen(true);
            }}
            leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
            disabled={previewMode || !!transfers.find((t) => t.status === 'PENDING')}
          >
            Initiate Transfer
          </Button>
        }
      >
        <AssetTransferHistory
          transfers={transfers}
          onInitiateComplete={(t) => setCompletingTransfer(t)}
          onInitiateCancel={(t) => setCancellingTransfer(t)}
          previewMode={previewMode}
        />
      </Panel>

      {/* ========================================================================= */}
      {/* SECTION 4: OPERATIONAL NOTES & LABELS */}
      {/* ========================================================================= */}
      <Panel
        systemTag="SECTION 04 // METADATA"
        title="Operational Notes & Descriptive Information"
        subtitle={
          isEditing
            ? 'Editable general fields: Descriptive Label, Internal Audit Comment'
            : 'Descriptive identifiers and remarks'
        }
        icon={<FileText className="w-4 h-4 text-[#ea8c34]" />}
      >
        {!isEditing ? (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                Descriptive Label
              </span>
              <span className="text-slate-200 text-sm mt-0.5 block">
                {asset.label || '— (No label specified)'}
              </span>
            </div>

            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                Internal Audit Comment
              </span>
              <p className="text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                {asset.comment || '— (No audit comments recorded)'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Descriptive Label (Optional)"
              id="edit-asset-label"
              value={editForm?.label || ''}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              helperText="Short identifying label displayed in overviews and search."
            />

            <div>
              <label
                htmlFor="edit-asset-comment"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Internal Audit Comment (Optional)
              </label>
              <textarea
                id="edit-asset-comment"
                rows={3}
                value={editForm?.comment || ''}
                onChange={(e) => handleFieldChange('comment', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none placeholder-slate-600 resize-y"
              />
            </div>
          </div>
        )}
      </Panel>

      {/* ========================================================================= */}
      {/* SECTION 5: LATEST 5 AUDIT EVENTS (QUICK AUDIT TRAIL) */}
      {/* ========================================================================= */}
      <Panel
        systemTag="SECTION 05 // AUDIT TRAIL"
        title="Recent Audit Events (Latest 5)"
        subtitle="Chronological append-only transactional audit trail"
        icon={<History className="w-4 h-4 text-[#ea8c34]" />}
        headerAction={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryModalOpen(true)}
            leftIcon={<History className="w-3.5 h-3.5" />}
          >
            View Full History ({historyTotal})
          </Button>
        }
      >
        <div className="space-y-3">
          {recentHistory.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1f2633] rounded">
              NO AUDIT EVENTS RECORDED FOR THIS ASSET RECORD.
            </div>
          ) : (
            recentHistory.map((event) => (
              <div
                key={event.id}
                className="p-3.5 rounded bg-[#0d1016] border border-[#1b202a] text-xs font-mono space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181d28] pb-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
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
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#181d28] border border-[#283244] text-[#ea8c34] font-semibold">
                        eForm: {event.eformNumber}
                      </span>
                    )}
                    <span className="text-slate-300">@{event.actor || 'admin'}</span>
                  </div>
                  <span className="text-slate-500">{formatTimestamp(event.timestamp)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-slate-400">
                  <span className="text-slate-500">Changed:</span>
                  <span className="text-slate-200">
                    {event.changedFields?.join(', ') || 'Initial specification'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {/* Footer Navigation Action */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-[#11141c] border border-[#1d2330]">
        <Button
          variant="outline"
          size="md"
          onClick={() => onNavigate('dashboard')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Dashboard
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => onNavigate('new-asset')}
        >
          Register Another Asset
        </Button>
      </div>

      {/* Full Audit History Paginated Modal */}
      <AssetHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        assetId={asset.id}
        assetModel={asset.model}
      />

      {/* Controlled Transfer & eForm Workflow Modals (Phase P10) */}
      {isInitiateTransferOpen && (
        <InitiateTransferModal
          isOpen={isInitiateTransferOpen}
          onClose={() => setIsInitiateTransferOpen(false)}
          asset={asset}
          catalogs={catalogs}
          csrfToken={csrfToken}
          previewMode={previewMode}
          onTransferCreated={fetchAssetData}
        />
      )}

      {completingTransfer && (
        <CompleteTransferModal
          isOpen={!!completingTransfer}
          onClose={() => setCompletingTransfer(null)}
          transfer={completingTransfer}
          assetModel={asset.model}
          csrfToken={csrfToken}
          onCompleted={fetchAssetData}
        />
      )}

      {cancellingTransfer && (
        <CancelTransferModal
          isOpen={!!cancellingTransfer}
          onClose={() => setCancellingTransfer(null)}
          transfer={cancellingTransfer}
          assetModel={asset.model}
          csrfToken={csrfToken}
          onCancelled={fetchAssetData}
        />
      )}
    </div>
  );
};
