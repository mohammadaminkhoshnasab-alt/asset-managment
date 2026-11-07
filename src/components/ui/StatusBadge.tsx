import React from 'react';

export type StatusVariant = 'active' | 'in-use' | 'spare' | 'attention' | 'error' | 'neutral';

export interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'md' }) => {
  const normalized = status.toLowerCase();

  let styles = 'bg-[#161a22] text-slate-400 border-[#222938]';
  let dotColor = 'bg-slate-400';

  if (normalized === 'active' || normalized === 'in_use' || normalized === 'in-use') {
    styles = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50';
    dotColor = 'bg-emerald-400 animate-pulse';
  } else if (normalized === 'spare' || normalized === 'available' || normalized === 'in_stock') {
    styles = 'bg-sky-950/60 text-sky-300 border-sky-800/50';
    dotColor = 'bg-sky-400';
  } else if (
    normalized === 'attention' ||
    normalized === 'needs_review' ||
    normalized === 'pending'
  ) {
    styles = 'bg-amber-950/60 text-amber-300 border-amber-800/50';
    dotColor = 'bg-amber-400';
  } else if (
    normalized === 'error' ||
    normalized === 'disposed' ||
    normalized === 'damaged' ||
    normalized === 'locked'
  ) {
    styles = 'bg-rose-950/60 text-rose-300 border-rose-800/50';
    dotColor = 'bg-rose-400';
  }

  const displayText = label || status.replace(/_/g, ' ').toUpperCase();

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1.5' : 'px-2.5 py-1 text-xs gap-2';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border uppercase tracking-wider ${styles} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{displayText}</span>
    </span>
  );
};
