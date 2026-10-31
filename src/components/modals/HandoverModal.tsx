/**
 * IT Asset Management - Register Handover Modal
 * Captures Temporary/Permanent handover events with condition, IT user tracking, and confirmation status.
 */

import React, { useState } from 'react';
import { X, ArrowUpRight, ShieldCheck, AlertCircle, Calendar } from 'lucide-react';
import { Asset, DeviceCondition, Employee, HandoverType } from '../../types/asset.ts';
import { assetService } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

interface HandoverModalProps {
  availableAssets: Asset[];
  employees: Employee[];
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
  availableAssets,
  employees,
  preselectedAsset,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useApp();
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

  const selectedEmployee = employees.find((e) => e.personalCode === selectedEmployeeCode);
  const selectedAsset = availableAssets.find((a) => a.assetNumber === selectedAssetNumber) || preselectedAsset;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Register Device Handover
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deploy equipment from IT stock to employee
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Device (from Spare stock) *
            </label>
            {preselectedAsset ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <span className="font-mono font-semibold">{preselectedAsset.assetNumber}</span> —{' '}
                {preselectedAsset.model} ({preselectedAsset.type})
              </div>
            ) : (
              <select
                value={selectedAssetNumber}
                onChange={(e) => setSelectedAssetNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {availableAssets.length === 0 ? (
                  <option value="">No Spare devices available in stock</option>
                ) : (
                  availableAssets.map((a) => (
                    <option key={a.assetNumber} value={a.assetNumber}>
                      {a.assetNumber} - {a.model} ({a.type}) [SN: {a.serialNumber}]
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Recipient Employee */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Recipient Employee *
            </label>
            <select
              value={selectedEmployeeCode}
              onChange={(e) => setSelectedEmployeeCode(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {employees.map((emp) => (
                <option key={emp.personalCode} value={emp.personalCode}>
                  {emp.firstName} {emp.lastName} ({emp.personalCode}) — {emp.department} [Mgr: {emp.directManager}]
                </option>
              ))}
            </select>
          </div>

          {/* Handover Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Handover Agreement Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('Permanent')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                  type === 'Permanent'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                Permanent Assignment
              </button>
              <button
                type="button"
                onClick={() => setType('Temporary')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                  type === 'Temporary'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                Temporary Loaner (TEMP)
              </button>
            </div>
          </div>

          {/* Expected Return Date (if Temporary) */}
          {type === 'Temporary' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expected Return Date *
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          )}

          {/* Initial Condition */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dispatched Condition *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCondition(c.value)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
                    condition === c.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Handover Comments */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Handover Comments / Handover eForm Reference
            </label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="e.g. Authorized by eForm EF-2025-0992 for remote work"
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* IT User Attribution */}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50/50 p-2.5 border border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300">
            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              Registered by IT User: <strong>{currentUser.name}</strong> ({currentUser.role})
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!preselectedAsset && availableAssets.length === 0)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Handover'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
