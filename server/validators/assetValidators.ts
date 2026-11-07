import { AssetStatus } from '@prisma/client';

export const VALID_ASSET_STATUSES: AssetStatus[] = [
  AssetStatus.IN_USE,
  AssetStatus.SPARE,
  AssetStatus.DISPOSED,
  AssetStatus.UNKNOWN,
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a value is a standard RFC 4122 UUID.
 */
export function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

export interface ValidationSuccess<T> {
  valid: true;
  data: T;
}

export interface ValidationFailure {
  valid: false;
  error: string;
  field?: string;
  code?: 'INVALID_FORMAT' | 'MISSING_REQUIRED' | 'FORBIDDEN_FIELD' | 'UNKNOWN_FIELD';
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface CreateAssetValidatedData {
  model: string;
  assetNumber: string | null;
  serialNumber: string | null;
  typeId: string | null;
  locationId: string | null;
  deviceHealthId: string | null;
  status: AssetStatus;
  label: string | null;
  comment: string | null;
  acOwnerId: string | null;
  currentUserId: string | null;
  department: string | null;
  costCenter: string | null;
  legacyNewCostCenter: string | null;
}

/**
 * Validates input payload for asset creation (POST /api/assets).
 */
export function validateCreateAssetInput(body: unknown): ValidationResult<CreateAssetValidatedData> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request body must be a JSON object',
      code: 'INVALID_FORMAT',
    };
  }

  const raw = body as Record<string, unknown>;

  // Disallow client-specified immutable ID
  if ('id' in raw) {
    return {
      valid: false,
      error: "Client-specified 'id' is prohibited; asset IDs are server-generated and immutable.",
      field: 'id',
      code: 'FORBIDDEN_FIELD',
    };
  }

  // 1. Mandatory model validation
  if (!raw.model || typeof raw.model !== 'string' || raw.model.trim().length === 0) {
    return {
      valid: false,
      error: "Mandatory field 'model' is required and must be a non-empty string.",
      field: 'model',
      code: 'MISSING_REQUIRED',
    };
  }
  const model = raw.model.trim();

  // 2. Identifiers: Asset Number & Serial Number (independent & optional; missing stored as null)
  let assetNumber: string | null = null;
  if (raw.assetNumber !== undefined && raw.assetNumber !== null) {
    if (typeof raw.assetNumber !== 'string') {
      return {
        valid: false,
        error: "Field 'assetNumber' must be a string or null.",
        field: 'assetNumber',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.assetNumber.trim();
    assetNumber = trimmed.length > 0 ? trimmed : null;
  }

  let serialNumber: string | null = null;
  if (raw.serialNumber !== undefined && raw.serialNumber !== null) {
    if (typeof raw.serialNumber !== 'string') {
      return {
        valid: false,
        error: "Field 'serialNumber' must be a string or null.",
        field: 'serialNumber',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.serialNumber.trim();
    serialNumber = trimmed.length > 0 ? trimmed : null;
  }

  // 3. Status validation (defaults to SPARE if not provided)
  let status: AssetStatus = AssetStatus.SPARE;
  if (raw.status !== undefined && raw.status !== null) {
    if (typeof raw.status !== 'string' || !VALID_ASSET_STATUSES.includes(raw.status as AssetStatus)) {
      return {
        valid: false,
        error: `Field 'status' must be one of: ${VALID_ASSET_STATUSES.join(', ')}.`,
        field: 'status',
        code: 'INVALID_FORMAT',
      };
    }
    status = raw.status as AssetStatus;
  }

  // 4. Foreign key references (UUID format checks)
  let typeId: string | null = null;
  if (raw.typeId !== undefined && raw.typeId !== null && raw.typeId !== '') {
    if (!isValidUuid(raw.typeId)) {
      return {
        valid: false,
        error: "Field 'typeId' must be a valid UUID.",
        field: 'typeId',
        code: 'INVALID_FORMAT',
      };
    }
    typeId = raw.typeId.trim();
  }

  let locationId: string | null = null;
  if (raw.locationId !== undefined && raw.locationId !== null && raw.locationId !== '') {
    if (!isValidUuid(raw.locationId)) {
      return {
        valid: false,
        error: "Field 'locationId' must be a valid UUID.",
        field: 'locationId',
        code: 'INVALID_FORMAT',
      };
    }
    locationId = raw.locationId.trim();
  }

  let deviceHealthId: string | null = null;
  if (raw.deviceHealthId !== undefined && raw.deviceHealthId !== null && raw.deviceHealthId !== '') {
    if (!isValidUuid(raw.deviceHealthId)) {
      return {
        valid: false,
        error: "Field 'deviceHealthId' must be a valid UUID.",
        field: 'deviceHealthId',
        code: 'INVALID_FORMAT',
      };
    }
    deviceHealthId = raw.deviceHealthId.trim();
  }

  // Optional initial assignment foreign keys
  let acOwnerId: string | null = null;
  if (raw.acOwnerId !== undefined && raw.acOwnerId !== null && raw.acOwnerId !== '') {
    if (!isValidUuid(raw.acOwnerId)) {
      return {
        valid: false,
        error: "Field 'acOwnerId' must be a valid UUID.",
        field: 'acOwnerId',
        code: 'INVALID_FORMAT',
      };
    }
    acOwnerId = raw.acOwnerId.trim();
  }

  let currentUserId: string | null = null;
  if (raw.currentUserId !== undefined && raw.currentUserId !== null && raw.currentUserId !== '') {
    if (!isValidUuid(raw.currentUserId)) {
      return {
        valid: false,
        error: "Field 'currentUserId' must be a valid UUID.",
        field: 'currentUserId',
        code: 'INVALID_FORMAT',
      };
    }
    currentUserId = raw.currentUserId.trim();
  }

  // 5. Text fields
  const label = typeof raw.label === 'string' ? raw.label.trim() : null;
  const comment = typeof raw.comment === 'string' ? raw.comment.trim() : null;
  const department = typeof raw.department === 'string' ? raw.department.trim() : null;
  const costCenter = typeof raw.costCenter === 'string' ? raw.costCenter.trim() : null;
  const legacyNewCostCenter = typeof raw.legacyNewCostCenter === 'string' ? raw.legacyNewCostCenter.trim() : null;

  // 6. Check for disallowed verification or audit fields
  if ('lastVerifiedAt' in raw || 'lastVerifiedYearMonth' in raw || 'lastVerificationOutcome' in raw) {
    return {
      valid: false,
      error: 'Physical verification fields cannot be initialized on creation; they belong to the verification workflow (P11).',
      code: 'FORBIDDEN_FIELD',
    };
  }

  return {
    valid: true,
    data: {
      model,
      assetNumber,
      serialNumber,
      typeId,
      locationId,
      deviceHealthId,
      status,
      label,
      comment,
      acOwnerId,
      currentUserId,
      department,
      costCenter,
      legacyNewCostCenter,
    },
  };
}

export interface PatchAssetValidatedData {
  model?: string;
  assetNumber?: string | null;
  serialNumber?: string | null;
  typeId?: string | null;
  locationId?: string | null;
  deviceHealthId?: string | null;
  status?: AssetStatus;
  label?: string | null;
  comment?: string | null;
}

// Fields explicitly reserved for future workflow phases
const FORBIDDEN_PATCH_FIELDS: Record<string, string> = {
  id: "Asset 'id' is immutable and cannot be modified.",
  acOwnerId: "Field 'acOwnerId' cannot be modified directly via general asset update; ownership changes are reserved for the transfer workflow (Phase P10).",
  currentUserId: "Field 'currentUserId' cannot be modified directly via general asset update; user assignment changes are reserved for the transfer workflow (Phase P10).",
  acOwner: "Field 'acOwner' cannot be modified directly via general asset update (Phase P10).",
  currentUser: "Field 'currentUser' cannot be modified directly via general asset update (Phase P10).",
  department: "Field 'department' cannot be modified directly via general asset update; department reassignment is reserved for the transfer workflow (Phase P10).",
  costCenter: "Field 'costCenter' cannot be modified directly via general asset update; cost center reassignment is reserved for the transfer workflow (Phase P10).",
  legacyNewCostCenter: "Field 'legacyNewCostCenter' cannot be modified via general asset update (Phase P10).",
  eformNumber: "Transfer eForm numbers cannot be modified via general asset update (Phase P10).",
  eFormNumber: "Transfer eForm numbers cannot be modified via general asset update (Phase P10).",
  transfers: "Transfers history cannot be modified via general asset update (Phase P10).",
  lastVerifiedAt: "Physical verification timestamp cannot be modified via general asset update (Phase P11).",
  lastVerifiedYearMonth: "Physical verification date cannot be modified via general asset update (Phase P11).",
  lastVerificationOutcome: "Physical verification outcome cannot be modified via general asset update (Phase P11).",
  verifications: "Verification history cannot be modified via general asset update (Phase P11).",
  auditEvents: "Audit events are append-only and cannot be manually modified.",
  followUps: "Follow-ups cannot be modified via general asset update.",
  createdAt: "Creation timestamp is immutable.",
  updatedAt: "Update timestamp is managed automatically by the database.",
};

const ALLOWED_PATCH_FIELDS = new Set([
  'model',
  'assetNumber',
  'serialNumber',
  'typeId',
  'locationId',
  'deviceHealthId',
  'status',
  'label',
  'comment',
]);

/**
 * Validates input payload for general asset patch (PATCH /api/assets/:id).
 * Strictly forbids reserved assignment, verification, and audit fields.
 */
export function validatePatchAssetInput(body: unknown): ValidationResult<PatchAssetValidatedData> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request body must be a JSON object',
      code: 'INVALID_FORMAT',
    };
  }

  const raw = body as Record<string, unknown>;
  const keys = Object.keys(raw);

  if (keys.length === 0) {
    return {
      valid: false,
      error: 'At least one valid field must be provided for update.',
      code: 'MISSING_REQUIRED',
    };
  }

  // 1. Check for forbidden fields
  for (const key of keys) {
    if (FORBIDDEN_PATCH_FIELDS[key]) {
      return {
        valid: false,
        error: FORBIDDEN_PATCH_FIELDS[key],
        field: key,
        code: 'FORBIDDEN_FIELD',
      };
    }
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      return {
        valid: false,
        error: `Unknown or unsupported field '${key}' cannot be updated.`,
        field: key,
        code: 'UNKNOWN_FIELD',
      };
    }
  }

  const validated: PatchAssetValidatedData = {};

  // 2. Validate allowed fields
  if ('model' in raw) {
    if (typeof raw.model !== 'string' || raw.model.trim().length === 0) {
      return {
        valid: false,
        error: "Field 'model' must be a non-empty string.",
        field: 'model',
        code: 'INVALID_FORMAT',
      };
    }
    validated.model = raw.model.trim();
  }

  if ('assetNumber' in raw) {
    if (raw.assetNumber === null || raw.assetNumber === '') {
      validated.assetNumber = null;
    } else if (typeof raw.assetNumber === 'string') {
      const trimmed = raw.assetNumber.trim();
      validated.assetNumber = trimmed.length > 0 ? trimmed : null;
    } else {
      return {
        valid: false,
        error: "Field 'assetNumber' must be a string or null.",
        field: 'assetNumber',
        code: 'INVALID_FORMAT',
      };
    }
  }

  if ('serialNumber' in raw) {
    if (raw.serialNumber === null || raw.serialNumber === '') {
      validated.serialNumber = null;
    } else if (typeof raw.serialNumber === 'string') {
      const trimmed = raw.serialNumber.trim();
      validated.serialNumber = trimmed.length > 0 ? trimmed : null;
    } else {
      return {
        valid: false,
        error: "Field 'serialNumber' must be a string or null.",
        field: 'serialNumber',
        code: 'INVALID_FORMAT',
      };
    }
  }

  if ('typeId' in raw) {
    if (raw.typeId === null || raw.typeId === '') {
      validated.typeId = null;
    } else if (isValidUuid(raw.typeId)) {
      validated.typeId = (raw.typeId as string).trim();
    } else {
      return {
        valid: false,
        error: "Field 'typeId' must be a valid UUID or null.",
        field: 'typeId',
        code: 'INVALID_FORMAT',
      };
    }
  }

  if ('locationId' in raw) {
    if (raw.locationId === null || raw.locationId === '') {
      validated.locationId = null;
    } else if (isValidUuid(raw.locationId)) {
      validated.locationId = (raw.locationId as string).trim();
    } else {
      return {
        valid: false,
        error: "Field 'locationId' must be a valid UUID or null.",
        field: 'locationId',
        code: 'INVALID_FORMAT',
      };
    }
  }

  if ('deviceHealthId' in raw) {
    if (raw.deviceHealthId === null || raw.deviceHealthId === '') {
      validated.deviceHealthId = null;
    } else if (isValidUuid(raw.deviceHealthId)) {
      validated.deviceHealthId = (raw.deviceHealthId as string).trim();
    } else {
      return {
        valid: false,
        error: "Field 'deviceHealthId' must be a valid UUID or null.",
        field: 'deviceHealthId',
        code: 'INVALID_FORMAT',
      };
    }
  }

  if ('status' in raw) {
    if (typeof raw.status !== 'string' || !VALID_ASSET_STATUSES.includes(raw.status as AssetStatus)) {
      return {
        valid: false,
        error: `Field 'status' must be one of: ${VALID_ASSET_STATUSES.join(', ')}.`,
        field: 'status',
        code: 'INVALID_FORMAT',
      };
    }
    validated.status = raw.status as AssetStatus;
  }

  if ('label' in raw) {
    if (raw.label === null) {
      validated.label = null;
    } else if (typeof raw.label === 'string') {
      validated.label = raw.label.trim();
    } else {
      return {
        valid: false,
        error: "Field 'label' must be a string or null.",
        field: 'label',
        code: 'INVALID_FORMAT',
      };
    }
  }

  if ('comment' in raw) {
    if (raw.comment === null) {
      validated.comment = null;
    } else if (typeof raw.comment === 'string') {
      validated.comment = raw.comment.trim();
    } else {
      return {
        valid: false,
        error: "Field 'comment' must be a string or null.",
        field: 'comment',
        code: 'INVALID_FORMAT',
      };
    }
  }

  return {
    valid: true,
    data: validated,
  };
}
