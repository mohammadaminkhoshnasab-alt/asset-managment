/**
 * IT Asset Management - Dashboard View (Industrial Neo-Brutalist Redesign)
 * Features solid color-block KPI cards, SVG donut status gauge, timeline activity feed,
 * compact decorative equipment showcase module, and urgent operational queues including
 * the Employee "Confirm Receipt" workflow.
 */

import React, { useEffect, useState } from 'react';
import {
  Laptop,
  CheckCircle2,
  Box,
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
  Users,
  ChevronRight,
  ExternalLink,
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
    setConfirmingId(handoverId);
    try {
      await assetService.confirmHandover(handoverId);
      triggerRefresh();
    } catch (err) {
      console.error('Failed to confirm handover receipt:', err);
    } finally {
      setConfirmingId(null);
    }
  };

  // Operational Queues
  const needsReviewAssets = assets.filter((a) => a.status !== 'Disposed' && isNeedsReview(a.revision));
  const pendingHandovers = handovers.filter((h) => h.confirmationState === 'Pending Confirmation');

  // Combined Activity feed for Recent Activities module
  const recentActivities = [
    ...handovers.map((h) => ({
      id: h.id,
      kind: 'handover' as const,
      date: h.createdAt,
      title: `Asset assigned: ${h.assetNumber}`,
      desc: `Assigned to ${h.employeeName} (${h.personalCode})`,
      itUser: h.itUserName,
      condition: h.condition,
    })),
    ...returns.map((r) => ({
      id: r.id,
      kind: 'return' as const,
      date: r.createdAt,
      title: `Asset returned: ${r.assetNumber}`,
      desc: `Returned by ${r.employeeName}`,
      itUser: r.itUserName,
      condition: r.condition,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);

  // Donut Gauge math
  const total = metrics?.allDevices || 1;
  const inUseCount = metrics?.inUse || 0;
  const spareCount = metrics?.spare || 0;
  const maintenanceCount = (metrics?.needsReview || 0) + (metrics?.disposed || 0);

  const inUsePercent = Math.round((inUseCount / total) * 100);
  const sparePercent = Math.round((spareCount / total) * 100);
  const maintenancePercent = Math.max(0, 100 - inUsePercent - sparePercent);

  // SVG stroke-dasharray calculations for 100 circumference
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const inUseOffset = 0;
  const inUseLength = (inUsePercent / 100) * circumference;
  const spareLength = (sparePercent / 100) * circumference;
  const maintenanceLength = (maintenancePercent / 100) * circumference;

  return (
    <div className="space-y-5">
      {/* Top Header Lockup matching Reference Image */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#D2C8B8] dark:border-[#2B323D]">
        <div className="flex items-center gap-3">
          {/* Angled striped icon */}
          <div className="flex items-center gap-1">
            <span className="font-industrial-display font-black text-2xl text-[#E49C52] dark:text-[#E7A45F] tracking-tighter">
              ///
            </span>
          </div>
          <div>
            <h1 className="font-industrial-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#141312] dark:text-[#F2EFE9] leading-none">
              DASHBOARD
            </h1>
            <p className="text-xs text-[#6E6960] dark:text-[#7C8797] font-medium mt-1">
              {currentUser.role === 'IT Admin' && 'Enterprise hardware fleet overview, audit compliance, and stock balance.'}
              {currentUser.role === 'Manager / Supervisor' && `Supervisor console for ${currentUser.name}. Subordinate equipment visibility.`}
              {currentUser.role === 'Employee' && `Employee workstation console for ${currentUser.name}. Assigned hardware and handovers.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded border border-[#D2C8B8] bg-[#E5DFD2] px-2.5 py-1 text-[11px] font-mono-tabular font-bold uppercase text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]">
            {currentUser.role}
          </span>
          <button
            onClick={() => setActiveView('assets')}
            className="flex items-center gap-1.5 rounded bg-[#141312] text-[#F8F4EC] dark:bg-[#F2EFE9] dark:text-[#12151B] px-3 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity font-industrial-display"
          >
            <span>REGISTRY</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Solid Modular Color-Block KPI Cards matching Reference Image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Assets (Industrial Amber Block) */}
        <div
          onClick={() => {
            setSelectedAssetNumber(null);
            setActiveView('assets');
          }}
          className="relative overflow-hidden rounded-lg bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black p-4.5 cursor-pointer hover:brightness-105 transition-all shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-black uppercase tracking-wider font-industrial-display opacity-90">
              Total Assets
            </span>
            <Laptop className="h-6 w-6 opacity-85" />
          </div>

          <div className="mt-3 font-industrial-display text-4xl font-black tracking-tight font-mono-tabular">
            {metrics?.allDevices ?? '—'}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-bold font-mono-tabular">
            <span className="flex items-center gap-1 opacity-90">
              <span>↑</span> 100% REGISTRY
            </span>

            {/* Diagonal Hazard Stripes */}
            <div className="h-3 w-16 hazard-stripes-amber opacity-90 rounded-xs" />
          </div>
        </div>

        {/* 2. Assigned Assets (In Use - Sage Green Block) */}
        <div
          onClick={() => {
            setSelectedAssetNumber(null);
            setActiveView('assets');
          }}
          className="relative overflow-hidden rounded-lg bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black p-4.5 cursor-pointer hover:brightness-105 transition-all shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-black uppercase tracking-wider font-industrial-display opacity-90">
              Assigned Assets
            </span>
            <Users className="h-6 w-6 opacity-85" />
          </div>

          <div className="mt-3 font-industrial-display text-4xl font-black tracking-tight font-mono-tabular">
            {metrics?.inUse ?? '—'}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-bold font-mono-tabular">
            <span className="flex items-center gap-1 opacity-90">
              <span>↑</span> {inUsePercent}% IN USE
            </span>

            {/* Diagonal Hazard Stripes */}
            <div className="h-3 w-16 hazard-stripes-amber opacity-90 rounded-xs" />
          </div>
        </div>

        {/* 3. Available Assets (Spare - Terracotta Rust / Steel Blue Block) */}
        <div
          onClick={() => {
            setSelectedAssetNumber(null);
            setActiveView('assets');
          }}
          className="relative overflow-hidden rounded-lg bg-[#B2534C] text-black dark:bg-[#B85D56] dark:text-black p-4.5 cursor-pointer hover:brightness-105 transition-all shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-black uppercase tracking-wider font-industrial-display opacity-90">
              Available Assets
            </span>
            <Box className="h-6 w-6 opacity-85" />
          </div>

          <div className="mt-3 font-industrial-display text-4xl font-black tracking-tight font-mono-tabular">
            {metrics?.spare ?? '—'}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-bold font-mono-tabular">
            <span className="flex items-center gap-1 opacity-90">
              <span>↑</span> {sparePercent}% IN STOCK
            </span>

            {/* Diagonal Hazard Stripes */}
            <div className="h-3 w-16 hazard-stripes-amber opacity-90 rounded-xs" />
          </div>
        </div>

        {/* 4. Action / Operational Queue Indicator (Grey / Steel Block) */}
        <div
          onClick={() => {
            setSelectedAssetNumber(null);
            setActiveView('assets');
          }}
          className="relative overflow-hidden rounded-lg bg-[#C8BFB0] text-black dark:bg-[#4A607A] dark:text-black p-4.5 cursor-pointer hover:brightness-105 transition-all shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-black uppercase tracking-wider font-industrial-display opacity-90">
              Pending Actions
            </span>
            <Clock className="h-6 w-6 opacity-85" />
          </div>

          <div className="mt-3 font-industrial-display text-4xl font-black tracking-tight font-mono-tabular">
            {pendingHandovers.length + needsReviewAssets.length}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-bold font-mono-tabular">
            <span className="flex items-center gap-1 opacity-90">
              <span>!</span> {pendingHandovers.length} S-OFF / {needsReviewAssets.length} REV
            </span>

            {/* Diagonal Hazard Stripes */}
            <div className="h-3 w-16 hazard-stripes-amber opacity-90 rounded-xs" />
          </div>
        </div>
      </div>

      {/* Middle Section: Donut Status Gauge + Recent Activities + Compact Decorative Equipment Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Left: Asset Status Donut Gauge (4 cols) */}
        <div className="lg:col-span-4 rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4.5 dark:border-[#2B323D] dark:bg-[#12151B] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-industrial-display text-sm font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
              Asset Status
            </h3>
            <span className="font-mono-tabular text-[10px] text-[#6E6960] dark:text-[#7C8797]">
              EXACT 3-STATUS MODEL
            </span>
          </div>

          <div className="flex items-center justify-around gap-4 my-auto">
            {/* Donut SVG */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 100 100">
                {/* Background Track */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-[#E5DFD2] dark:text-[#181C24]"
                />

                {/* In Use Segment (Sage Green) */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="#5D7F5F"
                  strokeWidth="12"
                  strokeDasharray={`${inUseLength} ${circumference}`}
                  strokeDashoffset="0"
                  className="dark:stroke-[#668768] transition-all duration-500"
                />

                {/* Available Segment (Amber) */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="#E49C52"
                  strokeWidth="12"
                  strokeDasharray={`${spareLength} ${circumference}`}
                  strokeDashoffset={-inUseLength}
                  className="dark:stroke-[#E7A45F] transition-all duration-500"
                />

                {/* Disposed / Needs Review Segment (Terracotta) */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="#B2534C"
                  strokeWidth="12"
                  strokeDasharray={`${maintenanceLength} ${circumference}`}
                  strokeDashoffset={-(inUseLength + spareLength)}
                  className="dark:stroke-[#B85D56] transition-all duration-500"
                />
              </svg>

              {/* Center Metrics Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-industrial-display text-xl font-black text-[#141312] dark:text-[#F2EFE9] font-mono-tabular leading-none">
                  {metrics?.allDevices ?? 0}
                </span>
                <span className="font-mono-tabular text-[10px] uppercase font-bold text-[#6E6960] dark:text-[#7C8797] mt-0.5">
                  Total
                </span>
              </div>
            </div>

            {/* Legend matching Reference */}
            <div className="space-y-2.5 font-mono-tabular text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#5D7F5F] dark:bg-[#668768] shrink-0" />
                <span className="text-[#6E6960] dark:text-[#7C8797] font-medium">In Use</span>
                <span className="font-bold text-[#141312] dark:text-[#F2EFE9] ml-auto">
                  {inUseCount} ({inUsePercent}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#E49C52] dark:bg-[#E7A45F] shrink-0" />
                <span className="text-[#6E6960] dark:text-[#7C8797] font-medium">Available</span>
                <span className="font-bold text-[#141312] dark:text-[#F2EFE9] ml-auto">
                  {spareCount} ({sparePercent}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#B2534C] dark:bg-[#B85D56] shrink-0" />
                <span className="text-[#6E6960] dark:text-[#7C8797] font-medium">Audit / Disp</span>
                <span className="font-bold text-[#141312] dark:text-[#F2EFE9] ml-auto">
                  {maintenanceCount} ({maintenancePercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Recent Activities (4 cols) */}
        <div className="lg:col-span-4 rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4.5 dark:border-[#2B323D] dark:bg-[#12151B] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-industrial-display text-sm font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
              Recent Activities
            </h3>
            <button
              onClick={() => setActiveView('reports')}
              className="text-[11px] font-bold font-mono-tabular text-[#E49C52] dark:text-[#E7A45F] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          <div className="space-y-3.5 my-auto">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-start gap-3">
                {/* Timeline Dot matching Reference */}
                <div className="mt-1 flex flex-col items-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ring-2 ring-[#F8F4EC] dark:ring-[#12151B] ${
                      act.kind === 'handover'
                        ? 'bg-[#E49C52] dark:bg-[#E7A45F]'
                        : 'bg-[#5D7F5F] dark:bg-[#668768]'
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-bold text-[#141312] dark:text-[#F2EFE9]">
                      {act.title}
                    </p>
                    <span className="font-mono-tabular text-[10px] text-[#6E6960] dark:text-[#7C8797] shrink-0">
                      {new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-[#6E6960] dark:text-[#7C8797]">
                    {act.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Compact Decorative Industrial Equipment Showcase (4 cols) */}
        <div className="lg:col-span-4 rounded-lg border border-[#D2C8B8] dark:border-[#2B323D] overflow-hidden flex flex-row shadow-sm min-h-[160px]">
          {/* Left half: Industrial Equipment Imagery from reference asset */}
          <div className="relative w-1/2 bg-[#12151B] overflow-hidden">
            <img
              src="/assets/aistudio/193131f3-d455-47df-8ad4-1a0eac305b1a_ff079029.png"
              alt="Industrial Machinery Showcase"
              className="h-full w-full object-cover object-left opacity-90 contrast-125"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/30" />
          </div>

          {/* Right half: Solid Color Panel matching Reference Image */}
          <div className="w-1/2 bg-[#B2534C] dark:bg-[#B85D56] text-black p-4 flex flex-col justify-between relative">
            <div>
              <span className="font-mono-tabular text-[9px] font-bold tracking-widest uppercase opacity-80 block">
                /// FLEET CONSOLE
              </span>
              <h4 className="font-industrial-display font-black text-sm uppercase tracking-tight leading-tight mt-1">
                IT ASSET MANAGEMENT
              </h4>
            </div>

            <div className="space-y-0.5 text-xs font-bold font-industrial-display opacity-95">
              <p>Track.</p>
              <p>Manage.</p>
              <p>Optimize.</p>
            </div>

            {/* Corner Hazard Stripes */}
            <div className="self-end h-3 w-14 hazard-stripes-amber opacity-90 rounded-xs" />
          </div>
        </div>
      </div>

      {/* Operational Attention Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* 1. Pending Handover Confirmations with the critical "Confirm Receipt" Action */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] dark:border-[#2B323D] dark:bg-[#12151B] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#D2C8B8] p-3.5 dark:border-[#2B323D] bg-[#E5DFD2]/40 dark:bg-[#181C24]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#744D7E] dark:bg-[#7A5884]" />
              <h2 className="font-industrial-display text-xs font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
                Pending Confirmations ({pendingHandovers.length})
              </h2>
            </div>
            <span className="font-mono-tabular text-[10px] text-[#6E6960] dark:text-[#7C8797]">
              EMPLOYEE SIGN-OFF REQUIRED
            </span>
          </div>

          <div className="divide-y divide-[#D2C8B8] dark:divide-[#2B323D]">
            {pendingHandovers.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                All active handovers verified. Zero pending sign-offs.
              </div>
            ) : (
              pendingHandovers.map((h) => (
                <div key={h.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-tabular text-xs font-bold text-[#141312] dark:text-[#F2EFE9] bg-[#E5DFD2] dark:bg-[#181C24] px-1.5 py-0.5 rounded border border-[#D2C8B8] dark:border-[#2B323D]">
                        {h.assetNumber}
                      </span>
                      <span className="text-xs font-semibold text-[#141312] dark:text-[#F2EFE9]">
                        {h.employeeName} ({h.personalCode})
                      </span>
                      <span className="text-[10px] font-mono-tabular font-bold px-1.5 py-0.2 rounded bg-[#744D7E]/15 text-[#744D7E] dark:bg-[#7A5884]/30 dark:text-[#C5A4D0]">
                        {h.type}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                      Dispatched by {h.itUserName} · Condition: <strong>{h.condition}</strong>
                    </p>
                  </div>

                  {/* Preserved "Confirm Receipt" Action Button */}
                  <div className="shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleConfirmReceipt(h.id)}
                      disabled={confirmingId === h.id}
                      className="rounded bg-[#744D7E] dark:bg-[#7A5884] text-white px-3 py-1.5 text-xs font-bold font-industrial-display shadow-xs hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{confirmingId === h.id ? 'Confirming...' : 'Confirm Receipt'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Assets Needing Revision (> 6 months) */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] dark:border-[#2B323D] dark:bg-[#12151B] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#D2C8B8] p-3.5 dark:border-[#2B323D] bg-[#E5DFD2]/40 dark:bg-[#181C24]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#B2534C] dark:bg-[#B85D56]" />
              <h2 className="font-industrial-display text-xs font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
                Assets Needing Revision ({needsReviewAssets.length})
              </h2>
            </div>
            <span className="font-mono-tabular text-[10px] text-[#6E6960] dark:text-[#7C8797]">
              REVISION &gt; 6 MONTHS
            </span>
          </div>

          <div className="divide-y divide-[#D2C8B8] dark:divide-[#2B323D]">
            {needsReviewAssets.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                All assets conform to compliance schedule. Zero overdue revisions.
              </div>
            ) : (
              needsReviewAssets.slice(0, 3).map((asset) => (
                <div
                  key={asset.assetNumber}
                  onClick={() => {
                    setSelectedAssetNumber(asset.assetNumber);
                    setActiveView('assets');
                  }}
                  className="p-3.5 flex items-center justify-between hover:bg-[#E5DFD2]/50 dark:hover:bg-[#181C24]/60 cursor-pointer transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-xs font-bold text-[#141312] dark:text-[#F2EFE9]">
                        {asset.assetNumber}
                      </span>
                      <span className="text-xs text-[#6E6960] dark:text-[#7C8797]">
                        {asset.model} ({asset.type})
                      </span>
                    </div>
                    <p className="text-[11px] font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                      Last Revision: {new Date(asset.revision).toLocaleDateString()} · Assignee: {asset.currentUserName || 'Stock'}
                    </p>
                  </div>

                  <span className="text-xs font-bold text-[#B2534C] dark:text-[#B85D56] font-mono-tabular flex items-center gap-1">
                    Inspect →
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
