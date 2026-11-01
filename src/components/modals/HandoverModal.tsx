/**
 * IT Asset Management - Register Handover Modal (Industrial Redesign)
 * Captures Temporary/Permanent handover events with condition, IT user tracking, and confirmation status.
 */

import React, { useState } from 'react';
import { X, ArrowUpRight, ShieldCheck, AlertCircle, Calendar } from 'lucide-react';
import { Asset, DeviceCondition, Employee, HandoverType } from '../../types/asset.ts';
import { assetService } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

interface HandoverModalProps {
  availableAssets?: Asset[];
  employees?: Employee[];
  preselectedAsset?: Asset;
  onClose: () => void;
  onSuccess: () => void;
}

const CONDITIONS: { value: DeviceCondition; label: string }[] = [
  { value: 'Good', label: 'Good' },
  { value: 'Minor Damage', label: 'Minor Damage' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'Not Working', label: 'Not Working' },
];

export const HandoverModal: React.FC<HandoverModalProps> = ({
  availableAssets = [],
  employees = [],
  preselectedAsset,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useApp();
  const [loadedAssets, setLoadedAssets] = useState<Asset[]>(availableAssets);
  const [loadedEmployees, setLoadedEmployees] = useState<Employee[]>(employees);
  const [selectedAssetNumber, setSelectedAssetNumber] = useState<string>(
    preselectedAsset?.assetNumber || availableAssets[0]?.assetNumber || ''
  );
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string>(
    employees[0]?.personalCode || ''
  );
  const [type, setType] = useState<HandoverType>('Permanent');
  const [condition, setCondition] = useState<DeviceCondition>('Good');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy load if not passed
  React.useEffect(() => {
    async function load() {
      if (loadedAssets.length === 0) {
        const all = await assetService.getAssets();
        const spares = all.filter((a) => a.status === 'Spare');
        setLoadedAssets(spares);
        if (!selectedAssetNumber && spares[0]) {
          setSelectedAssetNumber(spares[0].assetNumber);
        }
      }
      if (loadedEmployees.length === 0) {
        const emps = await assetService.getEmployees();
        setLoadedEmployees(emps);
        if (!selectedEmployeeCode && emps[0]) {
          setSelectedEmployeeCode(emps[0].personalCode);
        }
      }
    }
    load();
  }, []);

  const selectedEmployee = loadedEmployees.find((e) => e.personalCode === selectedEmployeeCode);
  const selectedAsset = loadedAssets.find((a) => a.assetNumber === selectedAssetNumber) || preselectedAsset;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetNumber) {
      setError('Please select an asset to hand over');
      return;
    }
    if (!selectedEmployee) {
      setError('Please select a recipient employee');
      return;
    }
    if (type === 'Temporary' && !expectedReturnDate) {
      setError('Please specify an expected return date for temporary loans');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await assetService.registerHandover({
        assetNumber: selectedAssetNumber,
        personalCode: selectedEmployee.personalCode,
        employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
        type,
        condition,
        comments: comments.trim() || undefined,
        expectedReturnDate: type === 'Temporary' ? expectedReturnDate : undefined,
        itUserId: currentUser.id,
        itUserName: `${currentUser.name} (${currentUser.role})`,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to register handover');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] shadow-2xl dark:border-[#2B323D] dark:bg-[#12151B]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D2C8B8] p-4 dark:border-[#2B323D] bg-[#E5DFD2]/60 dark:bg-[#181C24]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-industrial-display text-sm font-black uppercase text-[#141312] dark:text-[#F2EFE9]">
                REGISTER DEVICE HANDOVER
              </h3>
              <p className="text-[10px] font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                DEPLOY EQUIPMENT FROM IT STOCK TO EMPLOYEE
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#6E6960] hover:text-[#141312] hover:bg-[#D2C8B8] dark:text-[#7C8797] dark:hover:text-[#F2EFE9] dark:hover:bg-[#2B323D]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-mono-tabular text-xs">
          {error && (
            <div className="flex items-center gap-2 rounded bg-[#B2534C]/15 p-3 text-xs text-[#B2534C] dark:text-[#E28882] border border-[#B2534C]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Selection */}
          <div className="space-y-1">
            <label className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] block">
              TARGET EQUIPMENT (SPARE STOCK) *
            </label>
            {preselectedAsset ? (
              <div className="rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 p-2.5 font-bold text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]">
                <span>{preselectedAsset.assetNumber}</span> — {preselectedAsset.model} ({preselectedAsset.type}) [SN: {preselectedAsset.serialNumber}]
              </div>
            ) : (
              <select
                value={selectedAssetNumber}
                onChange={(e) => setSelectedAssetNumber(e.target.value)}
                className="w-full rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 p-2 text-xs text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] focus:outline-none"
              >
                {loadedAssets.length === 0 ? (
                  <option value="">No Spare devices available in stock</option>
                ) : (
                  loadedAssets.map((a) => (
                    <option key={a.assetNumber} value={a.assetNumber}>
                      {a.assetNumber} - {a.model} ({a.type}) [SN: {a.serialNumber}]
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Recipient Employee */}
          <div className="space-y-1">
            <label className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] block">
              RECIPIENT EMPLOYEE *
            </label>
            <select
              value={selectedEmployeeCode}
              onChange={(e) => setSelectedEmployeeCode(e.target.value)}
              className="w-full rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 p-2 text-xs text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] focus:outline-none"
            >
              {loadedEmployees.map((emp) => (
                <option key={emp.personalCode} value={emp.personalCode}>
                  {emp.firstName} {emp.lastName} ({emp.personalCode}) — {emp.department} [Mgr: {emp.directManager}]
                </option>
              ))}
            </select>
          </div>

          {/* Handover Agreement Type */}
          <div className="space-y-1">
            <label className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] block">
              AGREEMENT CLASSIFICATION *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('Permanent')}
                className={`py-2 px-3 text-xs font-bold rounded border transition-all ${
                  type === 'Permanent'
                    ? 'border-[#141312] bg-[#141312] text-[#F8F4EC] dark:border-[#F2EFE9] dark:bg-[#F2EFE9] dark:text-[#12151B]'
                    : 'border-[#D2C8B8] bg-[#E5DFD2]/40 text-[#141312] hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]'
                }`}
              >
                PERMANENT ASSIGNMENT
              </button>
              <button
                type="button"
                onClick={() => setType('Temporary')}
                className={`py-2 px-3 text-xs font-bold rounded border transition-all ${
                  type === 'Temporary'
                    ? 'border-[#D2761F] bg-[#D2761F] text-black dark:border-[#D9822B] dark:bg-[#D9822B] dark:text-black font-black'
                    : 'border-[#D2C8B8] bg-[#E5DFD2]/40 text-[#141312] hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]'
                }`}
              >
                TEMPORARY LOAN (TEMP)
              </button>
            </div>
          </div>

          {/* Expected Return Date (for Temporary handovers) */}
          {type === 'Temporary' && (
            <div className="space-y-1 bg-[#D2761F]/10 p-3 rounded border border-[#D2761F] dark:border-[#D9822B]">
              <label className="font-bold text-xs text-[#D2761F] dark:text-[#EAA55A] block">
                EXPECTED RETURN DATE *
              </label>
              <input
                type="date"
                required
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full rounded border border-[#D2C8B8] bg-[#F8F4EC] p-2 text-xs text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]"
              />
            </div>
          )}

          {/* Initial Condition */}
          <div className="space-y-1">
            <label className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] block">
              DISPATCH CONDITION *
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCondition(c.value)}
                  className={`py-1.5 px-2 text-center text-xs rounded border transition-all ${
                    condition === c.value
                      ? 'border-[#5D7F5F] bg-[#5D7F5F] text-black dark:border-[#668768] dark:bg-[#668768] font-bold'
                      : 'border-[#D2C8B8] bg-[#E5DFD2]/40 text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-1">
            <label className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] block">
              DISPATCH REMARKS
            </label>
            <textarea
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Record handover remarks, accessories supplied, etc..."
              className="w-full rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 p-2 text-xs text-[#141312] focus:border-[#E49C52] focus:outline-none dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D2C8B8] dark:border-[#2B323D]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded border border-[#D2C8B8] px-3.5 py-2 text-xs font-bold text-[#6E6960] hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:text-[#7C8797]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black px-4 py-2 text-xs font-black font-industrial-display shadow-xs hover:brightness-105 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? 'DISPATCHING...' : 'DISPATCH & REGISTER HANDOVER'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
