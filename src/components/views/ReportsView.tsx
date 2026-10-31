/**
 * IT Asset Management - Inventory & Audit Reports View
 * Visual analytics covering asset status distribution, device types, audit compliance, and department allocations.
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  Download,
  ShieldCheck,
  Building,
  Layers,
  Laptop,
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Asset Inventory &amp; Compliance Audit Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Aggregated lifecycle metrics, hardware distribution, department allocations, and compliance tracking.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Top 3 Analytical KPI Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Compliance Rate */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Revision Audit Compliance
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
              {complianceRate}%
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {compliantCount} of {compliantCount + needsReviewCount} active units
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${complianceRate}%` }}
            />
          </div>
        </div>

        {/* Fleet Allocation Ratio */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Stock Utilization Ratio
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">
              {assets.length > 0 ? Math.round(((metrics?.inUse || 0) / assets.length) * 100) : 0}%
            </span>
            <span className="text-xs text-slate-500">In Active Deployment</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {metrics?.inUse} In Use · {metrics?.spare} Available Spare · {metrics?.disposed} Disposed
          </p>
        </div>

        {/* Temporary Handover Volume */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Active TEMP Loan Volume
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {metrics?.tempActiveHandovers}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Temporary loans</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Requires return check-in at expiration date
          </p>
        </div>
      </div>

      {/* Grid: Type Breakdown & Department Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Type Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Laptop className="h-4 w-4 text-blue-600" />
            Equipment Composition by Category
          </h2>

          <div className="space-y-3">
            {Object.entries(typeCounts).map(([type, count]) => {
              const pct = Math.round((count / assets.length) * 100);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{type}</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {count} units ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Allocation */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Building className="h-4 w-4 text-emerald-600" />
            Device Allocation by Department
          </h2>

          <div className="space-y-3">
            {Object.entries(deptCounts).map(([dept, count]) => {
              const pct = Math.round((count / assets.length) * 100);
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{dept}</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {count} units ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
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
