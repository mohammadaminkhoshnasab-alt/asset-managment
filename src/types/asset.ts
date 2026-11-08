export interface AssetTypeLookup {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface LocationLookup {
  id: string;
  name: string;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface DeviceHealthLookup {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface PersonLookup {
  id: string;
  fullName: string;
  personalCode?: string | null;
  username?: string | null;
  department?: string | null;
  costCenter?: string | null;
  email?: string | null;
  isActive: boolean;
}

export type AssetStatusEnum = 'IN_USE' | 'SPARE' | 'DISPOSED' | 'UNKNOWN';

export interface NewAssetFormData {
  model: string;
  assetNumber: string;
  serialNumber: string;
  typeId: string;
  status: AssetStatusEnum;
  locationId: string;
  deviceHealthId: string;
  acOwnerId: string;
  currentUserId: string;
  department: string;
  costCenter: string;
  label: string;
  comment: string;
}

export interface NewAssetFormErrors {
  model?: string;
  assetNumber?: string;
  serialNumber?: string;
  typeId?: string;
  status?: string;
  locationId?: string;
  deviceHealthId?: string;
  acOwnerId?: string;
  currentUserId?: string;
  general?: string;
}

export interface CreateAssetApiPayload {
  model: string;
  assetNumber: string | null;
  serialNumber: string | null;
  typeId: string | null;
  locationId: string | null;
  deviceHealthId: string | null;
  status: AssetStatusEnum;
  label: string | null;
  comment: string | null;
  acOwnerId: string | null;
  currentUserId: string | null;
  department: string | null;
  costCenter: string | null;
  legacyNewCostCenter: string | null;
}

export interface CreatedAssetRecord {
  id: string;
  model: string;
  assetNumber: string | null;
  serialNumber: string | null;
  status: AssetStatusEnum;
  typeId: string | null;
  locationId: string | null;
  deviceHealthId: string | null;
  acOwnerId: string | null;
  currentUserId: string | null;
  department: string | null;
  costCenter: string | null;
  label: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDetails extends CreatedAssetRecord {
  legacyNewCostCenter?: string | null;
  type?: AssetTypeLookup | null;
  location?: LocationLookup | null;
  deviceHealth?: DeviceHealthLookup | null;
  acOwner?: PersonLookup | null;
  currentUser?: PersonLookup | null;
  lastVerifiedAt?: string | null;
  lastVerifiedYearMonth?: string | null;
  lastVerificationOutcome?: 'VERIFIED_MATCH' | 'LOCATION_MISMATCH' | 'USER_MISMATCH' | 'STATUS_MISMATCH' | 'NOT_FOUND' | 'DAMAGED' | null;
}

export interface PatchAssetFormValues {
  model: string;
  assetNumber: string;
  serialNumber: string;
  typeId: string;
  locationId: string;
  deviceHealthId: string;
  status: AssetStatusEnum;
  label: string;
  comment: string;
}

export interface AssetAuditEventRecord {
  id: string;
  assetId: string;
  timestamp: string;
  actor: string;
  source: string;
  action: string;
  operationId?: string | null;
  eformNumber?: string | null;
  changedFields: string[];
  beforeValues?: Record<string, unknown> | null;
  afterValues?: Record<string, unknown> | null;
}

export interface AssetHistoryResponse {
  events: AssetAuditEventRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// -------------------------------------------------------------------
// Phase P08: Advanced Assets Data Grid Types
// -------------------------------------------------------------------

export interface AssetListItem {
  id: string;
  model: string;
  assetNumber: string | null;
  serialNumber: string | null;
  status: AssetStatusEnum;
  department: string | null;
  costCenter: string | null;
  label: string | null;
  comment?: string | null;
  typeId: string | null;
  locationId: string | null;
  deviceHealthId: string | null;
  acOwnerId: string | null;
  currentUserId: string | null;
  createdAt: string;
  updatedAt: string;
  type?: { id: string; name: string; description?: string | null } | null;
  location?: {
    id: string;
    name: string;
    building?: string | null;
    floor?: string | null;
    room?: string | null;
    description?: string | null;
  } | null;
  deviceHealth?: { id: string; name: string; description?: string | null } | null;
  acOwner?: {
    id: string;
    fullName: string;
    personalCode?: string | null;
    department?: string | null;
  } | null;
  currentUser?: {
    id: string;
    fullName: string;
    username?: string | null;
    department?: string | null;
  } | null;
}

export interface AssetListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AssetListResponse {
  status: 'ok' | 'error';
  data: AssetListItem[];
  pagination: AssetListPagination;
  sort: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  filtersApplied: {
    q?: string;
    filterCount: number;
  };
  error?: string;
}

export type GridFilterOperator =
  | 'equals'
  | 'contains'
  | 'in'
  | 'empty'
  | 'notEmpty'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte';

export interface GridFilterRule {
  field: string;
  operator: GridFilterOperator;
  value?: any;
}

export interface GridFilterGroup {
  operator: 'AND' | 'OR';
  rules: (GridFilterRule | GridFilterGroup)[];
}

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
  sortField?: string;
  minWidth?: string;
}

