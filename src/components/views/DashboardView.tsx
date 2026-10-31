/**
 * IT Asset Management - Dashboard View
 * Modern Minimalist SaaS Dashboard featuring 7 summary KPI cards and urgent operational queues.
 */

import React, { useEffect, useState } from 'react';
import {
  Laptop,
  CheckCircle2,
  Package,
  Clock,
  AlertTriangle,
  Archive,
  FileCheck2,
  ArrowRight,
  ShieldAlert,
  Calendar,
  UserCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Asset, DashboardMetrics, HandoverRecord, ReturnRecord } from '../../types/asset.ts';
import { assetService, getSubordinateAssets, isNeedsReview } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

export const DashboardView: React.FC = () => {
  const { currentUser, setActiveView, setSelectedAssetNumber, refreshTrigger, triggerRefresh } = useApp();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [m, a, h, r] = await Promise.all([
          assetService.getMetrics(),
          assetService.getAssets(),
          assetService.getHandovers(),
          assetService.getReturns(),
        ]);
        setMetrics(m);
        setAssets(a);
        setHandovers(h);
        setReturns(r);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [currentUser, refreshTrigger]);

  const handleConfirmReceipt = async (handoverId: string) => {
    try {
      await assetService.confirmHandover(handoverId);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter queues based on role
  const needsReviewAssets = assets.filter((a) => a.status !== 'Disposed' && isNeedsReview(a.revision));
  const pendingHandovers = handovers.filter((h) => h.confirmationState === 'Pending Confirmation');

  // Activity feed combining recent handovers and returns
  const recentActivities = [
    ...handovers.map((h) => ({
      id: h.id,
      kind: 'handover' as const,
      date: h.createdAt,
      title: `${h.type} Handover: ${h.assetNumber}`,
      desc: `Assigned to ${h.employeeName} (${h.personalCode})`,
      itUser: h.itUserName,
      condition: h.condition,
    })),
    ...returns.map((r) => ({
      id: r.id,
      kind: 'return' as const,
      date: r.createdAt,
      title: `Stock Return: ${r.assetNumber}`,
      desc: `Returned by ${r.employeeName}`,
      itUser: r.itUserName,
      condition: r.condition,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Scope Context Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Executive IT Fleet Overview
            </h1>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
              {currentUser.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {currentUser.role === 'IT Admin' &&
              'Global IT administrator workspace. Displaying enterprise-wide hardware metrics, pending workflows, and stock balance.'}
            {currentUser.role === 'Manager / Supervisor' &&
              `Supervisor view for ${currentUser.name}. Visibility is focused on subordinate employees and their allocated devices.`}
            {currentUser.role === 'Employee' &&
              `Employee self-service view for ${currentUser.name}. Inspect personal assignments and sign off on equipment handovers.`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveView('assets')}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            <span>Browse All Assets</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 7 Standardized Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {/* 1. All Devices */}
        <div
          onClick={() => setActiveView('assets')}
          className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">All Devices</span>
            <Laptop className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
            {isLoading ? '—' : metrics?.allDevices}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Total cataloged fleet</p>
        </div>

        {/* 2. In Use (Status) */}
        <div
          onClick={() => setActiveView('assets')}
          className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">In Use</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {isLoading ? '—' : metrics?.inUse}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Active assignments</p>
        </div>

        {/* 3. Spare / IT Stock (Status) */}
        <div
          onClick={() => setActiveView('assets')}
          className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Spare / IT Stock</span>
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400 font-mono tabular-nums">
            {isLoading ? '—' : metrics?.spare}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Ready in IT stockroom</p>
        </div>

        {/* 4. TEMP Active Handovers (Operational indicator) */}
        <div
          onClick={() => setActiveView('assets')}
          className="group relative cursor-pointer rounded-xl border border-amber-200/80 bg-amber-50/20 p-4 shadow-xs transition-all hover:border-amber-400 dark:border-amber-900/40 dark:bg-amber-950/10"
        >
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="text-xs font-semibold">TEMP Handovers</span>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300 font-mono tabular-nums">
            {isLoading ? '—' : metrics?.tempActiveHandovers}
          </p>
          <p className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80">Temporary loans</p>
        </div>

        {/* 5. Needs Review (Operational indicator: Revision date only) */}
        <div
          onClick={() => setActiveView('assets')}
          className="group relative cursor-pointer rounded-xl border border-rose-200/80 bg-rose-50/20 p-4 shadow-xs transition-all hover:border-rose-400 dark:border-rose-900/40 dark:bg-rose-950/10"
        >
          <div className="flex items-center justify-between text-rose-800 dark:text-rose-300">
            <span className="text-xs font-semibold">Needs Review</span>
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono tabular-nums">
            {isLoading ? '—' : metrics?.needsReview}
          </p>
          <p className="mt-1 text-[11px] text-rose-600/80 dark:text-rose-400/80">Revision &gt; 6 mo.</p>
        </div>

        {/* 6. Disposed (Status) */}
        <div
          onClick={() => setActiveView('assets')}
          className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Disposed</span>
            <Archive className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            {isLoading ? '—' : metrics?.disposed}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Recycled / E-Waste</p>
        </div>

        {/* 7. Pending Confirmations (Operational indicator) */}
        <div
          onClick={() => setActiveView('assets')}
          className="group relative cursor-pointer rounded-xl border border-purple-200/80 bg-purple-50/20 p-4 shadow-xs transition-all hover:border-purple-400 dark:border-purple-900/40 dark:bg-purple-950/10"
        >
          <div className="flex items-center justify-between text-purple-800 dark:text-purple-300">
            <span className="text-xs font-semibold">Pending Sign-off</span>
            <FileCheck2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-purple-700 dark:text-purple-300 font-mono tabular-nums">
            {isLoading ? '—' : metrics?.pendingConfirmations}
          </p>
          <p className="mt-1 text-[11px] text-purple-600/80 dark:text-purple-400/80">Awaiting employee</p>
        </div>
      </div>

      {/* Main Grid: Operational Attention Queues & Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Operational Queues */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Handover Confirmations Queue */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Pending Handover Confirmations ({pendingHandovers.length})
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Requires recipient employee receipt verification
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingHandovers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  All active handovers have been confirmed. No pending sign-offs.
                </div>
              ) : (
                pendingHandovers.map((h) => (
                  <div key={h.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                          {h.assetNumber}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                          Recipient: {h.employeeName} ({h.personalCode})
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                          {h.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Dispatched by {h.itUserName} on {new Date(h.handoverDate).toLocaleDateString()} ·
                        Condition: <strong>{h.condition}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleConfirmReceipt(h.id)}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 transition-colors"
                      >
                        Confirm Receipt
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Overdue Revision Alerts (Needs Review) */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Assets Needing Revision ({needsReviewAssets.length})
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Calculated strictly from Revision Date &gt; configured threshold
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {needsReviewAssets.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  All active assets are within their compliance revision period.
                </div>
              ) : (
                needsReviewAssets.slice(0, 4).map((asset) => (
                  <div
                    key={asset.assetNumber}
                    onClick={() => {
                      setSelectedAssetNumber(asset.assetNumber);
                      setActiveView('assets');
                    }}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                          {asset.assetNumber}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {asset.model} ({asset.type})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Last Revision: {new Date(asset.revision).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>Assignee: {asset.currentUserName || 'Unassigned Stock'}</span>
                        <span>·</span>
                        <span>AC Owner: {asset.acOwner}</span>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      Inspect
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 span): Recent Audit Timeline */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 p-4.5 transition-colors">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Recent Transaction Log</span>
              <span className="text-[10px] font-normal text-slate-400">Handovers &amp; Returns</span>
            </h2>

            <div className="space-y-4">
              {recentActivities.map((act) => (
                <div key={act.id} className="relative pl-5 border-l-2 border-slate-200 dark:border-slate-800">
                  <div
                    className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${
                      act.kind === 'handover' ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {act.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(act.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {act.desc}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-500">
                    <span>By: {act.itUser}</span>
                    <span>·</span>
                    <span>Condition: {act.condition}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Mock Notice Box */}
          <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-4 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
            <p className="font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              REST API Ready Architecture
            </p>
            <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
              This dashboard is powered by an asynchronous client abstraction (`src/services/assetService.ts`).
              It will seamlessly connect to the Python FastAPI backend and PostgreSQL database without modifying UI components.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
