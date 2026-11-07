import type {
  NewAssetFormData,
  NewAssetFormErrors,
  CreateAssetApiPayload,
  AssetStatusEnum,
} from '../types/asset.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuidFormat(val?: string | null): boolean {
  if (!val) return false;
  return UUID_REGEX.test(val.trim());
}

export const VALID_STATUSES: AssetStatusEnum[] = [
  'SPARE',
  'IN_USE',
  'DISPOSED',
  'UNKNOWN',
];

/**
 * Validates the local client form data prior to sending an HTTP request.
 * Returns { valid: boolean, errors: NewAssetFormErrors }
 */
export function validateNewAssetForm(formData: NewAssetFormData): {
  valid: boolean;
  errors: NewAssetFormErrors;
} {
  const errors: NewAssetFormErrors = {};

  // 1. Model: Mandatory, non-empty
  if (!formData.model || formData.model.trim().length === 0) {
    errors.model = "Hardware Model is mandatory and must not be empty.";
  }

  // 2. Status: Must be valid enum
  if (!formData.status || !VALID_STATUSES.includes(formData.status)) {
    errors.status = `Status must be one of: ${VALID_STATUSES.join(', ')}.`;
  }

  // 3. Optional UUID validation if supplied
  if (formData.typeId && formData.typeId.trim() !== '') {
    if (!isValidUuidFormat(formData.typeId)) {
      errors.typeId = 'Invalid Asset Type selected.';
    }
  }

  if (formData.locationId && formData.locationId.trim() !== '') {
    if (!isValidUuidFormat(formData.locationId)) {
      errors.locationId = 'Invalid Location selected.';
    }
  }

  if (formData.deviceHealthId && formData.deviceHealthId.trim() !== '') {
    if (!isValidUuidFormat(formData.deviceHealthId)) {
      errors.deviceHealthId = 'Invalid Device Health status selected.';
    }
  }

  if (formData.acOwnerId && formData.acOwnerId.trim() !== '') {
    if (!isValidUuidFormat(formData.acOwnerId)) {
      errors.acOwnerId = 'Invalid AC Owner selected.';
    }
  }

  if (formData.currentUserId && formData.currentUserId.trim() !== '') {
    if (!isValidUuidFormat(formData.currentUserId)) {
      errors.currentUserId = 'Invalid Current User selected.';
    }
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

/**
 * Prepares the sanitized JSON payload for POST /api/assets matching P04 backend contracts.
 * Normalizes empty strings to null; never fabricates dummy identifiers.
 */
export function buildCreateAssetPayload(formData: NewAssetFormData): CreateAssetApiPayload {
  const sanitize = (val?: string | null): string | null => {
    if (!val) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const sanitizeUuid = (val?: string | null): string | null => {
    if (!val) return null;
    const trimmed = val.trim();
    return isValidUuidFormat(trimmed) ? trimmed : null;
  };

  return {
    model: formData.model.trim(),
    assetNumber: sanitize(formData.assetNumber),
    serialNumber: sanitize(formData.serialNumber),
    typeId: sanitizeUuid(formData.typeId),
    locationId: sanitizeUuid(formData.locationId),
    deviceHealthId: sanitizeUuid(formData.deviceHealthId),
    status: formData.status,
    label: sanitize(formData.label),
    comment: sanitize(formData.comment),
    acOwnerId: sanitizeUuid(formData.acOwnerId),
    currentUserId: sanitizeUuid(formData.currentUserId),
    department: sanitize(formData.department),
    costCenter: sanitize(formData.costCenter),
    legacyNewCostCenter: null,
  };
}
