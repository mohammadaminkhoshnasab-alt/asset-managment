import React from 'react';
import { X, Filter, Search, RotateCcw } from 'lucide-react';
import type { GridFilterGroup, GridFilterRule } from '../../types/asset.ts';

interface ActiveFilterSummaryProps {
  searchQuery?: string;
  filters?: GridFilterGroup;
  quickStatus?: string;
  onClearSearch: () => void;
  onClearQuickStatus: () => void;
  onRemoveRule: (field: string, operator: string) => void;
  onClearAll: () => void;
}

export const ActiveFilterSummary: React.FC<ActiveFilterSummaryProps> = ({
  searchQuery,
  filters,
  quickStatus,
  onClearSearch,
  onClearQuickStatus,
  onRemoveRule,
  onClearAll,
}) => {
  // Collect all flat rules
  const rules: GridFilterRule[] = [];

  const extractRules = (group?: GridFilterGroup) => {
    if (!group || !Array.isArray(group.rules)) return;
    for (const item of group.rules) {
      if ('operator' in item && ('AND' === item.operator || 'OR' === item.operator)) {
        extractRules(item as GridFilterGroup);
      } else {
        rules.push(item as GridFilterRule);
      }
    }
  };

  extractRules(filters);

  const hasAnyFilter = Boolean(searchQuery?.trim()) || Boolean(quickStatus) || rules.length > 0;

  if (!hasAnyFilter) {
    return null;
  }

  const formatOperator = (op: string) => {
    switch (op) {
      case 'equals':
        return '=';
      case 'contains':
        return 'contains';
      case 'empty':
        return 'is empty';
      case 'notEmpty':
        return 'is not empty';
      case 'gte':
        return '>=';
      case 'lte':
        return '<=';
      default:
        return op;
    }
  };

  const formatFieldLabel = (field: string) => {
    switch (field) {
      case 'assetNumber':
        return 'Asset #';
      case 'serialNumber':
        return 'Serial #';
      case 'typeId':
        return 'Type';
      case 'locationId':
        return 'Location';
      case 'deviceHealthId':
        return 'Health';
      case 'acOwnerId':
        return 'AC Owner';
      case 'currentUserId':
        return 'Current User';
      case 'costCenter':
        return 'Cost Center';
      default:
        return field.charAt(0).toUpperCase() + field.slice(1);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-[#0d1017] border border-[#1d2330] rounded-md text-xs font-mono">
      <div className="flex items-center gap-1.5 text-slate-400 mr-1">
        <Filter className="w-3.5 h-3.5 text-[#ea8c34]" />
        <span className="uppercase text-[11px] font-semibold text-slate-300">Active Criteria:</span>
      </div>

      {searchQuery && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#181d28] border border-[#273244] text-amber-300">
          <Search className="w-3 h-3 text-amber-400" />
          <span>"{searchQuery}"</span>
          <button
            type="button"
            onClick={onClearSearch}
            className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
            title="Clear search"
            aria-label="Clear search term"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {quickStatus && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#181d28] border border-[#273244] text-sky-300">
          <span>Status: {quickStatus.replace(/_/g, ' ')}</span>
          <button
            type="button"
            onClick={onClearQuickStatus}
            className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
            title="Clear quick status filter"
            aria-label="Clear quick status filter"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {rules.map((rule, idx) => (
        <span
          key={`${rule.field}-${rule.operator}-${idx}`}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#141923] border border-[#222b3b] text-slate-200"
        >
          <span className="text-slate-400">{formatFieldLabel(rule.field)}</span>
          <span className="text-[#ea8c34]">{formatOperator(rule.operator)}</span>
          {rule.value !== undefined && rule.operator !== 'empty' && rule.operator !== 'notEmpty' && (
            <span className="text-white max-w-[120px] truncate" title={String(rule.value)}>
              {Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemoveRule(rule.field, rule.operator)}
            className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
            title="Remove rule"
            aria-label={`Remove filter rule for ${rule.field}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 cursor-pointer transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        <span>CLEAR ALL</span>
      </button>
    </div>
  );
};
