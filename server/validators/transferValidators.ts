import { isValidUuid } from './assetValidators.ts';
import type { ValidationResult } from './assetValidators.ts';

export interface CreateTransferValidatedData {
  changeAcOwner: boolean;
  toPersonId: string | null;

  changeCurrentUser: boolean;
  toCurrentUserId: string | null;

  changeDepartment: boolean;
  toDepartment: string | null;

  changeCostCenter: boolean;
  toCostCenter: string | null;

  changeLocation: boolean;
  toLocationId: string | null;

  eformNumber: string | null;
  notes: string | null;
}

export interface CompleteTransferValidatedData {
  eformNumber?: string;
  notes?: string | null;
}

export interface CancelTransferValidatedData {
  notes?: string | null;
}

const FORBIDDEN_TRANSFER_FIELDS: Record<string, string> = {
  id: "Transfer 'id' is server-generated and immutable.",
  assetId: "Asset ID must be specified via URL route parameter, not request body.",
  status: "Transfer status cannot be set directly; it follows the PENDING -> COMPLETED | CANCELLED lifecycle.",
  requestedAt: "Timestamp 'requestedAt' is set by the server on creation.",
  completedAt: "Timestamp 'completedAt' is set by the server upon completion.",
  cancelledAt: "Timestamp 'cancelledAt' is set by the server upon cancellation.",
  createdBy: "Actor identity is strictly derived from the authenticated server session.",
  actor: "Audit actor is strictly derived from the authenticated server session.",
  model: "Asset 'model' cannot be modified via transfer workflow.",
  assetNumber: "Asset Number cannot be modified via transfer workflow.",
  serialNumber: "Serial Number cannot be modified via transfer workflow.",
  typeId: "Asset Type cannot be modified via transfer workflow.",
  deviceHealthId: "Device Health cannot be modified via transfer workflow.",
  label: "Asset Label cannot be modified via transfer workflow.",
  comment: "Asset Comment cannot be modified via transfer workflow.",
};

/**
 * Validates input payload for creating a PENDING transfer (POST /api/assets/:assetId/transfers).
 */
