import type {
  AssetDetails,
  AssetListItem,
  PatchAssetFormValues,
  AssetStatusEnum,
} from '../types/asset.ts';
import { isValidUuidFormat, VALID_STATUSES } from './assetFormValidation.ts';

/**
 * The nine general fields permitted by Phase P04 for PATCH /api/assets/:id.
 */
export const ALLOWED_PATCH_FIELDS = [
  'model',
  'assetNumber',
  'serialNumber',
  'typeId',
  'locationId',
  'deviceHealthId',
  'status',
  'label',
  'comment',
] as const;

export type AllowedPatchField = (typeof ALLOWED_PATCH_FIELDS)[number];

export const FORBIDDEN_PATCH_FIELDS = [
  'id',
  'acOwnerId',
  'currentUserId',
  'acOwner',
  'currentUser',
  'department',
  'costCenter',
  'legacyNewCostCenter',
  'lastVerifiedAt',
  'lastVerifiedYearMonth',
  'lastVerificationOutcome',
  'verifications',
  'transfers',
  'auditEvents',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Validates the patch edit form inputs prior to submission.
 */
export function validatePatchForm(form: PatchAssetFormValues): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!form.model || form.model.trim().length === 0) {
    errors.model = 'Hardware Model is mandatory and must not be empty.';
  }

  if (!form.status || !VALID_STATUSES.includes(form.status)) {
    errors.status = `Status must be one of: ${VALID_STATUSES.join(', ')}.`;
  }

  if (form.typeId && form.typeId.trim() !== '') {
    if (!isValidUuidFormat(form.typeId)) {
      errors.typeId = 'Invalid Asset Type selected.';
    }
  }

  if (form.locationId && form.locationId.trim() !== '') {
    if (!isValidUuidFormat(form.locationId)) {
      errors.locationId = 'Invalid Location selected.';
    }
  }

  if (form.deviceHealthId && form.deviceHealthId.trim() !== '') {
    if (!isValidUuidFormat(form.deviceHealthId)) {
      errors.deviceHealthId = 'Invalid Device Health selected.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Computes the delta payload between original asset state and current edit form values.
 * - Extracts ONLY changed allowlisted fields.
 * - Normalizes empty strings to null.
 * - Detects no-op changes without emitting unnecessary network requests.
 */
export function computePatchDelta(
  original: AssetDetails | AssetListItem | Record<string, any>,
  form: PatchAssetFormValues
): {
  hasChanges: boolean;
  delta: Record<string, unknown>;
  changedFields: AllowedPatchField[];
} {
  const normalize = (val: unknown): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return String(val);
  };

  const delta: Record<string, unknown> = {};
  const changedFields: AllowedPatchField[] = [];

  for (const field of ALLOWED_PATCH_FIELDS) {
    const origVal = (original as any)[field];
    const formVal = (form as any)[field];

    if (field === 'status') {
      const origStatus = origVal as AssetStatusEnum;
      const formStatus = formVal as AssetStatusEnum;
      if (origStatus !== formStatus) {
        delta.status = formStatus;
        changedFields.push('status');
      }
      continue;
    }

    const normOrig = normalize(origVal);
    const normForm = normalize(formVal);

    if (normOrig !== normForm) {
      delta[field] = normForm;
      changedFields.push(field);
    }
  }

  return {
    hasChanges: changedFields.length > 0,
    delta,
    changedFields,
  };
}
