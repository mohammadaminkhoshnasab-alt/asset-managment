import { DatePrecision, VerificationOutcome } from '@prisma/client';
import { isValidUuid } from './assetValidators.ts';
import type { ValidationResult } from './assetValidators.ts';

export const VALID_VERIFICATION_OUTCOMES: VerificationOutcome[] = [
  VerificationOutcome.VERIFIED_MATCH,
  VerificationOutcome.LOCATION_MISMATCH,
  VerificationOutcome.USER_MISMATCH,
  VerificationOutcome.STATUS_MISMATCH,
  VerificationOutcome.NOT_FOUND,
  VerificationOutcome.DAMAGED,
];

export const VALID_DATE_PRECISIONS: DatePrecision[] = [
  DatePrecision.DAY,
  DatePrecision.MONTH,
];

export interface CreateVerificationValidatedData {
  outcome: VerificationOutcome;
  isSuccessful: boolean;
  datePrecision: DatePrecision;
  verifiedYear: number;
  verifiedMonth: number;
  verifiedDay: number | null;
  verifiedDate: Date | null;
  verifiedYearMonth: string;
  notes: string | null;
}

export interface VerificationPaginationQuery {
  page: number;
  limit: number;
}

/**
 * Checks whether a given Gregorian year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the maximum days in a given Gregorian month (1-12) and year.
 */
export function getMaxDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Validates whether year, month, and day constitute a real valid Gregorian calendar date.
 */
export function isValidGregorianDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return false;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return false;
  }
  return day <= getMaxDaysInMonth(year, month);
}

const ALLOWED_CREATE_VERIFICATION_FIELDS = new Set([
  'outcome',
  'isSuccessful',
  'datePrecision',
  'verifiedYear',
  'verifiedMonth',
  'verifiedDay',
  'notes',
  '_csrf',
]);

const FORBIDDEN_VERIFICATION_FIELDS: Record<string, string> = {
  id: "Client-specified 'id' is prohibited; verification IDs are server-generated and immutable.",
  assetId: "Field 'assetId' cannot be specified in the request body; target asset is determined by the URL parameter.",
  verifiedBy: "Field 'verifiedBy' is derived solely from the authenticated server session and cannot be supplied by the client.",
  createdAt: "Creation timestamp is server-managed and immutable.",
  lastVerifiedAt: "Summary cache 'lastVerifiedAt' cannot be modified directly via verification payload.",
  lastVerifiedYearMonth: "Summary cache 'lastVerifiedYearMonth' cannot be modified directly via verification payload.",
  lastVerificationOutcome: "Summary cache 'lastVerificationOutcome' cannot be modified directly via verification payload.",
  actor: "Field 'actor' cannot be client-supplied; session identity is authoritative.",
  operationId: "Field 'operationId' is server-generated for transactional integrity.",
  status: "Asset status cannot be modified via physical verification endpoint.",
  locationId: "Location assignment cannot be modified via physical verification endpoint (reserved for P10).",
  acOwnerId: "AC Owner assignment cannot be modified via physical verification endpoint (reserved for P10).",
  currentUserId: "Current User assignment cannot be modified via physical verification endpoint (reserved for P10).",
  model: "Asset specifications cannot be modified via physical verification endpoint.",
  serialNumber: "Serial number cannot be modified via physical verification endpoint.",
  assetNumber: "Asset number cannot be modified via physical verification endpoint.",
};

/**
 * Validates request payload for creating a physical verification record.
 * Enforces calendar invariants, date precision constraints, and allowlisted schema contract.
 */
