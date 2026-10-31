/**
 * IT Asset Management - System Settings View
 * Configuration panel for IT Admins: Revision threshold adjustment, stockroom location, and policy invariants.
 */

import React, { useEffect, useState } from 'react';
import {
  Settings,
  Clock,
  ShieldCheck,
  Building,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Lock,
} from 'lucide-react';
import { SystemSettings } from '../../types/asset.ts';
import { assetService } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

export const SettingsView: React.FC = () => {
  const { currentUser, triggerRefresh } = useApp();
  const [settings, setSettings] = useState<SystemSettings>({
    revisionThresholdMonths: 6,
    defaultStockroomLocation: 'IT Stockroom - Central (Bldg 4, Rm 102)',
  });
  const [savedNotice, setSavedNotice] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);

  useEffect(() => {
    async function load() {
      const s = await assetService.getSettings();
      setSettings(s);
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await assetService.updateSettings(settings);
    setSavedNotice(true);
    triggerRefresh();
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleResetData = async () => {
    if (window.confirm('Reset all assets, handovers, and returns back to default demo fixtures?')) {
      await assetService.resetToDefaults();
      setResetNotice(true);
      triggerRefresh();
      setTimeout(() => setResetNotice(false), 3000);
    }
  };

  const isITAdmin = currentUser.role === 'IT Admin';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          System Configuration &amp; Compliance Thresholds
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Tune operational audit thresholds and storage configurations. Administrative controls are restricted to the <strong>IT Admin</strong> role.
        </p>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>System configuration successfully updated. Dashboard audit indicators recalculated.</span>
        </div>
      )}

      {resetNotice && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
          <span>Mock database successfully restored to pristine initial state.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Revision Threshold Setting */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Needs Review Audit Threshold
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assets whose <strong>Revision Date</strong> is older than this duration will automatically trigger the
                <span className="text-rose-600 dark:text-rose-400 font-semibold"> Needs Review</span> operational indicator.
              </p>
            </div>
            {!isITAdmin && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                <Lock className="h-3 w-3" />
                Read Only
              </span>
            )}
          </div>

          <div className="max-w-xs space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Audit Cycle Interval (Months)
            </label>
            <div className="flex items-center gap-3">
              <select
                disabled={!isITAdmin}
                value={settings.revisionThresholdMonths}
                onChange={(e) =>
                  setSettings({ ...settings, revisionThresholdMonths: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
              >
                <option value={3}>3 Months (Quarterly Strict Audit)</option>
                <option value={6}>6 Months (Initial Standard Threshold)</option>
                <option value={9}>9 Months</option>
                <option value={12}>12 Months (Annual Audit Cycle)</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-400">
              Current setting: Devices un-inspected for &gt; <strong>{settings.revisionThresholdMonths} months</strong> are flagged.
            </p>
          </div>
        </div>

        {/* Stockroom Location Configuration */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors space-y-4">
          <div className="space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-600" />
              Default IT Stockroom Return Location
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              When a device is returned from an employee, the asset's location automatically defaults to this facility.
            </p>
          </div>

          <div className="max-w-md space-y-1">
            <input
              type="text"
              disabled={!isITAdmin}
              value={settings.defaultStockroomLocation}
              onChange={(e) => setSettings({ ...settings, defaultStockroomLocation: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Mandatory Policy Invariants Callout */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/30 text-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            Approved System Invariants (Non-Configurable Policy Rules)
          </h2>

          <div className="space-y-2 text-slate-600 dark:text-slate-400 text-[11px]">
            <div className="flex items-start gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">•</span>
              <span>
                <strong>Unconditional Duplicate Rejection:</strong> Duplicate Asset Numbers and Serial Numbers are strictly rejected across both manual entry and Excel imports. This integrity check cannot be disabled by user preference.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">•</span>
              <span>
                <strong>Exact Status Set:</strong> Asset Status is strictly limited to <code>In Use</code>, <code>Spare</code>, and <code>Disposed</code>.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">•</span>
              <span>
                <strong>Comment Preservation:</strong> Device returns store return-specific notes in the separate <code>ReturnRecord</code> and never overwrite the asset's general comment.
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {isITAdmin && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetData}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-750 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Mock Database</span>
            </button>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
