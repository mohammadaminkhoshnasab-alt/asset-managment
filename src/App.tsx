/**
 * IT Asset Management System - Frontend Foundation Scaffold (Phase P01)
 * 
 * Minimal neutral application root verifying React 19 + TypeScript initialization.
 * Functional UI, data grids, authentication, and asset workflows are strictly out of scope
 * for Phase P01 and will be introduced in subsequent phases.
 */

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
          IT Asset Management System
        </h1>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Phase P01 — Project Foundation Scaffold
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5 text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Frontend Bootstrap:</span> React 19 + TypeScript (Initialized)
          </div>
          <div>
            <span className="font-medium text-slate-700">Backend Bootstrap:</span> Node.js + Express (Operational)
          </div>
          <div>
            <span className="font-medium text-slate-700">Health Endpoint:</span>{' '}
            <a
              href="/health"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              /health
            </a>
          </div>
          <div>
            <span className="font-medium text-slate-700">Phase Status:</span> Foundation Complete (Scope P01)
          </div>
        </div>
      </div>
    </main>
  );
}
