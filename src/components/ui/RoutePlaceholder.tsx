import React from 'react';
import type { NavItemConfig } from '../../types/navigation.ts';
import { Panel } from './Panel.tsx';
import { Layers, ShieldCheck, Terminal } from 'lucide-react';

export const RoutePlaceholder: React.FC<{ item: NavItemConfig }> = ({ item }) => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-[#1d2330] pb-5">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[#ea8c34] uppercase tracking-wider">
            {item.targetPhase}
          </span>
          <span className="font-mono text-xs text-slate-500">
            // WORKSPACE ID: {item.id.toUpperCase()}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 uppercase font-mono">
          {item.label}
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">{item.description}</p>
      </div>

      <Panel
        systemTag="PHASE BOUNDARY SPECIFICATION"
        title="WORKSPACE DEFERRED TO DESIGNATED ROADMAP PHASE"
        icon={<Layers className="w-4 h-4" />}
      >
        <div className="space-y-4 text-sm text-slate-300">
          <div className="p-4 rounded-md bg-[#0a0c10] border border-[#1f2633] font-mono text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Terminal className="w-4 h-4" />
              <span>STATUS: SCOPE GATE ENFORCED (PHASE P05)</span>
            </div>
            <p className="leading-relaxed">
              This route placeholder represents the active architectural boundary of Phase P05
              (Application Shell & Design System). No fake demo records, simulated counts, or
              premature mock forms are generated.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-md bg-[#0d1016] border border-[#1d2330]">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-200 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>BACKEND PREREQUISITES READY</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Core database models (P02), single-admin authentication (P03), and transactional
                audit APIs (P04) are fully functional and ready for integration.
              </p>
            </div>

            <div className="p-4 rounded-md bg-[#0d1016] border border-[#1d2330]">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-200 mb-2">
                <Layers className="w-4 h-4 text-[#ea8c34]" />
                <span>UPCOMING ROADMAP TARGET</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scheduled for full interactive implementation in{' '}
                <strong className="text-slate-200">{item.targetPhase}</strong> following explicit
                user approval.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};
