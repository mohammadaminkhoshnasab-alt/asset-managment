import React, { useState } from 'react';
import { X, Plus, Trash2, Filter, Layers, Check } from 'lucide-react';
import type { GridFilterGroup, GridFilterRule, GridFilterOperator } from '../../types/asset.ts';
import { Button } from '../ui/Button.tsx';

interface AdvancedFilterBuilderProps {
  isOpen: boolean;
  initialFilters?: GridFilterGroup;
  onApply: (filters?: GridFilterGroup) => boolean | void;
  onClose: () => void;
}

const AVAILABLE_FIELDS = [
  { id: 'status', label: 'Lifecycle Status', type: 'status' },
  { id: 'model', label: 'Model', type: 'text' },
  { id: 'assetNumber', label: 'Asset Number', type: 'text' },
  { id: 'serialNumber', label: 'Serial Number', type: 'text' },
  { id: 'department', label: 'Department', type: 'text' },
  { id: 'costCenter', label: 'Cost Center', type: 'text' },
  { id: 'label', label: 'Label / Tag', type: 'text' },
  { id: 'createdAt', label: 'Created Date', type: 'date' },
  { id: 'updatedAt', label: 'Updated Date', type: 'date' },
];

const OPERATORS_BY_TYPE: Record<string, { id: GridFilterOperator; label: string }[]> = {
  text: [
    { id: 'contains', label: 'contains' },
    { id: 'equals', label: 'equals exactly' },
    { id: 'notEmpty', label: 'is not empty' },
    { id: 'empty', label: 'is empty' },
  ],
  status: [
    { id: 'equals', label: 'equals' },
    { id: 'notEmpty', label: 'is not unknown' },
    { id: 'empty', label: 'is unknown' },
  ],
  date: [
    { id: 'gte', label: 'on or after (>=)' },
    { id: 'lte', label: 'on or before (<=)' },
    { id: 'equals', label: 'exact date (=)' },
  ],
};

