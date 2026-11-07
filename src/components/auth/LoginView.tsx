import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Lock, User, ShieldAlert, Terminal, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, errorMessage, togglePreviewMode } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!username.trim() || !password) {
      setLoginError('Both username and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setLoginError(result.error || 'Authentication rejected. Please check your credentials.');
      }
    } catch {
      setLoginError('An unexpected network error occurred while contacting the auth server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background industrial grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(#ea8c34 1px, transparent 1px), radial-gradient(#ffffff 1px, #0a0c10 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />

      {/* Main Login Card */}
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#ea8c34] shadow-lg shadow-amber-500/20 mb-1">
            <span className="font-mono font-black text-slate-950 text-xl leading-none">
              IT
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-wider text-slate-100 uppercase font-mono">
            IT ASSET MANAGEMENT
          </h1>
          <p className="font-mono text-xs text-slate-400 tracking-widest uppercase">
            // RESTRICTED ACCESS // LOCAL ON-PREMISES EDITION
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-xl bg-[#11141c] border border-[#1f2633] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="border-b border-[#1f2633] pb-4">
            <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase font-mono">
              Operator Authentication
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Sign in with your single administrator account to access management workspaces.
            </p>
          </div>

          {/* Error Message Alert */}
          {(loginError || errorMessage) && (
            <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block uppercase tracking-wider font-mono">
                  Access Denied
                </span>
                <p className="leading-relaxed">{loginError || errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Administrator Username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              leftIcon={<User className="w-4 h-4" />}
            />

            <div className="relative">
              <Input
                label="Master Password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="cursor-pointer text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 font-mono tracking-wider"
              isLoading={isSubmitting}
            >
              AUTHENTICATE & ENTER
            </Button>
          </form>

          {/* Provisioning guidance */}
          <div className="pt-4 border-t border-[#1b202a] text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] font-semibold">
              <Terminal className="w-3.5 h-3.5 text-[#ea8c34]" />
              <span>INITIAL SETUP CLI</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              If an administrator account has not been provisioned yet, execute the CLI tool on the
              server host:
            </p>
            <code className="block p-2 rounded bg-[#090b0e] border border-[#1b202a] text-[11px] font-mono text-[#ea8c34]">
              npm run admin:bootstrap
            </code>
          </div>
        </div>

        {/* Preview Inspection Shell Toggle (Allowed by P05 item 5 for environments without live DB) */}
        <div className="p-4 rounded-lg bg-[#0d1016]/80 border border-[#1b202a] text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-slate-400">
            <AlertCircle className="w-3.5 h-3.5 text-[#ea8c34]" />
            <span>AI STUDIO PREVIEW INSPECTION</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            To evaluate the application shell styling and navigation while PostgreSQL is offline:
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={togglePreviewMode}
            className="w-full font-mono text-xs text-[#ea8c34] border-amber-500/30 hover:border-amber-500"
          >
            INSPECT APPLICATION SHELL (PREVIEW ONLY)
          </Button>
        </div>

        {/* Security watermark footer */}
        <div className="text-center font-mono text-[10px] text-slate-400 space-y-1">
          <p>//// IT ASSET MANAGEMENT SYSTEM // AIR-GAPPED SECURITY LEVEL 4</p>
          <p>ZERO EXTERNAL TELEMETRY · NO PUBLIC REGISTRATION</p>
        </div>
      </div>
    </div>
  );
};
