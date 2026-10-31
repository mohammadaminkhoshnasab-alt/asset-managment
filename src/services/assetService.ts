/**
 * IT Asset Management - Typed Service Layer (REST API Proxy Client)
 * ============================================================================
 * Structured to mirror future Python FastAPI endpoints:
 * - GET  /api/v1/dashboard/metrics
 * - GET  /api/v1/assets
 * - POST /api/v1/assets/return
 * - POST /api/v1/assets/handover
 * - GET  /api/v1/employees
 * - GET  /api/v1/settings
 * - POST /api/v1/imports/excel
 * ============================================================================
 */

import {
  Asset,
  AssetHistoryEvent,
  DashboardMetrics,
  DeviceCondition,
  Employee,
  HandoverRecord,
  HandoverType,
  ReturnRecord,
  SystemSettings,
  User,
} from '../types/asset.ts';
import {
  INITIAL_SETTINGS,
  MOCK_ASSETS,
  MOCK_EMPLOYEES,
  MOCK_HANDOVERS,
  MOCK_RETURNS,
  MOCK_USERS,
} from './mockData.ts';

// In-memory application state simulating backend database storage
let currentAssets: Asset[] = [...MOCK_ASSETS];
let currentEmployees: Employee[] = [...MOCK_EMPLOYEES];
let currentHandovers: HandoverRecord[] = [...MOCK_HANDOVERS];
let currentReturns: ReturnRecord[] = [...MOCK_RETURNS];
let currentUsers: User[] = [...MOCK_USERS];
let currentSettings: SystemSettings = { ...INITIAL_SETTINGS };

/**
 * Checks if an asset needs review based solely on Revision date
 * and the configured threshold (default: 6 months).
 */
export function isNeedsReview(revisionDateStr: string, thresholdMonths = currentSettings.revisionThresholdMonths): boolean {
  if (!revisionDateStr) return true;
  const revisionDate = new Date(revisionDateStr);
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - thresholdMonths);
  return revisionDate < cutoffDate;
}

/**
 * Returns active temporary handover if one exists for the given asset
 */
export function getActiveTemporaryHandover(assetNumber: string): HandoverRecord | undefined {
  const latestHandover = currentHandovers
    .filter((h) => h.assetNumber === assetNumber && h.type === 'Temporary')
    .sort((a, b) => new Date(b.handoverDate).getTime() - new Date(a.handoverDate).getTime())[0];

  if (!latestHandover) return undefined;

  // Check if there is a return recorded after this handover
  const hasReturned = currentReturns.some(
    (r) => r.assetNumber === assetNumber && new Date(r.returnDate) >= new Date(latestHandover.handoverDate)
  );

  return hasReturned ? undefined : latestHandover;
}

/**
 * Filters assets to those assigned to direct subordinates of a specific manager.
 * Strictly based on directManager relationship in Employee records.
 */
export function getSubordinateAssets(
  assets: Asset[],
  employees: Employee[],
  managerNameOrCode: string
): Asset[] {
  if (!managerNameOrCode) return [];
  const search = managerNameOrCode.toLowerCase().trim();
  const subordinateCodes = new Set(
    employees
      .filter((emp) => emp.directManager.toLowerCase().trim() === search)
      .map((emp) => emp.personalCode)
  );
  return assets.filter((asset) => asset.personalCode && subordinateCodes.has(asset.personalCode));
}

