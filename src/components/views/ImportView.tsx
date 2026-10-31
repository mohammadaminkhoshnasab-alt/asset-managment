/**
 * IT Asset Management - Excel Import Wizard
 * Strictly processes Excel files (.xlsx / .xls) with client-side parsing, schema validation,
 * mandatory duplicate rejection (Asset Number & Serial Number), and row preview.
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Asset } from '../../types/asset.ts';
import {
  generateSampleExcelTemplate,
  parseExcelFile,
  ParseResult,
} from '../../services/excelParser.ts';
import { assetService } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

export const ImportView: React.FC = () => {
  const { setActiveView, triggerRefresh } = useApp();
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; rejected: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorBanner('Invalid file format. Please upload an Excel workbook (.xlsx or .xls).');
      return;
    }

    setErrorBanner(null);
    setIsParsing(true);
    setImportSummary(null);

    try {
      const buffer = await file.arrayBuffer();
      const existingAssets = await assetService.getAssets();
      const result = await parseExcelFile(buffer, file.name, existingAssets);
      setParseResult(result);
    } catch (err: any) {
      console.error(err);
      setErrorBanner(err?.message || 'Failed to read Excel workbook.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // 1-Click Demo Excel Simulator (for testing without external file)
  const handleLoadSampleDemo = async () => {
    setIsParsing(true);
    setErrorBanner(null);
    setImportSummary(null);

    try {
      // Simulate raw buffer from template generator
      const existingAssets = await assetService.getAssets();

      // Create a test workbook array with 1 valid row, 1 duplicate serial row, and 1 invalid status row
      const demoRows = [
        {
          assetNumber: 'AST-2025-0881',
          revision: new Date().toISOString(),
          type: 'Laptop',
          acOwner: 'Global IT Holdings Entity A1',
          personalCode: 'PC-30119',
          currentUserName: 'David Kim',
          department: 'Engineering',
          cc: 'CC-ENG-402',
          eFormNumber: 'EF-2025-0881',
          model: 'Lenovo ThinkPad P1 Gen 6',
          label: 'Yes' as const,
          serialNumber: 'SN-TP-P1G6-UNIQUE-01',
          status: 'In Use' as const,
          location: 'Headquarters - North Campus',
          comment: 'New workstation rollout',
        },
        {
          assetNumber: 'AST-2025-0882',
          revision: new Date().toISOString(),
          type: 'Monitor',
          acOwner: 'Corporate Lease Fleet BV',
          personalCode: '',
          currentUserName: '',
          department: 'Corporate IT Stock',
          cc: 'CC-IT-100',
          eFormNumber: 'EF-2025-0882',
          model: 'LG 38WN95C-W Curved Ultrawide',
          label: 'Yes' as const,
          serialNumber: 'SN-TP-892014-X', // DUPLICATE OF EXISTING ASSET!
          status: 'Spare' as const,
          location: 'IT Stockroom - Central',
          comment: 'Spare curved monitor',
        },
        {
          assetNumber: 'AST-2025-0883',
          revision: new Date().toISOString(),
          type: 'Phone',
          acOwner: 'Audit Asset Trust DE-88',
          personalCode: '',
          currentUserName: '',
          department: 'Corporate IT Stock',
          cc: 'CC-IT-100',
          eFormNumber: 'EF-2025-0883',
          model: 'Samsung Galaxy S24 Ultra',
          label: 'Maybe' as any, // INVALID LABEL!
          serialNumber: 'SN-SAMS-S24U-990',
          status: 'Under Repair' as any, // INVALID STATUS (must be In Use, Spare, Disposed)!
          location: 'HQ Lab',
          comment: '',
        },
      ];

      // Format as ParseResult
      const rows = demoRows.map((data, idx) => {
        const errors: string[] = [];
        if (data.serialNumber === 'SN-TP-892014-X') {
          errors.push("Duplicate Serial Number 'SN-TP-892014-X' (already exists in inventory)");
        }
        if ((data.status as string) === 'Under Repair') {
          errors.push("Invalid Status 'Under Repair'. Must be exactly 'In Use', 'Spare', or 'Disposed'");
        }
        if ((data.label as string) === 'Maybe') {
          errors.push("Invalid Label 'Maybe'. Must be exactly 'Yes' or 'No'");
        }

        return {
          rowNumber: idx + 2,
          isValid: errors.length === 0,
          errors,
          data,
          raw: data as any,
        };
      });

      setParseResult({
        fileName: 'Sample_Enterprise_Assets_Batch.xlsx',
        totalRows: rows.length,
        validRowsCount: rows.filter((r) => r.isValid).length,
        invalidRowsCount: rows.filter((r) => !r.isValid).length,
        rows,
        headersFound: [
          'Asset Number',
          'Revision',
          'Type',
          'AC Owner',
          'Personal Code',
          'Current User Name',
          'Department',
          'CC',
          'eForm Number',
          'Model',
          'Label',
          'Serial Number',
          'Status',
          'Location',
          'Comment',
        ],
        missingHeaders: [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult) return;
    setIsImporting(true);

    try {
      const validAssets = parseResult.rows
        .filter((r) => r.isValid)
        .map((r) => r.data as Asset);

      const res = await assetService.importValidAssets(validAssets);
      setImportSummary({ imported: res.importedCount, rejected: res.rejectedCount });
      triggerRefresh();
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to import assets');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Excel Asset Import Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Batch onboard enterprise equipment using Excel spreadsheets (.xlsx / .xls). Strict validation ensures
            all 15 approved fields match standards and unconditionally prevents duplicate Asset Numbers or Serial Numbers.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generateSampleExcelTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download Template (.xlsx)</span>
          </button>
          <button
            onClick={handleLoadSampleDemo}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <span>Load Demo Batch</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* File Dropzone */}
      {!parseResult && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/20'
              : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900/60'
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-4 shadow-xs">
            <Upload className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Drag and drop your Excel workbook here
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Supports Microsoft Excel <strong>.xlsx</strong> and <strong>.xls</strong> workbooks containing the 15 approved Asset fields.
          </p>

          <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors">
            <span>Browse Computer</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>
      )}

      {/* Parsing progress spinner */}
      {isParsing && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Reading Excel workbook and validating schema...
          </p>
          <p className="mt-1">Detecting duplicate Asset Numbers &amp; Serial Numbers</p>
        </div>
      )}

      {/* Parse Results Preview Table */}
      {parseResult && (
        <div className="space-y-4">
          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-medium text-slate-400">Workbook Name</span>
              <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                {parseResult.fileName}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-medium text-slate-400">Total Rows Found</span>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {parseResult.totalRows}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                Valid Rows (Ready to Import)
              </span>
              <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                {parseResult.validRowsCount}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3.5 shadow-xs dark:border-rose-900/40 dark:bg-rose-950/20">
              <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                Invalid / Duplicate Rows
              </span>
              <p className="font-mono text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                {parseResult.invalidRowsCount}
              </p>
            </div>
          </div>

          {/* Validation Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Parsed Rows Preview &amp; Validation Status
              </span>
              <button
                onClick={() => setParseResult(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium"
              >
                Upload Different File
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 sticky top-0">
                  <tr>
                    <th scope="col" className="py-2.5 px-3">Row #</th>
                    <th scope="col" className="py-2.5 px-3">Validation Status</th>
                    <th scope="col" className="py-2.5 px-3">Asset Number</th>
                    <th scope="col" className="py-2.5 px-3">Model</th>
                    <th scope="col" className="py-2.5 px-3">Serial Number</th>
                    <th scope="col" className="py-2.5 px-3">AC Owner</th>
                    <th scope="col" className="py-2.5 px-3">Status</th>
                    <th scope="col" className="py-2.5 px-3">Label</th>
                    <th scope="col" className="py-2.5 px-3">Validation Errors / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parseResult.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={row.isValid ? 'bg-white dark:bg-slate-900' : 'bg-rose-50/30 dark:bg-rose-950/10'}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-400">#{row.rowNumber}</td>
                      <td className="py-2.5 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            Invalid
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {row.data.assetNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {row.data.model || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {row.data.serialNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {row.data.acOwner || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {row.data.status || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.data.label || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.errors.length === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                            Ready to import
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {row.errors.map((err, i) => (
                              <span key={i} className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                • {err}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Commit Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {parseResult.validRowsCount > 0 ? (
                  <span>
                    Ready to onboard <strong>{parseResult.validRowsCount}</strong> verified assets into inventory.
                    Invalid rows will be skipped.
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    No valid rows found to import. Please correct spreadsheet errors and retry.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setParseResult(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={parseResult.validRowsCount === 0 || isImporting}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>
                    {isImporting
                      ? 'Importing...'
                      : `Confirm & Import ${parseResult.validRowsCount} Valid Rows`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {importSummary && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30 text-xs text-emerald-900 dark:text-emerald-300 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Batch Import Successful!
          </div>
          <p>
            Successfully imported <strong>{importSummary.imported}</strong> valid hardware assets into inventory.
            {importSummary.rejected > 0 && ` (${importSummary.rejected} invalid/duplicate rows were skipped).`}
          </p>
          <div className="pt-2">
            <button
              onClick={() => setActiveView('assets')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
            >
              <span>View Updated Inventory in Assets</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
