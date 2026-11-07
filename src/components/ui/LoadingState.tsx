import React from 'react';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'INITIALIZING SYSTEM WORKSPACE...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[320px] text-center">
      <div className="relative mb-5">
        <div className="w-12 h-12 rounded-lg border-2 border-[#1f2633] border-t-[#ea8c34] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[#ea8c34] animate-pulse" />
        </div>
      </div>
      <p className="font-mono text-xs tracking-widest text-[#ea8c34] uppercase font-semibold">
        {message}
      </p>
      <p className="text-xs text-slate-500 mt-1.5 font-mono">
        ESTABLISHING AUTHENTICATED SESSION CONTEXT
      </p>
    </div>
  );
};
