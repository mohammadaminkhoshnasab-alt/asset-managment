import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import type { NavigationRoute } from '../../types/navigation.ts';
import type {
  AssetTypeLookup,
  LocationLookup,
  DeviceHealthLookup,
  PersonLookup,
  NewAssetFormData,
  NewAssetFormErrors,
  CreatedAssetRecord,
  AssetStatusEnum,
} from '../../types/asset.ts';
import {
  validateNewAssetForm,
  buildCreateAssetPayload,
  VALID_STATUSES,
} from '../../utils/assetFormValidation.ts';
import {
  fetchCatalogs,
  INITIAL_LOOKUP_STATE,
  type LookupCatalogsState,
  type LookupFailure,
} from '../../utils/lookupClient.ts';
import { Panel } from '../ui/Panel.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { CreatePersonModal } from './CreatePersonModal.tsx';
import {
  PlusCircle,
  Cpu,
  Sliders,
  UserCheck,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  Copy,
  Check,
  Layers,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

interface NewAssetViewProps {
  onNavigate: (route: NavigationRoute | string) => void;
}

const INITIAL_FORM_DATA: NewAssetFormData = {
  model: '',
  assetNumber: '',
  serialNumber: '',
  typeId: '',
  status: 'SPARE',
  locationId: '',
  deviceHealthId: '',
  acOwnerId: '',
  currentUserId: '',
  department: '',
  costCenter: '',
  label: '',
  comment: '',
};

export const NewAssetView: React.FC<NewAssetViewProps> = ({ onNavigate }) => {
  const { previewMode, csrfToken, refreshSession } = useAuth();

  // Form State
  const [formData, setFormData] = useState<NewAssetFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<NewAssetFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [networkUncertain, setNetworkUncertain] = useState(false);

  // Success State
  const [createdAsset, setCreatedAsset] = useState<CreatedAssetRecord | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Lookups State
  const [assetTypes, setAssetTypes] = useState<AssetTypeLookup[]>([]);
  const [locations, setLocations] = useState<LocationLookup[]>([]);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealthLookup[]>([]);
  const [people, setPeople] = useState<PersonLookup[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [lookupFailures, setLookupFailures] = useState<LookupFailure[]>([]);

  // Keep a ref to current catalogs to preserve loaded options during partial re-fetches
  const catalogsRef = useRef<LookupCatalogsState>(INITIAL_LOOKUP_STATE);
  useEffect(() => {
    catalogsRef.current = { assetTypes, locations, deviceHealth, people };
  }, [assetTypes, locations, deviceHealth, people]);

  // Create Person Modal State
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);

  // Load Lookups from Backend APIs with granular partial-failure handling
  const fetchLookups = useCallback(async () => {
    setLookupsLoading(true);

    try {
      const result = await fetchCatalogs(catalogsRef.current);

      setAssetTypes(result.data.assetTypes);
      setLocations(result.data.locations);
      setDeviceHealth(result.data.deviceHealth);
      setPeople(result.data.people);

      setLookupFailures(result.failures);
      setLookupsError(result.summaryMessage);
    } catch {
      setLookupsError('Network connection error while fetching reference lookup options.');
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  // Field change handler
  const handleFieldChange = (
    field: keyof NewAssetFormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error when user modifies value
    if (errors[field as keyof NewAssetFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // AC Owner info derivation
  const selectedAcOwner = people.find((p) => p.id === formData.acOwnerId);
  const selectedCurrentUser = people.find((p) => p.id === formData.currentUserId);

  // Reset form
  const handleReset = () => {
    if (
      formData.model ||
      formData.assetNumber ||
      formData.serialNumber ||
      formData.comment
    ) {
      if (
        !window.confirm(
          'Discard uncommitted asset registration inputs and reset form to defaults?'
        )
      ) {
        return;
      }
    }
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setSubmitError(null);
    setNetworkUncertain(false);
    setCreatedAsset(null);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setNetworkUncertain(false);

    // Operational boundary: Preview Mode cannot perform database writes
    if (previewMode) {
      setSubmitError(
        'Action Blocked: Application is currently in Preview Inspection Mode. Database mutations are strictly disabled.'
      );
      return;
    }

    // 1. Client-Side Validation
    const validation = validateNewAssetForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSubmitError('Please correct the highlighted fields before submitting.');
      return;
    }

    setIsSubmitting(true);

    // 2. Prepare Payload (Strict contract adherence: empty strings -> null, no synthetic placeholders)
    const payload = buildCreateAssetPayload(formData);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const res = await fetch('/api/assets', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => ({}));

      // Success: HTTP 201 Created with persisted record
      if (res.status === 201 && responseData.data) {
        setCreatedAsset(responseData.data as CreatedAssetRecord);
        setIsSubmitting(false);
        return;
      }

      // Handle Known Error Statuses without losing input
      if (res.status === 400) {
        setSubmitError(
          responseData.error || 'Validation failed: Please check the provided asset values.'
        );
        if (responseData.field) {
          setErrors((prev) => ({
            ...prev,
            [responseData.field]: responseData.error,
          }));
        }
      } else if (res.status === 409) {
        // Duplicate Conflict (Asset Number or Serial Number)
        const conflictField = responseData.field || 'assetNumber';
        setSubmitError(
          responseData.error ||
            'Duplicate Conflict: An asset with the same identifier is already recorded.'
        );
        setErrors((prev) => ({
          ...prev,
          [conflictField]: responseData.error || 'Duplicate identifier conflict',
        }));
      } else if (res.status === 401) {
        setSubmitError(
          'Session Expired or Unauthenticated: Your administrative session is no longer active. Please re-authenticate.'
        );
        refreshSession();
      } else if (res.status === 403) {
        setSubmitError(
          'Security CSRF Error: Token verification failed. Please refresh your session and try again.'
        );
      } else {
        setSubmitError(
          responseData.error ||
            `Server error (HTTP ${res.status}): Failed to save asset to PostgreSQL database.`
        );
      }
    } catch {
      // Network drop or connection failure
      setNetworkUncertain(true);
      setSubmitError(
        'Network Connection Interrupted: Unable to contact the asset management server. If the request reached PostgreSQL, persistence status is unverified. Check the registry before resubmitting to avoid duplicate entries.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy UUID to clipboard
  const handleCopyId = (id: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // =========================================================================
  // RENDER: SUCCESS CONFIRMATION VIEW (Only shown after real HTTP 201)
  // =========================================================================
  if (createdAsset) {
    return (
      <div className="space-y-6 max-w-4xl animate-fadeIn">
        {/* Breadcrumb Header */}
        <div className="border-b border-[#1d2330] pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
              SUCCESS // HTTP 201 CREATED
            </span>
            <span className="font-mono text-xs text-slate-500">
              // AUDIT EVENT RECORDED
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase font-mono flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <span>HARDWARE ASSET REGISTERED</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            The asset specification and initial transactional audit log have been committed to PostgreSQL.
          </p>
        </div>

        {/* Server Confirmation Card */}
        <Panel
          systemTag="PERSISTED RECORD CONFIRMATION"
          title="Server-Assigned Hardware Record"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        >
          <div className="space-y-5">
            {/* Server-Generated Immutable UUID */}
            <div className="p-4 rounded-md bg-[#0d1016] border border-[#1f2633] flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="block text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
                  SERVER-ASSIGNED IMMUTABLE ASSET UUID
                </span>
                <span className="font-mono text-sm sm:text-base text-[#ea8c34] font-bold tracking-wide break-all">
                  {createdAsset.id}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyId(createdAsset.id)}
                leftIcon={
                  copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )
                }
              >
                {copiedId ? 'Copied' : 'Copy UUID'}
              </Button>
            </div>

            {/* Key Field Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
                <span className="block text-slate-500 text-[10px] uppercase">
                  Hardware Model
                </span>
                <span className="font-bold text-slate-200 text-sm mt-0.5 block truncate">
                  {createdAsset.model}
                </span>
              </div>

              <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
                <span className="block text-slate-500 text-[10px] uppercase">
                  Asset Number
                </span>
                <span className="font-bold text-slate-200 text-sm mt-0.5 block truncate">
                  {createdAsset.assetNumber || '— (NULL)'}
                </span>
              </div>

              <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
                <span className="block text-slate-500 text-[10px] uppercase">
                  Serial Number (SN)
                </span>
                <span className="font-bold text-slate-200 text-sm mt-0.5 block truncate">
                  {createdAsset.serialNumber || '— (NULL)'}
                </span>
              </div>

              <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a]">
                <span className="block text-slate-500 text-[10px] uppercase">
                  Status
                </span>
                <div className="mt-1">
                  <StatusBadge status={createdAsset.status} size="sm" />
                </div>
              </div>
            </div>

            {/* Audit Notice */}
            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a] text-xs text-slate-400 space-y-1">
              <span className="font-mono text-emerald-400 font-semibold block">
                ✓ P04 Transactional Audit History:
              </span>
              <p className="leading-relaxed">
                An initial <code>ASSET_CREATED</code> audit entry has been committed in the same database transaction.
                Full lifecycle audit history is preserved and immutable.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1d2330]">
              <Button
                variant="outline"
                size="md"
                onClick={() => onNavigate('dashboard')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Dashboard
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onNavigate(`/assets/${createdAsset.id}`)}
                  leftIcon={<ExternalLink className="w-4 h-4" />}
                >
                  View Asset Details
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setCreatedAsset(null);
                    setFormData(INITIAL_FORM_DATA);
                    setErrors({});
                    setSubmitError(null);
                  }}
                  leftIcon={<PlusCircle className="w-4 h-4" />}
                >
                  Register Another Asset
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  // =========================================================================
  // RENDER: NEW ASSET REGISTRATION FORM VIEW
  // =========================================================================
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="border-b border-[#1d2330] pb-5">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[#ea8c34] uppercase tracking-wider">
            PHASE P06 // ASSET REGISTRATION
          </span>
          <span className="font-mono text-xs text-slate-500">
            // WORKSPACE: NEW ASSET
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase font-mono">
          Register New Hardware Asset
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Register individual IT equipment into the PostgreSQL inventory registry with model specifications,
          independent identifiers, and initial assignment.
        </p>
      </div>

      {/* Preview Mode Warning Banner (Strict Operational Boundary) */}
      {previewMode && (
        <div className="p-4 rounded-md bg-amber-950/30 border border-amber-600/50 text-amber-200 text-xs font-mono space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>PREVIEW INSPECTION MODE ACTIVE</span>
          </div>
          <p className="leading-relaxed text-amber-300/90">
            Database persistence is strictly disabled in Preview Mode. Form layout, field controls, and client-side
            validation may be evaluated, but save operations are blocked to prevent fake records.
          </p>
        </div>
      )}

      {/* Lookup Catalog Error / Partial Failure Banner */}
      {lookupsError && (
        <div className="p-4 rounded-md bg-[#161a24] border border-[#263147] text-slate-300 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 max-w-2xl">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-slate-200 block">Catalog Notification:</span>
              <p className="leading-relaxed text-slate-300">{lookupsError}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLookups}
            isLoading={lookupsLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry Catalogs
          </Button>
        </div>
      )}

      {/* Submission Feedback Banner */}
      {submitError && (
        <div
          role="alert"
          className={`p-4 rounded-md border text-xs space-y-1.5 ${
            networkUncertain
              ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-bold font-mono uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {networkUncertain ? 'NETWORK UNCERTAIN' : 'SUBMISSION ERROR'}
            </span>
          </div>
          <p className="leading-relaxed">{submitError}</p>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* ========================================================================= */}
        {/* SECTION 1: HARDWARE IDENTIFICATION */}
        {/* ========================================================================= */}
        <Panel
          systemTag="SECTION 01 // CORE IDENTIFIERS"
          title="Hardware Identification"
          subtitle="Model and independent hardware identity numbers"
          icon={<Cpu className="w-4 h-4 text-[#ea8c34]" />}
        >
          <div className="space-y-4">
            {/* Model (Required) */}
            <Input
              label="Hardware Model *"
              id="asset-model"
              placeholder="e.g. ThinkPad T14 Gen 4, Dell Latitude 5540, MacBook Pro 16"
              value={formData.model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              error={errors.model}
              helperText="Required manufacturer model name or hardware equipment specification."
              required
            />

            {/* Asset Number vs Serial Number Grid (Independent) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <Input
                label="Accounting Asset Number (Optional)"
                id="asset-number"
                placeholder="e.g. AST-10042"
                value={formData.assetNumber}
                onChange={(e) => handleFieldChange('assetNumber', e.target.value)}
                error={errors.assetNumber}
                helperText="Internal accounting tag. Independent from Serial Number."
              />

              <Input
                label="Manufacturer Serial Number (SN) (Optional)"
                id="serial-number"
                placeholder="e.g. PF3X991A"
                value={formData.serialNumber}
                onChange={(e) => handleFieldChange('serialNumber', e.target.value)}
                error={errors.serialNumber}
                helperText="Manufacturer hardware serial. Independent from Asset Number."
              />
            </div>

            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a] text-[11px] font-mono text-slate-400">
              <span className="text-[#ea8c34] font-semibold">Note:</span> Asset Number and Serial Number
              are independent identifiers. Empty fields are stored as <code>NULL</code> in PostgreSQL;
              never as synthesized dummy values (such as "N/A").
            </div>
          </div>
        </Panel>

        {/* ========================================================================= */}
        {/* SECTION 2: CLASSIFICATION & CONDITION */}
        {/* ========================================================================= */}
        <Panel
          systemTag="SECTION 02 // LIFECYCLE & TYPE"
          title="Classification & Condition"
          subtitle="Category type, lifecycle state, physical location, and device health"
          icon={<Sliders className="w-4 h-4 text-[#ea8c34]" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Asset Type */}
            <div>
              <label
                htmlFor="asset-type-select"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Asset Classification Type
              </label>
              <select
                id="asset-type-select"
                value={formData.typeId}
                onChange={(e) => handleFieldChange('typeId', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
              >
                <option value="">-- Unassigned / Not Specified --</option>
                {assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {errors.typeId && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.typeId}</p>
              )}
            </div>

            {/* Lifecycle Status (Required, default SPARE) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="asset-status-select"
                  className="block text-xs font-mono tracking-wider uppercase text-slate-400"
                >
                  Lifecycle Status *
                </label>
                <StatusBadge status={formData.status} size="sm" />
              </div>
              <select
                id="asset-status-select"
                value={formData.status}
                onChange={(e) =>
                  handleFieldChange('status', e.target.value as AssetStatusEnum)
                }
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
                required
              >
                {VALID_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === 'SPARE' && 'SPARE — Available / In Storage (Default)'}
                    {status === 'IN_USE' && 'IN_USE — Assigned / Active Deployment'}
                    {status === 'DISPOSED' && 'DISPOSED — Decommissioned / Written Off'}
                    {status === 'UNKNOWN' && 'UNKNOWN — Unverified / Location Pending'}
                  </option>
                ))}
              </select>
            </div>

            {/* Physical Location */}
            <div>
              <label
                htmlFor="asset-location-select"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Physical Location
              </label>
              <select
                id="asset-location-select"
                value={formData.locationId}
                onChange={(e) => handleFieldChange('locationId', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
              >
                <option value="">-- Unassigned / Not Specified --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}{' '}
                    {loc.building || loc.floor
                      ? `[${loc.building || ''} ${loc.floor ? 'Fl ' + loc.floor : ''}]`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Device Health Classification */}
            <div>
              <label
                htmlFor="device-health-select"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Device Health Status
              </label>
              <select
                id="device-health-select"
                value={formData.deviceHealthId}
                onChange={(e) => handleFieldChange('deviceHealthId', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
              >
                <option value="">-- Unassigned / Not Evaluated --</option>
                {deviceHealth.map((health) => (
                  <option key={health.id} value={health.id}>
                    {health.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Panel>

        {/* ========================================================================= */}
        {/* SECTION 3: INITIAL ASSIGNMENT & RESPONSIBILITY */}
        {/* ========================================================================= */}
        <Panel
          systemTag="SECTION 03 // RESPONSIBILITY"
          title="Initial Assignment & Organization"
          subtitle="Assign responsible custodian, operator, department, and cost center"
          icon={<UserCheck className="w-4 h-4 text-[#ea8c34]" />}
          headerAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPersonModalOpen(true)}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Register Person
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AC Owner */}
              <div>
                <label
                  htmlFor="ac-owner-select"
                  className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
                >
                  AC Owner (Officially Responsible)
                </label>
                <select
                  id="ac-owner-select"
                  value={formData.acOwnerId}
                  onChange={(e) => handleFieldChange('acOwnerId', e.target.value)}
                  className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
                >
                  <option value="">-- Unassigned / No Official Custodian --</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}{' '}
                      {person.personalCode ? `[Code: ${person.personalCode}]` : ''}
                    </option>
                  ))}
                </select>

                {/* Display AC Owner's Personnel Code & Dept when selected */}
                {selectedAcOwner && (
                  <div className="mt-2 p-2.5 rounded bg-[#0d1016] border border-[#1d2330] text-[11px] font-mono space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Personnel Code:</span>
                      <strong className="text-[#ea8c34]">
                        {selectedAcOwner.personalCode || '— (None on record)'}
                      </strong>
                    </div>
                    {selectedAcOwner.department && (
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Department:</span>
                        <span>{selectedAcOwner.department}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 block pt-1 border-t border-[#1b202a]">
                      Personnel Code belongs to the Person record, not an asset identifier.
                    </span>
                  </div>
                )}
              </div>

              {/* Current User */}
              <div>
                <label
                  htmlFor="current-user-select"
                  className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
                >
                  Current User (Actual Operator)
                </label>
                <select
                  id="current-user-select"
                  value={formData.currentUserId}
                  onChange={(e) => handleFieldChange('currentUserId', e.target.value)}
                  className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none"
                >
                  <option value="">-- Unassigned / No Current Operator --</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}{' '}
                      {person.username ? `(@${person.username})` : ''}
                    </option>
                  ))}
                </select>

                {selectedCurrentUser && (
                  <div className="mt-2 p-2.5 rounded bg-[#0d1016] border border-[#1d2330] text-[11px] font-mono space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Username:</span>
                      <strong className="text-slate-200">
                        {selectedCurrentUser.username || '— (No system login)'}
                      </strong>
                    </div>
                    {selectedCurrentUser.department && (
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Department:</span>
                        <span>{selectedCurrentUser.department}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Department and Cost Center (Initial Registration Only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <Input
                label="Department Allocation"
                id="asset-department"
                placeholder="e.g. Finance & Accounting"
                value={formData.department}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                helperText="Department assignment established at initial registration."
              />

              <Input
                label="Cost Center"
                id="asset-cost-center"
                placeholder="e.g. CC-1040"
                value={formData.costCenter}
                onChange={(e) => handleFieldChange('costCenter', e.target.value)}
                helperText="Accounting cost center for asset depreciation."
              />
            </div>

            <div className="p-3 rounded bg-[#0a0c10] border border-[#1b202a] text-[11px] font-mono text-slate-400">
              <span className="text-[#ea8c34] font-semibold">Workflow Notice:</span> AC Owner and
              Current User are distinct entities. Subsequent custodial reassignments and transfer
              authorizations are recorded through the formal Transfer & eForm workflow (Phase P10).
            </div>
          </div>
        </Panel>

        {/* ========================================================================= */}
        {/* SECTION 4: NOTES & DESCRIPTIVE INFORMATION */}
        {/* ========================================================================= */}
        <Panel
          systemTag="SECTION 04 // METADATA"
          title="Operational Notes & Descriptive Information"
          subtitle="Custom descriptive labels and internal audit remarks"
          icon={<FileText className="w-4 h-4 text-[#ea8c34]" />}
        >
          <div className="space-y-4">
            <Input
              label="Descriptive Label (Optional)"
              id="asset-label"
              placeholder="e.g. Finance Team Lead Workstation, Lab Host 02"
              value={formData.label}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              helperText="Short identifying label displayed in overview lists and badges."
            />

            <div>
              <label
                htmlFor="asset-comment"
                className="block text-xs font-mono tracking-wider uppercase text-slate-400 mb-1.5"
              >
                Internal Audit Comment (Optional)
              </label>
              <textarea
                id="asset-comment"
                rows={3}
                placeholder="e.g. Procured under purchase order PO-8821. Delivered with standard USB-C charger and peripheral package."
                value={formData.comment}
                onChange={(e) => handleFieldChange('comment', e.target.value)}
                className="block w-full rounded-md bg-[#0d1015] border border-[#222938] hover:border-[#2f384c] focus:border-[#ea8c34] focus:ring-1 focus:ring-[#ea8c34]/30 text-slate-100 text-sm py-2 px-3 transition-colors duration-150 focus:outline-none placeholder-slate-600 resize-y"
              />
              <p className="mt-1.5 text-xs text-slate-500 font-mono">
                Preserved in asset specification and reflected in the initial audit log.
              </p>
            </div>
          </div>
        </Panel>

        {/* Form Action Bar */}
        <div className="p-5 rounded-lg bg-[#11141c] border border-[#1d2330] flex flex-wrap items-center justify-between gap-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleReset}
            disabled={isSubmitting}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Reset Form
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => onNavigate('dashboard')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={previewMode}
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              {previewMode ? 'Save Disabled (Preview Mode)' : 'Save Asset to Registry'}
            </Button>
          </div>
        </div>
      </form>

      {/* Explicit Create Person Modal */}
      <CreatePersonModal
        isOpen={isPersonModalOpen}
        onClose={() => setIsPersonModalOpen(false)}
        onSuccess={(newPerson) => {
          setPeople((prev) => [newPerson, ...prev]);
          // Automatically set as AC Owner if unassigned
          if (!formData.acOwnerId) {
            setFormData((prev) => ({ ...prev, acOwnerId: newPerson.id }));
          }
        }}
        csrfToken={csrfToken}
        previewMode={previewMode}
      />
    </div>
  );
};
