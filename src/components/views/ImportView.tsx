/**
 * IT Asset Management - Excel Import Wizard (Industrial Redesign)
 * Binary .xlsx parsing, 15-field schema validation, unconditional duplicate rejection,
 * and high-contrast validation inspection grid.
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
      const existingAssets = await assetService.getAssets();

      // Demo dataset with valid row and duplicate detection
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
          acOwner: 'Global IT Holdings Entity A1',
          personalCode: 'PC-10042',
          currentUserName: 'Ali Rezaei',
          department: 'Technology Infrastructure',
          cc: 'CC-TECH-101',
          eFormNumber: 'EF-2025-0882',
          model: 'Dell UltraSharp U2723QE',
          label: 'Yes' as const,
          serialNumber: 'SN-MON-DELL-8820',
          status: 'In Use' as const,
          location: 'Building B - Tech Lab',
          comment: 'Secondary 4K display',
        },
        {
          // Intentional duplicate of existing assetNumber to demo rejection
          assetNumber: existingAssets[0]?.assetNumber || 'LAP-2024-001',
          revision: new Date().toISOString(),
          type: 'Laptop',
          acOwner: 'Corporate Fleet Holdings',
          personalCode: 'PC-99999',
          currentUserName: 'Duplicate Test',
          department: 'Finance',
          cc: 'CC-FIN-200',
          eFormNumber: 'EF-DUP-001',
          model: 'Test Duplicate Unit',
          label: 'Yes' as const,
          serialNumber: 'SN-DUP-TEST-0001',
          status: 'Spare' as const,
          location: 'IT Stockroom 101',
          comment: 'This row should be rejected by duplicate check',
        },
      ];

      const rows = demoRows.map((data, idx) => {
        const errors: string[] = [];
        const isDupAsset = existingAssets.some((a) => a.assetNumber === data.assetNumber);
        const isDupSerial = existingAssets.some((a) => a.serialNumber === data.serialNumber);

        if (isDupAsset) errors.push(`Duplicate Asset Number "${data.assetNumber}" already exists in registry.`);
        if (isDupSerial) errors.push(`Duplicate Serial Number "${data.serialNumber}" already exists.`);

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
          'Asset Number', 'Revision', 'Type', 'AC Owner', 'Personal Code',
          'Current User Name', 'Department', 'CC', 'eForm Number', 'Model',
          'Label', 'Serial Number', 'Status', 'Location', 'Comment',
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
    <div className="space-y-4">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3.5 dark:border-[#2B323D] dark:bg-[#12151B]">
        <div>
          <h1 className="font-industrial-display text-base font-black uppercase tracking-tight text-[#141312] dark:text-[#F2EFE9] flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#5D7F5F] dark:text-[#668768]" />
            EXCEL BATCH INGEST ENGINE
          </h1>
          <p className="text-xs text-[#6E6960] dark:text-[#7C8797] font-medium mt-0.5">
            Strict 15-field validation with mandatory duplicate detection for Asset Numbers and Serial Numbers.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generateSampleExcelTemplate}
            className="flex items-center gap-1.5 rounded border border-[#D2C8B8] bg-[#E5DFD2] px-3 py-1.5 text-xs font-bold font-industrial-display text-[#141312] hover:bg-[#DCD4C4] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] dark:hover:bg-[#202530] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>DOWNLOAD TEMPLATE (.XLSX)</span>
          </button>
          <button
            onClick={handleLoadSampleDemo}
            className="flex items-center gap-1.5 rounded bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black px-3.5 py-1.5 text-xs font-bold font-industrial-display shadow-xs hover:brightness-105 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>LOAD DEMO BATCH</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="flex items-center gap-2 rounded-lg bg-[#B2534C]/15 p-3 text-xs text-[#B2534C] dark:text-[#E28882] border border-[#B2534C] font-mono-tabular">
          <AlertCircle className="h-4 w-4 shrink-0" />
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
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-all ${
            dragActive
              ? 'border-[#E49C52] bg-[#E5DFD2] dark:border-[#E7A45F] dark:bg-[#181C24]'
              : 'border-[#D2C8B8] bg-[#F8F4EC] dark:border-[#2B323D] dark:bg-[#12151B]'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded bg-[#E5DFD2] text-[#141312] dark:bg-[#181C24] dark:text-[#F2EFE9] mb-3">
            <Upload className="h-6 w-6" />
          </div>
          <h3 className="font-industrial-display text-sm font-black uppercase text-[#141312] dark:text-[#F2EFE9]">
            DRAG &amp; DROP EXCEL WORKBOOK (.XLSX / .XLS)
          </h3>
          <p className="text-xs font-mono-tabular text-[#6E6960] dark:text-[#7C8797] mt-1 max-w-sm">
            Must contain approved 15-field header schema. Duplicates are unconditionally flagged.
          </p>

          <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded bg-[#141312] text-[#F8F4EC] dark:bg-[#F2EFE9] dark:text-[#12151B] px-4 py-2 text-xs font-bold font-industrial-display shadow-xs hover:opacity-90 transition-all">
            <span>BROWSE LOCAL FILES</span>
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

      {/* Parsing progress */}
      {isParsing && (
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-8 text-center text-xs font-mono-tabular text-[#6E6960] dark:border-[#2B323D] dark:bg-[#12151B] dark:text-[#7C8797]">
          <p className="font-bold text-[#141312] dark:text-[#F2EFE9]">
            PROCESSING BINARY SPREADSHEET &amp; CHECKING DUPLICATES...
          </p>
        </div>
      )}

      {/* Parse Results Preview Table */}
      {parseResult && (
        <div className="space-y-4">
          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono-tabular">
            <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3 dark:border-[#2B323D] dark:bg-[#12151B]">
              <span className="text-[10px] uppercase font-bold text-[#6E6960] dark:text-[#7C8797]">FILE NAME</span>
              <p className="font-bold text-xs text-[#141312] dark:text-[#F2EFE9] mt-1 truncate">
                {parseResult.fileName}
              </p>
            </div>
            <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3 dark:border-[#2B323D] dark:bg-[#12151B]">
              <span className="text-[10px] uppercase font-bold text-[#6E6960] dark:text-[#7C8797]">TOTAL ROWS</span>
              <p className="font-industrial-display text-2xl font-black text-[#141312] dark:text-[#F2EFE9] mt-0.5">
                {parseResult.totalRows}
              </p>
            </div>
            <div className="rounded-lg border border-[#5D7F5F] bg-[#5D7F5F]/15 p-3 dark:border-[#668768] dark:bg-[#668768]/15">
              <span className="text-[10px] uppercase font-bold text-[#5D7F5F] dark:text-[#668768]">VALID ROWS</span>
              <p className="font-industrial-display text-2xl font-black text-[#5D7F5F] dark:text-[#668768] mt-0.5">
                {parseResult.validRowsCount}
              </p>
            </div>
            <div className="rounded-lg border border-[#B2534C] bg-[#B2534C]/15 p-3 dark:border-[#B85D56] dark:bg-[#B85D56]/15">
              <span className="text-[10px] uppercase font-bold text-[#B2534C] dark:text-[#B85D56]">INVALID / DUPLICATES</span>
              <p className="font-industrial-display text-2xl font-black text-[#B2534C] dark:text-[#B85D56] mt-0.5">
                {parseResult.invalidRowsCount}
              </p>
            </div>
          </div>

          {/* Validation Table */}
          <div className="overflow-hidden rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] dark:border-[#2B323D] dark:bg-[#12151B]">
            <div className="flex items-center justify-between border-b border-[#D2C8B8] bg-[#E5DFD2] px-4 py-2.5 dark:border-[#2B323D] dark:bg-[#181C24]">
              <span className="font-industrial-display text-xs font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
                BATCH VALIDATION LOG
              </span>
              <button
                onClick={() => setParseResult(null)}
                className="font-mono-tabular text-xs font-bold text-[#6E6960] hover:text-[#141312] dark:text-[#7C8797] dark:hover:text-[#F2EFE9]"
              >
                RESET / UPLOAD ANOTHER
              </button>
            </div>

            <div className="overflow-x-auto max-h-80 font-mono-tabular">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="border-b border-[#D2C8B8] bg-[#E5DFD2] text-[10px] font-bold uppercase text-[#6E6960] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#7C8797] sticky top-0">
                  <tr>
                    <th className="py-2 px-3">ROW</th>
                    <th className="py-2 px-3">VALIDATION</th>
                    <th className="py-2 px-3">ASSET NUMBER</th>
                    <th className="py-2 px-3">SERIAL NUMBER</th>
                    <th className="py-2 px-3">MODEL</th>
                    <th className="py-2 px-3">STATUS</th>
                    <th className="py-2 px-3">REASON / ERRORS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D2C8B8] dark:divide-[#2B323D] text-[#141312] dark:text-[#F2EFE9]">
                  {parseResult.rows.map((row) => (
                    <tr key={row.rowNumber} className={row.isValid ? '' : 'bg-[#B2534C]/5 dark:bg-[#B85D56]/5'}>
                      <td className="py-2 px-3 font-bold">{row.rowNumber}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            row.isValid
                              ? 'bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black'
                              : 'bg-[#B2534C] text-black dark:bg-[#B85D56] dark:text-black'
                          }`}
                        >
                          {row.isValid ? 'VALID' : 'REJECTED'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold">{row.data.assetNumber || '—'}</td>
                      <td className="py-2 px-3">{row.data.serialNumber || '—'}</td>
                      <td className="py-2 px-3">{row.data.model || '—'}</td>
                      <td className="py-2 px-3">{row.data.status || '—'}</td>
                      <td className="py-2 px-3 text-[#B2534C] dark:text-[#E28882]">
                        {row.errors.length > 0 ? row.errors.join('; ') : 'Passed all checks'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Commit Import Bar */}
            <div className="flex items-center justify-between border-t border-[#D2C8B8] bg-[#E5DFD2] p-3.5 dark:border-[#2B323D] dark:bg-[#181C24]">
              <span className="font-mono-tabular text-xs text-[#6E6960] dark:text-[#7C8797]">
                {parseResult.validRowsCount} valid units ready to commit to registry.
              </span>
              <button
                onClick={handleConfirmImport}
                disabled={parseResult.validRowsCount === 0 || isImporting}
                className="rounded bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black px-4 py-2 text-xs font-black font-industrial-display shadow-xs hover:brightness-105 disabled:opacity-40 transition-all"
              >
                {isImporting ? 'COMMITTING...' : `COMMIT ${parseResult.validRowsCount} ASSETS`}
              </button>
            </div>
          </div>

          {importSummary && (
            <div className="rounded-lg border border-[#5D7F5F] bg-[#5D7F5F]/15 p-4 font-mono-tabular text-xs text-[#141312] dark:text-[#F2EFE9] flex items-center justify-between">
              <div>
                <p className="font-bold">IMPORT BATCH COMPLETED SUCCESSFULLY</p>
                <p className="text-[11px] mt-0.5">
                  Imported {importSummary.imported} records · Rejected {importSummary.rejected} duplicates
                </p>
              </div>
              <button
                onClick={() => setActiveView('assets')}
                className="rounded bg-[#141312] text-[#F8F4EC] dark:bg-[#F2EFE9] dark:text-[#12151B] px-3 py-1.5 font-bold font-industrial-display"
              >
                VIEW REGISTRY →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
