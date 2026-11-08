export type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface TransferPersonSummary {
  id: string;
  fullName: string;
  personalCode?: string | null;
  username?: string | null;
  department?: string | null;
  costCenter?: string | null;
}

export interface TransferLocationSummary {
  id: string;
  name: string;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
}

export interface AssetTransferRecord {
  id: string;
  assetId: string;
  fromPersonId: string | null;
  toPersonId: string | null;
  fromPerson?: TransferPersonSummary | null;
  toPerson?: TransferPersonSummary | null;

  fromCurrentUserId: string | null;
  toCurrentUserId: string | null;
  fromCurrentUser?: TransferPersonSummary | null;
  toCurrentUser?: TransferPersonSummary | null;

  fromDepartment: string | null;
  toDepartment: string | null;

  fromCostCenter: string | null;
  toCostCenter: string | null;

  fromLocationId: string | null;
  toLocationId: string | null;
  fromLocation?: TransferLocationSummary | null;
  toLocation?: TransferLocationSummary | null;

  changeAcOwner: boolean;
  changeCurrentUser: boolean;
  changeDepartment: boolean;
  changeCostCenter: boolean;
  changeLocation: boolean;

  eformNumber: string | null;
  status: TransferStatus;
  requestedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdBy: string | null;
}

export interface CreateTransferPayload {
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

  eformNumber?: string | null;
  notes?: string | null;
}

export interface CompleteTransferPayload {
  eformNumber?: string;
  notes?: string | null;
}

export interface CancelTransferPayload {
  notes?: string | null;
}
