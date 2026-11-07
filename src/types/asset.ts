export interface AssetTypeLookup {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface LocationLookup {
  id: string;
  name: string;
  code?: string | null;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  isActive: boolean;
}

export interface DeviceHealthLookup {
  id: string;
  statusName: string;
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
