/**
 * IT Asset Management - Excel Import Parser & Validator
 * ============================================================================
 * Handles binary Excel file (.xlsx / .xls) reading, 15-field schema validation,
 * mandatory duplicate detection (unconditionally rejected), and template export.
 * ============================================================================
 */

import * as XLSX from 'xlsx';
import { Asset, AssetLabel, AssetStatus } from '../types/asset.ts';

export interface ParsedImportRow {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  data: Partial<Asset>;
  raw: Record<string, unknown>;
}

export interface ParseResult {
  fileName: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ParsedImportRow[];
  headersFound: string[];
  missingHeaders: string[];
}

export const APPROVED_HEADERS_MAP: Record<keyof Asset, string[]> = {
  assetNumber: ['asset number', 'assetnumber', 'asset_number', 'asset tag', 'asset #'],
  revision: ['revision', 'revision date', 'last revision', 'rev_date'],
  type: ['type', 'device type', 'asset type', 'category'],
  acOwner: ['ac owner', 'acowner', 'accounting owner', 'audit owner', 'ac_owner'],
  personalCode: ['personal code', 'personalcode', 'employee id', 'emp code', 'pc'],
  currentUserName: ['current user name', 'current username', 'user name', 'assigned to', 'employee name'],
  department: ['department', 'dept'],
  cc: ['cc', 'cost center', 'cost_center'],
  eFormNumber: ['eform number', 'eform', 'eform #', 'e-form'],
  model: ['model', 'hardware model', 'device model'],
  label: ['label', 'asset label', 'tagged label'],
  serialNumber: ['serial number', 'serialnumber', 'serial', 'sn', 'service tag'],
  status: ['status', 'asset status', 'device status'],
  location: ['location', 'site location', 'room', 'desk'],
  comment: ['comment', 'comments', 'notes', 'remark'],
};

/**
 * Normalizes header string for fuzzy matching
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

/**
 * Maps Excel row columns to Asset object properties
 */
function mapRowToAssetFields(row: Record<string, unknown>): Partial<Asset> {
  const normalizedRow: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    normalizedRow[normalizeKey(k)] = v;
  }

  const result: Partial<Asset> = {};

  for (const [field, aliases] of Object.entries(APPROVED_HEADERS_MAP) as [keyof Asset, string[]][]) {
    for (const alias of aliases) {
      const match = Object.keys(normalizedRow).find((k) => k === alias || k.includes(alias));
      if (match && normalizedRow[match] !== undefined) {
        result[field] = String(normalizedRow[match]).trim() as any;
        break;
      }
    }
  }

  return result;
}

/**
 * Validates a single parsed row against approved Asset specifications
 */
