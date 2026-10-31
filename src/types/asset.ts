/**
 * IT Asset Management - Domain Data Models & Types
 * Strictly aligned with the approved Project Specification.
 */

export type UserRole = 'IT Admin' | 'Manager / Supervisor' | 'Employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  personalCode?: string;     // Links to Employee record for subordinate lookup
  department: string;
  lastActive: string;
}

export type AssetStatus = 'In Use' | 'Spare' | 'Disposed';
export type AssetLabel = 'Yes' | 'No';

/**
 * 15 Approved Asset Fields
 */
export interface Asset {
  assetNumber: string;       // Unique Asset Number (e.g. IT-2024-0081)
  revision: string;          // ISO Date string of last revision check
  type: string;              // Type (Laptop, Desktop, Monitor, Phone, Tablet, Peripheral, etc.)
  acOwner: string;           // The official owner registered in accounting/audit system
  personalCode: string;      // Personal Code of assigned employee (empty if Spare or Disposed)
  currentUserName: string;   // Current User Name (empty if Spare or Disposed)
  department: string;        // Department (Engineering, Operations, Finance, etc.)
  cc: string;                // Cost Center
  eFormNumber: string;       // eForm Number authorization
  model: string;             // Hardware model (e.g. ThinkPad T14s Gen 4)
  label: AssetLabel;         // Exactly 'Yes' | 'No'
  serialNumber: string;      // Manufacturer Serial Number (must be globally unique)
  status: AssetStatus;       // 'In Use' | 'Spare' | 'Disposed'
  location: string;          // Building, Floor, Room, or Desk location (or IT Stockroom)
  comment: string;           // General asset notes / comments (remains unchanged during returns)
}

/**
 * 9 Approved Employee Fields
 */
export interface Employee {
  firstName: string;
  lastName: string;
  personalCode: string;      // Unique Personal Code (e.g. PC-84920)
  department: string;
  workGroup: string;
  site: string;
  jobTitle: string;
  directManager: string;     // Name or Personal Code of Direct Manager
  mobileNumber: string;
}

export type DeviceCondition = 'Good' | 'Minor Damage' | 'Damaged' | 'Not Working';
export type HandoverType = 'Temporary' | 'Permanent';
export type HandoverConfirmationState = 'Pending Confirmation' | 'Confirmed';

/**
 * Dedicated event record representing a device handover (Temporary or Permanent).
 * Does not contain return-specific fields.
 */
export interface HandoverRecord {
  id: string;
  assetNumber: string;
  personalCode: string;           // Employee recipient Personal Code
  employeeName: string;           // Employee recipient Name
  itUserId: string;               // IT User ID who performed the handover
  itUserName: string;             // IT User Name who performed the handover
  type: HandoverType;             // 'Temporary' | 'Permanent'
  confirmationState: HandoverConfirmationState; // 'Pending Confirmation' | 'Confirmed'
  condition: DeviceCondition;     // 'Good' | 'Minor Damage' | 'Damaged' | 'Not Working'
  comments?: string;              // Optional handover notes
  photoUrls?: string[];           // Optional photo evidence
  handoverDate: string;           // ISO Date of handover event
  expectedReturnDate?: string;    // Estimated return for Temporary loans
  createdAt: string;
  confirmedAt?: string;
}

/**
 * Dedicated event record representing a device return to IT stock.
 * Distinct from HandoverRecord and captured as a separate event in asset history.
 * Return comments and photos are stored exclusively here.
 */
export interface ReturnRecord {
  id: string;
  assetNumber: string;            // Reference to Asset
  relatedHandoverId?: string;     // Reference to the preceding HandoverRecord if applicable
  personalCode: string;           // Employee who returned the device
  employeeName: string;           // Employee Name
  returnDate: string;             // ISO Date & time of the return event
  condition: DeviceCondition;     // 'Good' | 'Minor Damage' | 'Damaged' | 'Not Working'
  comments?: string;              // Return-specific comments (does not overwrite asset.comment)
  photoUrls?: string[];           // Return inspection photos
  itUserId: string;               // IT User ID who inspected and processed the return
  itUserName: string;             // IT User Name who inspected and processed the return
  createdAt: string;
}

/**
 * Chronological timeline event for asset history.
 */
export type AssetHistoryEvent =
  | ({ eventType: 'handover' } & HandoverRecord)
  | ({ eventType: 'return' } & ReturnRecord);

export interface SystemSettings {
  revisionThresholdMonths: number; // Default: 6 months, configurable by IT Admin
  defaultStockroomLocation: string; // Default: 'IT Stockroom - Central'
}

export interface DashboardMetrics {
  allDevices: number;
  inUse: number;
  spare: number;
  tempActiveHandovers: number;
  needsReview: number;
  disposed: number;
  pendingConfirmations: number;
}
