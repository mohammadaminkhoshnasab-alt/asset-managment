import React from 'react';

export interface PanelProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  systemTag?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  icon,
  headerAction,
  children,
  className = '',
  systemTag,
}) => {
  return (
    <div
      className={`rounded-lg bg-[#11141c] border border-[#1d2330] overflow-hidden shadow-lg ${className}`}
    >
      {(title || systemTag || headerAction) && (
        <div className="px-5 py-4 border-b border-[#1d2330] flex flex-wrap items-center justify-between gap-3 bg-[#0d1016]/40">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-1.5 rounded bg-[#181d28] border border-[#262f40] text-[#ea8c34]">
                {icon}
              </div>
            )}
            <div>
              {systemTag && (
                <span className="block font-mono text-[10px] tracking-widest text-[#ea8c34] uppercase font-semibold">
                  {systemTag}
                </span>
              )}
              {title && (
                <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
                  {title}
                </h3>
              )}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