export function validateImportRow(
  data: Partial<Asset>,
  rowNumber: number,
  existingAssetNumbers: Set<string>,
  existingSerialNumbers: Set<string>,
  fileAssetNumbers: Set<string>,
  fileSerialNumbers: Set<string>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Asset Number (mandatory & unique)
  if (!data.assetNumber) {
    errors.push('Missing Asset Number');
  } else {
    const aNum = data.assetNumber.toLowerCase();
    if (existingAssetNumbers.has(aNum)) {
      errors.push(`Duplicate Asset Number '${data.assetNumber}' (already exists in inventory)`);
    } else if (fileAssetNumbers.has(aNum)) {
      errors.push(`Duplicate Asset Number '${data.assetNumber}' (appears multiple times in this Excel file)`);
    } else {
      fileAssetNumbers.add(aNum);
    }
  }

  // 2. Serial Number (mandatory & unique)
  if (!data.serialNumber) {
    errors.push('Missing Serial Number');
  } else {
    const sNum = data.serialNumber.toLowerCase();
    if (existingSerialNumbers.has(sNum)) {
      errors.push(`Duplicate Serial Number '${data.serialNumber}' (already exists in inventory)`);
    } else if (fileSerialNumbers.has(sNum)) {
      errors.push(`Duplicate Serial Number '${data.serialNumber}' (appears multiple times in this Excel file)`);
    } else {
      fileSerialNumbers.add(sNum);
    }
  }

  // 3. Status: Exactly 'In Use' | 'Spare' | 'Disposed'
  const allowedStatuses: AssetStatus[] = ['In Use', 'Spare', 'Disposed'];
  if (!data.status) {
    errors.push('Missing Status');
  } else if (!allowedStatuses.includes(data.status as AssetStatus)) {
    errors.push(`Invalid Status '${data.status}'. Must be exactly 'In Use', 'Spare', or 'Disposed'`);
  }

  // 4. Label: Exactly 'Yes' | 'No'
  const rawLabel = String(data.label || '').trim().toLowerCase();
  if (rawLabel === 'yes' || rawLabel === 'y' || rawLabel === 'true') {
    data.label = 'Yes' as AssetLabel;
  } else if (rawLabel === 'no' || rawLabel === 'n' || rawLabel === 'false') {
    data.label = 'No' as AssetLabel;
  } else {
    errors.push(`Invalid Label '${data.label}'. Must be exactly 'Yes' or 'No'`);
  }

  // 5. AC Owner: Required (accounting/audit owner)
  if (!data.acOwner) {
    errors.push('Missing AC Owner (official accounting/audit asset owner)');
  }

  // 6. Type & Model
  if (!data.type) errors.push('Missing Type');
  if (!data.model) errors.push('Missing Model');

  // 7. In Use constraints
  if (data.status === 'In Use') {
    if (!data.personalCode && !data.currentUserName) {
      errors.push('Assets with status "In Use" must have an assigned Personal Code and User Name');
    }
  }

  // 8. Revision date fallback
  if (!data.revision) {
    data.revision = new Date().toISOString();
  } else {
    const parsedDate = new Date(data.revision);
    if (isNaN(parsedDate.getTime())) {
      data.revision = new Date().toISOString();
    } else {
      data.revision = parsedDate.toISOString();
    }
  }

  // Location default
  if (!data.location) {
    data.location = data.status === 'Spare' ? 'IT Stockroom - Central' : 'Unspecified Location';
  }

  // Comment fallback
  if (!data.comment) {
    data.comment = '';
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Reads an ArrayBuffer from an uploaded .xlsx / .xls file and validates every row.
 */
export async function parseExcelFile(
  buffer: ArrayBuffer,
  fileName: string,
  existingAssets: Asset[]
): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  const existingAssetNumbers = new Set(existingAssets.map((a) => a.assetNumber.toLowerCase().trim()));
  const existingSerialNumbers = new Set(existingAssets.map((a) => a.serialNumber.toLowerCase().trim()));

  const fileAssetNumbers = new Set<string>();
  const fileSerialNumbers = new Set<string>();

  const parsedRows: ParsedImportRow[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // Row 1 is header
    const mapped = mapRowToAssetFields(row);
    const { isValid, errors } = validateImportRow(
      mapped,
      rowNumber,
      existingAssetNumbers,
      existingSerialNumbers,
      fileAssetNumbers,
      fileSerialNumbers
    );

    parsedRows.push({
      rowNumber,
      isValid,
      errors,
      data: mapped,
      raw: row,
    });
  });

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.filter((r) => !r.isValid).length;

  return {
    fileName,
    totalRows: parsedRows.length,
    validRowsCount,
    invalidRowsCount,
    rows: parsedRows,
    headersFound: Object.keys(rawRows[0] || {}),
    missingHeaders: [],
  };
}

/**
 * Generates and downloads an Excel template with approved columns and example rows.
 */
export function generateSampleExcelTemplate(): void {
  const sampleData = [
    {
      'Asset Number': 'AST-2025-0101',
      'Revision': new Date().toISOString().split('T')[0],
      'Type': 'Laptop',
      'AC Owner': 'Global IT Holdings Entity A1',
      'Personal Code': 'PC-30119',
      'Current User Name': 'David Kim',
      'Department': 'Engineering',
      'CC': 'CC-ENG-402',
      'eForm Number': 'EF-2025-0012',
      'Model': 'ThinkPad X1 Carbon Gen 12',
      'Label': 'Yes',
      'Serial Number': 'SN-X1C-990021-US',
      'Status': 'In Use',
      'Location': 'Headquarters - North Campus, Desk 4B-10',
      'Comment': 'Standard developer provisioning',
    },
    {
      'Asset Number': 'AST-2025-0102',
      'Revision': new Date().toISOString().split('T')[0],
      'Type': 'Monitor',
      'AC Owner': 'Corporate Lease Fleet BV',
      'Personal Code': '',
      'Current User Name': '',
      'Department': 'Corporate IT Stock',
      'CC': 'CC-IT-100',
      'eForm Number': 'EF-2025-0013',
      'Model': 'Dell UltraSharp U3224KB 6K',
      'Label': 'Yes',
      'Serial Number': 'SN-DEL-6KU-11029',
      'Status': 'Spare',
      'Location': 'IT Stockroom - Central (Bldg 4, Rm 102)',
      'Comment': 'Spare stock ready for deployment',
    },
    {
      'Asset Number': 'AST-2025-0103',
      'Revision': '2024-01-01',
      'Type': 'Phone',
      'AC Owner': 'Audit Asset Trust DE-88',
      'Personal Code': '',
      'Current User Name': '',
      'Department': 'Corporate IT Stock',
      'CC': 'CC-IT-100',
      'eForm Number': 'EF-2025-0014',
      'Model': 'iPhone 13 128GB (Recycled)',
      'Label': 'No',
      'Serial Number': 'SN-APL-IP13-DISP-01',
      'Status': 'Disposed',
      'Location': 'Certified E-Waste Depot',
      'Comment': 'Battery depleted, decommissioned per policy',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets_Import_Template');

  XLSX.writeFile(workbook, 'IT_Asset_Management_Template.xlsx');
}