export const assetService = {
  // SETTINGS
  async getSettings(): Promise<SystemSettings> {
    return { ...currentSettings };
  },

  async updateSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
    currentSettings = { ...currentSettings, ...newSettings };
    return { ...currentSettings };
  },

  // METRICS
  async getMetrics(): Promise<DashboardMetrics> {
    const allDevices = currentAssets.length;
    const inUse = currentAssets.filter((a) => a.status === 'In Use').length;
    const spare = currentAssets.filter((a) => a.status === 'Spare').length;
    const disposed = currentAssets.filter((a) => a.status === 'Disposed').length;

    // Operational indicator: Needs Review (calculated from revision date only)
    const needsReview = currentAssets.filter((a) =>
      a.status !== 'Disposed' && isNeedsReview(a.revision, currentSettings.revisionThresholdMonths)
    ).length;

    // Operational indicator: Active Temporary handovers
    const tempActiveHandovers = currentAssets.filter((a) => {
      if (a.status !== 'In Use') return false;
      return !!getActiveTemporaryHandover(a.assetNumber);
    }).length;

    // Operational indicator: Pending Confirmations
    const pendingConfirmations = currentHandovers.filter(
      (h) => h.confirmationState === 'Pending Confirmation'
    ).length;

    return {
      allDevices,
      inUse,
      spare,
      tempActiveHandovers,
      needsReview,
      disposed,
      pendingConfirmations,
    };
  },

  // ASSETS
  async getAssets(): Promise<Asset[]> {
    return [...currentAssets];
  },

  async getAssetByNumber(assetNumber: string): Promise<Asset | undefined> {
    return currentAssets.find((a) => a.assetNumber === assetNumber);
  },

  // EMPLOYEES
  async getEmployees(): Promise<Employee[]> {
    return [...currentEmployees];
  },

  // USERS
  async getUsers(): Promise<User[]> {
    return [...currentUsers];
  },

  // HANDOVERS & RETURNS
  async getHandovers(): Promise<HandoverRecord[]> {
    return [...currentHandovers];
  },

  async getReturns(): Promise<ReturnRecord[]> {
    return [...currentReturns];
  },

  async getAssetHistory(assetNumber: string): Promise<AssetHistoryEvent[]> {
    const handovers: AssetHistoryEvent[] = currentHandovers
      .filter((h) => h.assetNumber === assetNumber)
      .map((h) => ({ eventType: 'handover' as const, ...h }));

    const returns: AssetHistoryEvent[] = currentReturns
      .filter((r) => r.assetNumber === assetNumber)
      .map((r) => ({ eventType: 'return' as const, ...r }));

    return [...handovers, ...returns].sort(
      (a, b) => {
        const timeA = new Date(a.eventType === 'handover' ? a.handoverDate : a.returnDate).getTime();
        const timeB = new Date(b.eventType === 'handover' ? b.handoverDate : b.returnDate).getTime();
        return timeB - timeA;
      }
    );
  },

  /**
   * Registers a new handover event.
   */
  async registerHandover(params: {
    assetNumber: string;
    personalCode: string;
    employeeName: string;
    type: HandoverType;
    condition: DeviceCondition;
    comments?: string;
    expectedReturnDate?: string;
    itUserId: string;
    itUserName: string;
  }): Promise<HandoverRecord> {
    const newHandover: HandoverRecord = {
      id: `hnd-${Date.now()}`,
      assetNumber: params.assetNumber,
      personalCode: params.personalCode,
      employeeName: params.employeeName,
      itUserId: params.itUserId,
      itUserName: params.itUserName,
      type: params.type,
      confirmationState: 'Pending Confirmation',
      condition: params.condition,
      comments: params.comments,
      photoUrls: [],
      handoverDate: new Date().toISOString(),
      expectedReturnDate: params.expectedReturnDate,
      createdAt: new Date().toISOString(),
    };

    currentHandovers = [newHandover, ...currentHandovers];

    // Update asset assignment & status to 'In Use'
    currentAssets = currentAssets.map((asset) => {
      if (asset.assetNumber === params.assetNumber) {
        return {
          ...asset,
          status: 'In Use',
          personalCode: params.personalCode,
          currentUserName: params.employeeName,
          revision: new Date().toISOString(), // updating inspection on handover
        };
      }
      return asset;
    });

    return newHandover;
  },

  /**
   * Confirms a pending handover by the employee
   */
  async confirmHandover(handoverId: string): Promise<HandoverRecord> {
    let updated: HandoverRecord | undefined;
    currentHandovers = currentHandovers.map((h) => {
      if (h.id === handoverId) {
        updated = {
          ...h,
          confirmationState: 'Confirmed',
          confirmedAt: new Date().toISOString(),
        };
        return updated;
      }
      return h;
    });

    if (!updated) throw new Error('Handover record not found');
    return updated;
  },

  /**
   * Executes a device return with strict state transition invariants:
   * 1. Clears asset.personalCode and asset.currentUserName.
   * 2. Sets asset.status = 'Spare'.
   * 3. Sets asset.location = configured IT stockroom.
   * 4. Preserves asset.comment unmodified (return comments are stored in ReturnRecord).
   * 5. Appends ReturnRecord to audit history.
   */
  async executeReturn(params: {
    assetNumber: string;
    condition: DeviceCondition;
    comments?: string;
    photoUrls?: string[];
    itUserId: string;
    itUserName: string;
    relatedHandoverId?: string;
  }): Promise<{ returnRecord: ReturnRecord; updatedAsset: Asset }> {
    const targetAsset = currentAssets.find((a) => a.assetNumber === params.assetNumber);
    if (!targetAsset) throw new Error(`Asset ${params.assetNumber} not found`);

    const returnRecord: ReturnRecord = {
      id: `ret-${Date.now()}`,
      assetNumber: params.assetNumber,
      relatedHandoverId: params.relatedHandoverId,
      personalCode: targetAsset.personalCode || 'UNASSIGNED',
      employeeName: targetAsset.currentUserName || 'Unassigned Stock',
      returnDate: new Date().toISOString(),
      condition: params.condition,
      comments: params.comments,
      photoUrls: params.photoUrls || [],
      itUserId: params.itUserId,
      itUserName: params.itUserName,
      createdAt: new Date().toISOString(),
    };

    currentReturns = [returnRecord, ...currentReturns];

    // Deterministic state transition
    let updatedAssetRef: Asset | undefined;
    currentAssets = currentAssets.map((asset) => {
      if (asset.assetNumber === params.assetNumber) {
        updatedAssetRef = {
          ...asset,
          personalCode: '',
          currentUserName: '',
          status: 'Spare',
          location: currentSettings.defaultStockroomLocation,
          // CRITICAL REQUIREMENT: asset.comment is preserved unchanged!
        };
        return updatedAssetRef;
      }
      return asset;
    });

    return { returnRecord, updatedAsset: updatedAssetRef! };
  },

  /**
   * Imports validated rows from Excel.
   * Strict non-configurable uniqueness validation:
   * Rejects any row whose assetNumber or serialNumber already exists in currentAssets.
   */
  async importValidAssets(newAssets: Asset[]): Promise<{ importedCount: number; rejectedCount: number }> {
    const existingAssetNumbers = new Set(currentAssets.map((a) => a.assetNumber.toLowerCase().trim()));
    const existingSerialNumbers = new Set(currentAssets.map((a) => a.serialNumber.toLowerCase().trim()));

    const validToInsert: Asset[] = [];
    let rejectedCount = 0;

    for (const asset of newAssets) {
      const aNum = asset.assetNumber?.toLowerCase().trim();
      const sNum = asset.serialNumber?.toLowerCase().trim();

      if (!aNum || !sNum || existingAssetNumbers.has(aNum) || existingSerialNumbers.has(sNum)) {
        rejectedCount++;
        continue;
      }

      existingAssetNumbers.add(aNum);
      existingSerialNumbers.add(sNum);
      validToInsert.push(asset);
    }

    currentAssets = [...validToInsert, ...currentAssets];
    return { importedCount: validToInsert.length, rejectedCount };
  },

  /**
   * Reset store to initial mock fixtures
   */
  async resetToDefaults(): Promise<void> {
    currentAssets = [...MOCK_ASSETS];
    currentEmployees = [...MOCK_EMPLOYEES];
    currentHandovers = [...MOCK_HANDOVERS];
    currentReturns = [...MOCK_RETURNS];
    currentUsers = [...MOCK_USERS];
    currentSettings = { ...INITIAL_SETTINGS };
  },
};
