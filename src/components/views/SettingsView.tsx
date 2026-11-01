/**
 * IT Asset Management - System Settings View (Industrial Redesign)
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
    <div className="space-y-4 max-w-4xl">
      {/* Header Banner */}
      <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3.5 dark:border-[#2B323D] dark:bg-[#12151B]">
        <h1 className="font-industrial-display text-base font-black uppercase tracking-tight text-[#141312] dark:text-[#F2EFE9] flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#E49C52] dark:text-[#E7A45F]" />
          SYSTEM PARAMETERS &amp; COMPLIANCE THRESHOLDS
        </h1>
        <p className="text-xs text-[#6E6960] dark:text-[#7C8797] font-medium mt-0.5">
          Tune operational audit thresholds and storage defaults. Administrative controls are restricted to the <strong>IT Admin</strong> role.
        </p>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-lg bg-[#5D7F5F]/15 p-3 text-xs text-[#5D7F5F] dark:text-[#88B08A] border border-[#5D7F5F] font-mono-tabular">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>System parameters updated. Dashboard audit indicators recalculated.</span>
        </div>
      )}

      {resetNotice && (
        <div className="flex items-center gap-2 rounded-lg bg-[#E49C52]/15 p-3 text-xs text-[#E49C52] dark:text-[#F0B87A] border border-[#E49C52] font-mono-tabular">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Mock database restored to initial state.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-4 font-mono-tabular">
        {/* Revision Threshold Setting */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4.5 dark:border-[#2B323D] dark:bg-[#12151B] space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="font-industrial-display text-xs font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#E49C52] dark:text-[#E7A45F]" />
                NEEDS REVIEW AUDIT THRESHOLD
              </h2>
              <p className="text-xs text-[#6E6960] dark:text-[#7C8797]">
                Assets whose <strong>Revision Date</strong> is older than this duration automatically trigger the
                <span className="text-[#B2534C] dark:text-[#E28882] font-bold"> Needs Review</span> operational indicator.
              </p>
            </div>
            <span className="rounded bg-[#E5DFD2] dark:bg-[#181C24] px-2 py-0.5 text-xs font-bold text-[#141312] dark:text-[#F2EFE9] border border-[#D2C8B8] dark:border-[#2B323D]">
              {settings.revisionThresholdMonths} MONTHS
            </span>
          </div>

          <div className="pt-2">
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              disabled={!isITAdmin}
              value={settings.revisionThresholdMonths}
              onChange={(e) =>
                setSettings({ ...settings, revisionThresholdMonths: parseInt(e.target.value, 10) })
              }
              className="w-full h-2 bg-[#E5DFD2] rounded-xs appearance-none cursor-pointer accent-[#E49C52] dark:bg-[#181C24] dark:accent-[#E7A45F]"
            />
            <div className="flex justify-between text-[10px] text-[#6E6960] dark:text-[#7C8797] mt-1">
              <span>1 Month</span>
              <span>6 Months (Standard)</span>
              <span>12 Months</span>
              <span>24 Months</span>
            </div>
          </div>
        </div>

        {/* Default Stockroom Location */}
        <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-4.5 dark:border-[#2B323D] dark:bg-[#12151B] space-y-3">
          <div className="space-y-1">
            <h2 className="font-industrial-display text-xs font-black uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] flex items-center gap-2">
              <Building className="h-4 w-4 text-[#5D7F5F] dark:text-[#668768]" />
              DEFAULT RETURN STOCKROOM FACILITY
            </h2>
            <p className="text-xs text-[#6E6960] dark:text-[#7C8797]">
              When an asset is returned to stock, this location is automatically assigned as its current storage address.
            </p>
          </div>

          <input
            type="text"
            disabled={!isITAdmin}
            value={settings.defaultStockroomLocation}
            onChange={(e) => setSettings({ ...settings, defaultStockroomLocation: e.target.value })}
            className="w-full rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 p-2.5 text-xs text-[#141312] focus:border-[#E49C52] focus:outline-none dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          {isITAdmin ? (
            <button
              type="submit"
              className="rounded bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black px-4 py-2 text-xs font-black font-industrial-display shadow-xs hover:brightness-105 transition-all"
            >
              SAVE CONFIGURATION
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#6E6960] dark:text-[#7C8797]">
              <Lock className="h-4 w-4" />
              <span>Settings can only be modified by IT Administrators.</span>
            </div>
          )}

          {isITAdmin && (
            <button
              type="button"
              onClick={handleResetData}
              className="flex items-center gap-1.5 rounded border border-[#B2534C] text-[#B2534C] dark:border-[#B85D56] dark:text-[#E28882] px-3 py-1.5 text-xs font-bold hover:bg-[#B2534C]/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>RESET DEMO DATA</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
