/**
 * IT Asset Management - Inventory & Audit Reports View (Industrial Redesign)
 * High-contrast telemetry cards, equipment breakdown meters, and compliance indicators.
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building,
  Laptop,
  Layers,
} from 'lucide-react';
import { Asset, DashboardMetrics, ReturnRecord } from '../../types/asset.ts';
import { assetService, isNeedsReview } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

export const ReportsView: React.FC = () => {
  const { refreshTrigger } = useApp();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  useEffect(() => {
    async function load() {
      const [a, m, r] = await Promise.all([
        assetService.getAssets(),
        assetService.getMetrics(),
        assetService.getReturns(),
      ]);
      setAssets(a);
      setMetrics(m);
      setReturns(r);
    }
    load();
  }, [refreshTrigger]);

  // Breakdown by Type
  const typeCounts: Record<string, number> = {};
  assets.forEach((a) => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });

  // Breakdown by Department
  const deptCounts: Record<string, number> = {};
  assets.forEach((a) => {
    deptCounts[a.department] = (deptCounts[a.department] || 0) + 1;
  });

  // Revision Compliance
  const needsReviewCount = assets.filter(
    (a) => a.status !== 'Disposed' && isNeedsReview(a.revision)
  ).length;
  const compliantCount = assets.filter((a) => a.status !== 'Disposed').length - needsReviewCount;
  const complianceRate =
    assets.length > 0 ? Math.round((compliantCount / Math.max(1, compliantCount + needsReviewCount)) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3.5 dark:border-[#2B323D] dark:bg-[#12151B]">
        <div>
          <h1 className="font-industrial-display text-base font-black uppercase tracking-tight text-[#141312] dark:text-[#F2EFE9] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#E49C52] dark:text-[#E7A45F]" />
            FLEET INVENTORY &amp; COMPLIANCE AUDIT REPORTS
          </h1>
          <p className="text-xs text-[#6E6960] dark:text-[#7C8797] font-medium mt-0.5">
            Hardware lifecycle distribution, department allocations, and compliance revision tracking.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded border border-[#D2C8B8] bg-[#E5DFD2] px-3 py-1.5 text-xs font-bold font-industrial-display text-[#141312] hover:bg-[#DCD4C4] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] dark:hover:bg-[#202530] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>EXPORT / PRINT REPORT</span>
          </button>
        </div>
      </div>

      {/* Top 3 Analytical KPI Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Compliance Rate */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4 dark:border-[#2B323D] dark:bg-[#12151B] font-mono-tabular">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6960] dark:text-[#7C8797]">
            REVISION AUDIT COMPLIANCE
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-industrial-display text-3xl font-black text-[#5D7F5F] dark:text-[#668768]">
              {complianceRate}%
            </span>
            <span className="text-xs text-[#6E6960] dark:text-[#7C8797]">
              {compliantCount} / {compliantCount + needsReviewCount} active
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-xs bg-[#E5DFD2] dark:bg-[#181C24] overflow-hidden">
            <div
              className="h-full bg-[#5D7F5F] dark:bg-[#668768] transition-all duration-500"
              style={{ width: `${complianceRate}%` }}
            />
          </div>
        </div>

        {/* Fleet Allocation Ratio */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4 dark:border-[#2B323D] dark:bg-[#12151B] font-mono-tabular">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6960] dark:text-[#7C8797]">
            STOCK DEPLOYMENT RATIO
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-industrial-display text-3xl font-black text-[#E49C52] dark:text-[#E7A45F]">
              {assets.length > 0 ? Math.round(((metrics?.inUse || 0) / assets.length) * 100) : 0}%
            </span>
            <span className="text-xs text-[#6E6960] dark:text-[#7C8797]">Deployed to Users</span>
          </div>
          <p className="mt-2 text-[11px] text-[#6E6960] dark:text-[#7C8797]">
            {metrics?.inUse} In Use · {metrics?.spare} Spare · {metrics?.disposed} Disposed
          </p>
        </div>

        {/* Temporary Handover Volume */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4 dark:border-[#2B323D] dark:bg-[#12151B] font-mono-tabular">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6960] dark:text-[#7C8797]">
            ACTIVE TEMP LOAN VOLUME
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-industrial-display text-3xl font-black text-[#D2761F] dark:text-[#D9822B]">
              {metrics?.tempActiveHandovers}
            </span>
            <span className="text-xs text-[#6E6960] dark:text-[#7C8797]">Temporary Loaners</span>
          </div>
          <p className="mt-2 text-[11px] text-[#6E6960] dark:text-[#7C8797]">
            Short-term borrower agreements active
          </p>
        </div>
      </div>

      {/* Grid: Type Breakdown & Department Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Device Type Distribution */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4.5 dark:border-[#2B323D] dark:bg-[#12151B]">
          <h2 className="font-industrial-display text-xs font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] mb-4 flex items-center gap-2">
            <Laptop className="h-4 w-4 text-[#E49C52] dark:text-[#E7A45F]" />
            EQUIPMENT COMPOSITION BY CATEGORY
          </h2>

          <div className="space-y-3 font-mono-tabular">
            {Object.entries(typeCounts).map(([type, count]) => {
              const pct = Math.round((count / (assets.length || 1)) * 100);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{type}</span>
                    <span className="text-[#6E6960] dark:text-[#7C8797]">
                      {count} units ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-xs bg-[#E5DFD2] dark:bg-[#181C24] overflow-hidden">
                    <div
                      className="h-full bg-[#E49C52] dark:bg-[#E7A45F] rounded-xs"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Allocation */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4.5 dark:border-[#2B323D] dark:bg-[#12151B]">
          <h2 className="font-industrial-display text-xs font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] mb-4 flex items-center gap-2">
            <Building className="h-4 w-4 text-[#5D7F5F] dark:text-[#668768]" />
            DEVICE ALLOCATION BY DEPARTMENT
          </h2>

          <div className="space-y-3 font-mono-tabular">
            {Object.entries(deptCounts).map(([dept, count]) => {
              const pct = Math.round((count / (assets.length || 1)) * 100);
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{dept}</span>
                    <span className="text-[#6E6960] dark:text-[#7C8797]">
                      {count} units ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-xs bg-[#E5DFD2] dark:bg-[#181C24] overflow-hidden">
                    <div
                      className="h-full bg-[#5D7F5F] dark:bg-[#668768] rounded-xs"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