export function validateCreateTransferInput(
  body: unknown
): ValidationResult<CreateTransferValidatedData> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request body must be a JSON object.',
      code: 'INVALID_FORMAT',
    };
  }

  const raw = body as Record<string, unknown>;

  // Check forbidden fields
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_TRANSFER_FIELDS[key]) {
      return {
        valid: false,
        error: FORBIDDEN_TRANSFER_FIELDS[key],
        field: key,
        code: 'FORBIDDEN_FIELD',
      };
    }
  }

  const changeAcOwner = Boolean(raw.changeAcOwner);
  let toPersonId: string | null = null;
  if (changeAcOwner) {
    if (raw.toPersonId !== undefined && raw.toPersonId !== null && raw.toPersonId !== '') {
      if (!isValidUuid(raw.toPersonId)) {
        return {
          valid: false,
          error: "Field 'toPersonId' (AC Owner destination) must be a valid UUID or null.",
          field: 'toPersonId',
          code: 'INVALID_FORMAT',
        };
      }
      toPersonId = String(raw.toPersonId).trim();
    }
  }

  const changeCurrentUser = Boolean(raw.changeCurrentUser);
  let toCurrentUserId: string | null = null;
  if (changeCurrentUser) {
    if (raw.toCurrentUserId !== undefined && raw.toCurrentUserId !== null && raw.toCurrentUserId !== '') {
      if (!isValidUuid(raw.toCurrentUserId)) {
        return {
          valid: false,
          error: "Field 'toCurrentUserId' (Current User destination) must be a valid UUID or null.",
          field: 'toCurrentUserId',
          code: 'INVALID_FORMAT',
        };
      }
      toCurrentUserId = String(raw.toCurrentUserId).trim();
    }
  }

  const changeDepartment = Boolean(raw.changeDepartment);
  let toDepartment: string | null = null;
  if (changeDepartment) {
    if (raw.toDepartment !== undefined && raw.toDepartment !== null) {
      if (typeof raw.toDepartment !== 'string') {
        return {
          valid: false,
          error: "Field 'toDepartment' must be a string or null.",
          field: 'toDepartment',
          code: 'INVALID_FORMAT',
        };
      }
      const trimmed = raw.toDepartment.trim();
      toDepartment = trimmed.length > 0 ? trimmed : null;
    }
  }

  const changeCostCenter = Boolean(raw.changeCostCenter);
  let toCostCenter: string | null = null;
  if (changeCostCenter) {
    if (raw.toCostCenter !== undefined && raw.toCostCenter !== null) {
      if (typeof raw.toCostCenter !== 'string') {
        return {
          valid: false,
          error: "Field 'toCostCenter' must be a string or null.",
          field: 'toCostCenter',
          code: 'INVALID_FORMAT',
        };
      }
      const trimmed = raw.toCostCenter.trim();
      toCostCenter = trimmed.length > 0 ? trimmed : null;
    }
  }

  const changeLocation = Boolean(raw.changeLocation);
  let toLocationId: string | null = null;
  if (changeLocation) {
    if (raw.toLocationId !== undefined && raw.toLocationId !== null && raw.toLocationId !== '') {
      if (!isValidUuid(raw.toLocationId)) {
        return {
          valid: false,
          error: "Field 'toLocationId' (Location destination) must be a valid UUID or null.",
          field: 'toLocationId',
          code: 'INVALID_FORMAT',
        };
      }
      toLocationId = String(raw.toLocationId).trim();
    }
  }

  // Validate that at least one dimension is explicitly requested to change
  if (
    !changeAcOwner &&
    !changeCurrentUser &&
    !changeDepartment &&
    !changeCostCenter &&
    !changeLocation
  ) {
    return {
      valid: false,
      error:
        'At least one transfer dimension (AC Owner, Current User, Department, Cost Center, or Location) must be selected for modification.',
      code: 'MISSING_REQUIRED',
    };
  }

  // Optional eformNumber at creation time
  let eformNumber: string | null = null;
  if (raw.eformNumber !== undefined && raw.eformNumber !== null) {
    if (typeof raw.eformNumber !== 'string') {
      return {
        valid: false,
        error: "Field 'eformNumber' must be a string.",
        field: 'eformNumber',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.eformNumber.trim();
    eformNumber = trimmed.length > 0 ? trimmed : null;
  }

  // Optional notes
  let notes: string | null = null;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      return {
        valid: false,
        error: "Field 'notes' must be a string.",
        field: 'notes',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.notes.trim();
    notes = trimmed.length > 0 ? trimmed : null;
  }

  return {
    valid: true,
    data: {
      changeAcOwner,
      toPersonId,
      changeCurrentUser,
      toCurrentUserId,
      changeDepartment,
      toDepartment,
      changeCostCenter,
      toCostCenter,
      changeLocation,
      toLocationId,
      eformNumber,
      notes,
    },
  };
}

/**
 * Validates input payload for completing a transfer (POST /api/assets/:assetId/transfers/:transferId/complete).
 */
export function validateCompleteTransferInput(
  body: unknown
): ValidationResult<CompleteTransferValidatedData> {
  const result: CompleteTransferValidatedData = {};

  if (!body) {
    return { valid: true, data: result };
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request body must be a JSON object.',
      code: 'INVALID_FORMAT',
    };
  }

  const raw = body as Record<string, unknown>;

  if (raw.eformNumber !== undefined && raw.eformNumber !== null) {
    if (typeof raw.eformNumber !== 'string') {
      return {
        valid: false,
        error: "Field 'eformNumber' must be a string.",
        field: 'eformNumber',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.eformNumber.trim();
    if (trimmed.length === 0) {
      return {
        valid: false,
        error: "Field 'eformNumber' cannot be an empty or whitespace string.",
        field: 'eformNumber',
        code: 'MISSING_REQUIRED',
      };
    }
    result.eformNumber = trimmed;
  }

  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      return {
        valid: false,
        error: "Field 'notes' must be a string.",
        field: 'notes',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.notes.trim();
    result.notes = trimmed.length > 0 ? trimmed : null;
  }

  return { valid: true, data: result };
}

/**
 * Validates input payload for cancelling a transfer (POST /api/assets/:assetId/transfers/:transferId/cancel).
 */
export function validateCancelTransferInput(
  body: unknown
): ValidationResult<CancelTransferValidatedData> {
  const result: CancelTransferValidatedData = {};

  if (!body) {
    return { valid: true, data: result };
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request body must be a JSON object.',
      code: 'INVALID_FORMAT',
    };
  }

  const raw = body as Record<string, unknown>;

  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      return {
        valid: false,
        error: "Field 'notes' must be a string.",
        field: 'notes',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.notes.trim();
    result.notes = trimmed.length > 0 ? trimmed : null;
  }

  return { valid: true, data: result };
}