export const AdvancedFilterBuilder: React.FC<AdvancedFilterBuilderProps> = ({
  isOpen,
  initialFilters,
  onApply,
  onClose,
}) => {
  const [rootGroup, setRootGroup] = useState<GridFilterGroup>(() => {
    if (initialFilters && Array.isArray(initialFilters.rules) && initialFilters.rules.length > 0) {
      return JSON.parse(JSON.stringify(initialFilters));
    }
    return {
      operator: 'AND',
      rules: [{ field: 'status', operator: 'equals', value: 'IN_USE' }],
    };
  });

  if (!isOpen) return null;

  const handleRootOperatorChange = (op: 'AND' | 'OR') => {
    setRootGroup((prev) => ({ ...prev, operator: op }));
  };

  const handleAddRule = () => {
    setRootGroup((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        { field: 'model', operator: 'contains', value: '' },
      ],
    }));
  };

  const handleAddSubGroup = () => {
    setRootGroup((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          operator: prev.operator === 'AND' ? 'OR' : 'AND',
          rules: [{ field: 'status', operator: 'equals', value: 'SPARE' }],
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setRootGroup((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const handleRuleChange = (
    index: number,
    field: string,
    operator: GridFilterOperator,
    value: any
  ) => {
    setRootGroup((prev) => {
      const updated = [...prev.rules];
      updated[index] = { field, operator, value };
      return { ...prev, rules: updated };
    });
  };

  const handleSubGroupOperatorChange = (groupIndex: number, op: 'AND' | 'OR') => {
    setRootGroup((prev) => {
      const updated = [...prev.rules];
      const child = updated[groupIndex] as GridFilterGroup;
      updated[groupIndex] = { ...child, operator: op };
      return { ...prev, rules: updated };
    });
  };

  const handleAddSubGroupRule = (groupIndex: number) => {
    setRootGroup((prev) => {
      const updated = [...prev.rules];
      const child = updated[groupIndex] as GridFilterGroup;
      updated[groupIndex] = {
        ...child,
        rules: [...child.rules, { field: 'model', operator: 'contains', value: '' }],
      };
      return { ...prev, rules: updated };
    });
  };

  const handleRemoveSubGroupRule = (groupIndex: number, ruleIndex: number) => {
    setRootGroup((prev) => {
      const updated = [...prev.rules];
      const child = updated[groupIndex] as GridFilterGroup;
      const childRules = child.rules.filter((_, i) => i !== ruleIndex);
      if (childRules.length === 0) {
        // remove empty sub group
        return { ...prev, rules: updated.filter((_, i) => i !== groupIndex) };
      }
      updated[groupIndex] = { ...child, rules: childRules };
      return { ...prev, rules: updated };
    });
  };

  const handleSubGroupRuleChange = (
    groupIndex: number,
    ruleIndex: number,
    field: string,
    operator: GridFilterOperator,
    value: any
  ) => {
    setRootGroup((prev) => {
      const updated = [...prev.rules];
      const child = updated[groupIndex] as GridFilterGroup;
      const childRules = [...child.rules];
      childRules[ruleIndex] = { field, operator, value };
      updated[groupIndex] = { ...child, rules: childRules };
      return { ...prev, rules: updated };
    });
  };

  const handleApply = () => {
    // Clean empty values for operators that require values
    const cleanGroup = (group: GridFilterGroup): GridFilterGroup | null => {
      const cleanedRules = group.rules
        .map((r) => {
          if ('operator' in r && ('AND' === r.operator || 'OR' === r.operator)) {
            return cleanGroup(r as GridFilterGroup);
          }
          const rule = r as GridFilterRule;
          if (rule.operator === 'empty' || rule.operator === 'notEmpty') {
            return rule;
          }
          if (rule.value === undefined || rule.value === null || String(rule.value).trim() === '') {
            return null;
          }
          return rule;
        })
        .filter((r): r is GridFilterRule | GridFilterGroup => r !== null);

      if (cleanedRules.length === 0) return null;
      return { operator: group.operator, rules: cleanedRules };
    };

    const finalGroup = cleanGroup(rootGroup);
    const result = onApply(finalGroup || undefined);
    if (result !== false) {
      onClose();
    }
  };

  const handleReset = () => {
    setRootGroup({
      operator: 'AND',
      rules: [],
    });
    const result = onApply(undefined);
    if (result !== false) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Advanced Filter Builder"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-[#0f1219] border border-[#273244] rounded-lg shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1d2330] bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-[#1c2333] border border-[#29354a] text-[#ea8c34]">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase font-mono">
                Advanced Filter Builder
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Construct grouped Boolean criteria with server-side AND/OR execution.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded bg-[#181d28] border border-[#262f40] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 font-mono text-xs">
          {/* Root Group Operator Selector */}
          <div className="flex items-center justify-between p-3 rounded bg-[#141822] border border-[#222b3b]">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold uppercase text-[11px]">Match:</span>
              <div className="flex rounded border border-[#2d374a] overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleRootOperatorChange('AND')}
                  className={`px-3 py-1 cursor-pointer transition-colors ${
                    rootGroup.operator === 'AND'
                      ? 'bg-[#ea8c34] text-slate-950 font-bold'
                      : 'bg-[#181f2c] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ALL conditions (AND)
                </button>
                <button
                  type="button"
                  onClick={() => handleRootOperatorChange('OR')}
                  className={`px-3 py-1 cursor-pointer transition-colors ${
                    rootGroup.operator === 'OR'
                      ? 'bg-[#ea8c34] text-slate-950 font-bold'
                      : 'bg-[#181f2c] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ANY condition (OR)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRule}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a2230] hover:bg-[#232d40] border border-[#2d3a52] text-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Rule</span>
              </button>
              <button
                type="button"
                onClick={handleAddSubGroup}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a2230] hover:bg-[#232d40] border border-[#2d3a52] text-slate-200 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Add Sub-Group</span>
              </button>
            </div>
          </div>

          {/* Rules List */}
          {rootGroup.rules.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#222b3b] rounded-lg text-slate-400">
              No filter rules currently defined. Click "Add Rule" or "Add Sub-Group" to begin.
            </div>
          ) : (
            <div className="space-y-3">
              {rootGroup.rules.map((item, idx) => {
                const isGroup =
                  'operator' in item && ('AND' === item.operator || 'OR' === item.operator);

                if (isGroup) {
                  const subGroup = item as GridFilterGroup;
                  return (
                    <div
                      key={`subgroup-${idx}`}
                      className="p-4 rounded-lg bg-[#0b0e14] border-l-4 border-l-sky-500 border border-[#202838] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sky-400 font-semibold text-[11px] uppercase">
                            Nested Group:
                          </span>
                          <div className="flex rounded border border-[#2d374a] overflow-hidden text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleSubGroupOperatorChange(idx, 'AND')}
                              className={`px-2 py-0.5 cursor-pointer ${
                                subGroup.operator === 'AND'
                                  ? 'bg-sky-600 text-white font-bold'
                                  : 'bg-[#181f2c] text-slate-400'
                              }`}
                            >
                              AND
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubGroupOperatorChange(idx, 'OR')}
                              className={`px-2 py-0.5 cursor-pointer ${
                                subGroup.operator === 'OR'
                                  ? 'bg-sky-600 text-white font-bold'
                                  : 'bg-[#181f2c] text-slate-400'
                              }`}
                            >
                              OR
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddSubGroupRule(idx)}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#18202c] text-slate-300 border border-[#2b3648] hover:bg-[#202a3a] cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-emerald-400" />
                            <span>Add Condition</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            title="Delete Sub-Group"
                            aria-label="Delete Sub-Group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 pl-2">
                        {subGroup.rules.map((childRule, ruleIdx) => {
                          const r = childRule as GridFilterRule;
                          const fieldDef =
                            AVAILABLE_FIELDS.find((f) => f.id === r.field) || AVAILABLE_FIELDS[0];
                          const ops = OPERATORS_BY_TYPE[fieldDef.type] || OPERATORS_BY_TYPE.text;

                          return (
                            <div
                              key={`child-${idx}-${ruleIdx}`}
                              className="flex flex-wrap items-center gap-2 p-2 rounded bg-[#121620] border border-[#1b2230]"
                            >
                              <select
                                value={r.field}
                                onChange={(e) => {
                                  const newField = e.target.value;
                                  const def =
                                    AVAILABLE_FIELDS.find((f) => f.id === newField) ||
                                    AVAILABLE_FIELDS[0];
                                  const defaultOp = (
                                    OPERATORS_BY_TYPE[def.type] || OPERATORS_BY_TYPE.text
                                  )[0].id;
                                  handleSubGroupRuleChange(
                                    idx,
                                    ruleIdx,
                                    newField,
                                    defaultOp,
                                    def.type === 'status' ? 'IN_USE' : ''
                                  );
                                }}
                                className="bg-[#181d28] border border-[#2b3548] text-slate-200 px-2 py-1 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                              >
                                {AVAILABLE_FIELDS.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={r.operator}
                                onChange={(e) =>
                                  handleSubGroupRuleChange(
                                    idx,
                                    ruleIdx,
                                    r.field,
                                    e.target.value as GridFilterOperator,
                                    r.value
                                  )
                                }
                                className="bg-[#181d28] border border-[#2b3548] text-amber-300 px-2 py-1 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                              >
                                {ops.map((op) => (
                                  <option key={op.id} value={op.id}>
                                    {op.label}
                                  </option>
                                ))}
                              </select>

                              {r.operator !== 'empty' && r.operator !== 'notEmpty' && (
                                <>
                                  {fieldDef.type === 'status' ? (
                                    <select
                                      value={r.value || 'IN_USE'}
                                      onChange={(e) =>
                                        handleSubGroupRuleChange(
                                          idx,
                                          ruleIdx,
                                          r.field,
                                          r.operator,
                                          e.target.value
                                        )
                                      }
                                      className="bg-[#181d28] border border-[#2b3548] text-slate-200 px-2 py-1 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                                    >
                                      <option value="IN_USE">IN_USE</option>
                                      <option value="SPARE">SPARE</option>
                                      <option value="DISPOSED">DISPOSED</option>
                                      <option value="UNKNOWN">UNKNOWN</option>
                                    </select>
                                  ) : fieldDef.type === 'date' ? (
                                    <input
                                      type="date"
                                      value={r.value ? String(r.value).slice(0, 10) : ''}
                                      onChange={(e) =>
                                        handleSubGroupRuleChange(
                                          idx,
                                          ruleIdx,
                                          r.field,
                                          r.operator,
                                          e.target.value
                                        )
                                      }
                                      className="bg-[#181d28] border border-[#2b3548] text-slate-200 px-2 py-1 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={r.value || ''}
                                      placeholder="Value..."
                                      onChange={(e) =>
                                        handleSubGroupRuleChange(
                                          idx,
                                          ruleIdx,
                                          r.field,
                                          r.operator,
                                          e.target.value
                                        )
                                      }
                                      className="bg-[#181d28] border border-[#2b3548] text-slate-200 px-2 py-1 rounded text-xs flex-1 min-w-[120px] focus:border-[#ea8c34] focus:outline-none"
                                    />
                                  )}
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveSubGroupRule(idx, ruleIdx)}
                                className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer ml-auto"
                                title="Remove condition"
                                aria-label="Remove condition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Top-level Rule
                const rule = item as GridFilterRule;
                const fieldDef =
                  AVAILABLE_FIELDS.find((f) => f.id === rule.field) || AVAILABLE_FIELDS[0];
                const ops = OPERATORS_BY_TYPE[fieldDef.type] || OPERATORS_BY_TYPE.text;

                return (
                  <div
                    key={`rule-${idx}`}
                    className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#141822] border border-[#202838]"
                  >
                    <select
                      value={rule.field}
                      onChange={(e) => {
                        const newField = e.target.value;
                        const def =
                          AVAILABLE_FIELDS.find((f) => f.id === newField) || AVAILABLE_FIELDS[0];
                        const defaultOp = (
                          OPERATORS_BY_TYPE[def.type] || OPERATORS_BY_TYPE.text
                        )[0].id;
                        handleRuleChange(
                          idx,
                          newField,
                          defaultOp,
                          def.type === 'status' ? 'IN_USE' : ''
                        );
                      }}
                      className="bg-[#1a202c] border border-[#2b3548] text-slate-200 px-2.5 py-1.5 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                    >
                      {AVAILABLE_FIELDS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={rule.operator}
                      onChange={(e) =>
                        handleRuleChange(
                          idx,
                          rule.field,
                          e.target.value as GridFilterOperator,
                          rule.value
                        )
                      }
                      className="bg-[#1a202c] border border-[#2b3548] text-amber-300 px-2.5 py-1.5 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                    >
                      {ops.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {rule.operator !== 'empty' && rule.operator !== 'notEmpty' && (
                      <>
                        {fieldDef.type === 'status' ? (
                          <select
                            value={rule.value || 'IN_USE'}
                            onChange={(e) =>
                              handleRuleChange(idx, rule.field, rule.operator, e.target.value)
                            }
                            className="bg-[#1a202c] border border-[#2b3548] text-slate-200 px-2.5 py-1.5 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                          >
                            <option value="IN_USE">IN_USE</option>
                            <option value="SPARE">SPARE</option>
                            <option value="DISPOSED">DISPOSED</option>
                            <option value="UNKNOWN">UNKNOWN</option>
                          </select>
                        ) : fieldDef.type === 'date' ? (
                          <input
                            type="date"
                            value={rule.value ? String(rule.value).slice(0, 10) : ''}
                            onChange={(e) =>
                              handleRuleChange(idx, rule.field, rule.operator, e.target.value)
                            }
                            className="bg-[#1a202c] border border-[#2b3548] text-slate-200 px-2.5 py-1.5 rounded text-xs focus:border-[#ea8c34] focus:outline-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={rule.value || ''}
                            placeholder="Search value..."
                            onChange={(e) =>
                              handleRuleChange(idx, rule.field, rule.operator, e.target.value)
                            }
                            className="bg-[#1a202c] border border-[#2b3548] text-slate-200 px-2.5 py-1.5 rounded text-xs flex-1 min-w-[140px] focus:border-[#ea8c34] focus:outline-none"
                          />
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-400 p-1.5 cursor-pointer ml-auto"
                      title="Delete rule"
                      aria-label="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1d2330] bg-[#141822]">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            RESET FILTERS
          </Button>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              CANCEL
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply} leftIcon={<Check className="w-4 h-4" />}>
              APPLY CRITERIA
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
