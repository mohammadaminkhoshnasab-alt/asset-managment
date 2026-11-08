export type VerificationOutcomeEnum =
  | 'VERIFIED_MATCH'
  | 'LOCATION_MISMATCH'
  | 'USER_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'NOT_FOUND'
  | 'DAMAGED';

export type DatePrecisionEnum = 'DAY' | 'MONTH';

export interface PhysicalVerificationRecord {
  id: string;
  assetId: string;
  verifiedBy: string;
  outcome: VerificationOutcomeEnum;
  isSuccessful: boolean;
  datePrecision: DatePrecisionEnum;
  verifiedYear: number;
  verifiedMonth: number;
  verifiedDay: number | null;
  verifiedDate: string | null;
  verifiedYearMonth: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateVerificationPayload {
  outcome: VerificationOutcomeEnum;
  isSuccessful: boolean;
  datePrecision: DatePrecisionEnum;
  verifiedYear: number;
  verifiedMonth: number;
  verifiedDay?: number | null;
  notes?: string | null;
}

export interface VerificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VerificationListResponse {
  status: 'ok' | 'error';
  data: PhysicalVerificationRecord[];
  pagination: VerificationPagination;
  error?: string;
}

export interface VerificationOutcomeOption {
  value: VerificationOutcomeEnum;
  label: string;
  description: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const VERIFICATION_OUTCOME_OPTIONS: VerificationOutcomeOption[] = [
  {
    value: 'VERIFIED_MATCH',
    label: 'VERIFIED_MATCH — Verified Match',
    description: 'Physical asset, tag, specs, location, and custodian match authoritative records.',
    badgeVariant: 'success',
  },
  {
    value: 'LOCATION_MISMATCH',
    label: 'LOCATION_MISMATCH — Location Mismatch',
    description: 'Asset physically located in different building, floor, or room than recorded.',
    badgeVariant: 'warning',
  },
  {
    value: 'USER_MISMATCH',
    label: 'USER_MISMATCH — User / Custodian Mismatch',
    description: 'Asset physically in possession of a different person or custodian than assigned.',
    badgeVariant: 'warning',
  },
  {
    value: 'STATUS_MISMATCH',
    label: 'STATUS_MISMATCH — Status Mismatch',
    description: 'Observed operating condition or usage differs from recorded lifecycle status.',
    badgeVariant: 'info',
  },
  {
    value: 'NOT_FOUND',
    label: 'NOT_FOUND — Not Found',
    description: 'Asset could not be located at expected or alternate physical inspection locations.',
    badgeVariant: 'danger',
  },
  {
    value: 'DAMAGED',
    label: 'DAMAGED — Damaged / Impaired',
    description: 'Physical damage, defect, or operational impairment observed on the device.',
    badgeVariant: 'danger',
  },
];