export function validateCreateVerificationInput(
  body: unknown
): ValidationResult<CreateVerificationValidatedData> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      error: 'Request body must be a JSON object',
      code: 'INVALID_FORMAT',
    };
  }

  const raw = body as Record<string, unknown>;
  const keys = Object.keys(raw);

  // 1. Detect explicitly forbidden and unknown fields
  for (const key of keys) {
    if (FORBIDDEN_VERIFICATION_FIELDS[key]) {
      return {
        valid: false,
        error: FORBIDDEN_VERIFICATION_FIELDS[key],
        field: key,
        code: 'FORBIDDEN_FIELD',
      };
    }
    if (!ALLOWED_CREATE_VERIFICATION_FIELDS.has(key)) {
      return {
        valid: false,
        error: `Unknown or unauthorized field '${key}' is not allowed in verification payload.`,
        field: key,
        code: 'UNKNOWN_FIELD',
      };
    }
  }

  // 2. Validate outcome (mandatory enum)
  if (!raw.outcome || typeof raw.outcome !== 'string') {
    return {
      valid: false,
      error: "Mandatory field 'outcome' is required and must be a valid VerificationOutcome enum value.",
      field: 'outcome',
      code: 'MISSING_REQUIRED',
    };
  }

  if (!VALID_VERIFICATION_OUTCOMES.includes(raw.outcome as VerificationOutcome)) {
    return {
      valid: false,
      error: `Invalid outcome '${raw.outcome}'. Must be one of: ${VALID_VERIFICATION_OUTCOMES.join(', ')}.`,
      field: 'outcome',
      code: 'INVALID_FORMAT',
    };
  }
  const outcome = raw.outcome as VerificationOutcome;

  // 3. Validate isSuccessful (optional boolean, defaults to true)
  // Semantics: isSuccessful indicates whether the inspection was successfully performed/completed.
  // An inspection that observes a mismatch or damage still counts as completed (isSuccessful=true).
  // isSuccessful=false is reserved for attempts that could not be completed (e.g. inaccessible device).
  let isSuccessful = true;
  if ('isSuccessful' in raw && raw.isSuccessful !== undefined) {
    if (typeof raw.isSuccessful !== 'boolean') {
      return {
        valid: false,
        error: "Field 'isSuccessful' must be a boolean value.",
        field: 'isSuccessful',
        code: 'INVALID_FORMAT',
      };
    }
    isSuccessful = raw.isSuccessful;
  }

  // 4. Validate datePrecision (mandatory enum: DAY or MONTH)
  if (!raw.datePrecision || typeof raw.datePrecision !== 'string') {
    return {
      valid: false,
      error: "Mandatory field 'datePrecision' is required and must be 'DAY' or 'MONTH'.",
      field: 'datePrecision',
      code: 'MISSING_REQUIRED',
    };
  }

  if (!VALID_DATE_PRECISIONS.includes(raw.datePrecision as DatePrecision)) {
    return {
      valid: false,
      error: `Invalid datePrecision '${raw.datePrecision}'. Must be 'DAY' or 'MONTH'.`,
      field: 'datePrecision',
      code: 'INVALID_FORMAT',
    };
  }
  const datePrecision = raw.datePrecision as DatePrecision;

  // 5. Validate verifiedYear (mandatory integer: 1900..2100)
  if (raw.verifiedYear === undefined || raw.verifiedYear === null) {
    return {
      valid: false,
      error: "Mandatory field 'verifiedYear' is required.",
      field: 'verifiedYear',
      code: 'MISSING_REQUIRED',
    };
  }
  const yearNum = Number(raw.verifiedYear);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return {
      valid: false,
      error: "Field 'verifiedYear' must be an integer between 1900 and 2100.",
      field: 'verifiedYear',
      code: 'INVALID_FORMAT',
    };
  }
  const verifiedYear = yearNum;

  // 6. Validate verifiedMonth (mandatory integer: 1..12)
  if (raw.verifiedMonth === undefined || raw.verifiedMonth === null) {
    return {
      valid: false,
      error: "Mandatory field 'verifiedMonth' is required.",
      field: 'verifiedMonth',
      code: 'MISSING_REQUIRED',
    };
  }
  const monthNum = Number(raw.verifiedMonth);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    return {
      valid: false,
      error: "Field 'verifiedMonth' must be an integer between 1 and 12.",
      field: 'verifiedMonth',
      code: 'INVALID_FORMAT',
    };
  }
  const verifiedMonth = monthNum;

  // Canonical YYYY-MM string
  const verifiedYearMonth = `${verifiedYear}-${String(verifiedMonth).padStart(2, '0')}`;

  let verifiedDay: number | null = null;
  let verifiedDate: Date | null = null;

  // 7. Validate Calendar and Precision Invariants
  if (datePrecision === DatePrecision.DAY) {
    // DAY precision requires verifiedDay
    if (raw.verifiedDay === undefined || raw.verifiedDay === null) {
      return {
        valid: false,
        error: "When datePrecision is 'DAY', mandatory field 'verifiedDay' must be provided.",
        field: 'verifiedDay',
        code: 'MISSING_REQUIRED',
      };
    }
    const dayNum = Number(raw.verifiedDay);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
      return {
        valid: false,
        error: "Field 'verifiedDay' must be an integer between 1 and 31.",
        field: 'verifiedDay',
        code: 'INVALID_FORMAT',
      };
    }

    if (!isValidGregorianDate(verifiedYear, verifiedMonth, dayNum)) {
      const maxDays = getMaxDaysInMonth(verifiedYear, verifiedMonth);
      return {
        valid: false,
        error: `Invalid calendar date ${verifiedYear}-${String(verifiedMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}. Month ${verifiedMonth} in year ${verifiedYear} has at most ${maxDays} days.`,
        field: 'verifiedDay',
        code: 'INVALID_FORMAT',
      };
    }

    verifiedDay = dayNum;
    // Store as timezone-neutral UTC midnight Date
    verifiedDate = new Date(Date.UTC(verifiedYear, verifiedMonth - 1, verifiedDay));
  } else {
    // MONTH precision: verifiedDay must NOT be supplied
    if (raw.verifiedDay !== undefined && raw.verifiedDay !== null) {
      return {
        valid: false,
        error: "When datePrecision is 'MONTH', 'verifiedDay' must not be provided; month-only observations preserve unknown day without fabricating one.",
        field: 'verifiedDay',
        code: 'FORBIDDEN_FIELD',
      };
    }
    verifiedDay = null;
    verifiedDate = null;
  }

  // 8. Validate notes (optional string, max 1000 chars)
  let notes: string | null = null;
  if ('notes' in raw && raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      return {
        valid: false,
        error: "Field 'notes' must be a string or null.",
        field: 'notes',
        code: 'INVALID_FORMAT',
      };
    }
    const trimmed = raw.notes.trim();
    if (trimmed.length > 1000) {
      return {
        valid: false,
        error: "Field 'notes' cannot exceed 1000 characters.",
        field: 'notes',
        code: 'INVALID_FORMAT',
      };
    }
    notes = trimmed.length > 0 ? trimmed : null;
  }

  return {
    valid: true,
    data: {
      outcome,
      isSuccessful,
      datePrecision,
      verifiedYear,
      verifiedMonth,
      verifiedDay,
      verifiedDate,
      verifiedYearMonth,
      notes,
    },
  };
}

/**
 * Validates pagination query parameters for GET /api/assets/:assetId/verifications.
 */
export function validateVerificationPaginationQuery(
  query: Record<string, unknown>
): ValidationResult<VerificationPaginationQuery> {
  let page = 1;
  let limit = 20;

  if (query.page !== undefined) {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return {
        valid: false,
        error: "Query parameter 'page' must be a positive integer >= 1.",
        field: 'page',
        code: 'INVALID_FORMAT',
      };
    }
    page = parsedPage;
  }

  if (query.limit !== undefined) {
    const parsedLimit = Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return {
        valid: false,
        error: "Query parameter 'limit' must be an integer between 1 and 100.",
        field: 'limit',
        code: 'INVALID_FORMAT',
      };
    }
    limit = parsedLimit;
  }

  return {
    valid: true,
    data: { page, limit },
  };
}
