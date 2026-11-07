import React, { useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import type { PersonLookup } from '../../types/asset.ts';
import { UserPlus, AlertCircle, X, ShieldAlert } from 'lucide-react';

interface CreatePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (person: PersonLookup) => void;
  csrfToken: string | null;
  previewMode?: boolean;
}

export const CreatePersonModal: React.FC<CreatePersonModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  csrfToken,
  previewMode = false,
}) => {
  const [fullName, setFullName] = useState('');
  const [personalCode, setPersonalCode] = useState('');
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [email, setEmail] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (previewMode) {
      setError('Preview Mode active: Database writes are disabled.');
      return;
    }

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError('Full Name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const payload = {
        fullName: trimmedName,
        personalCode: personalCode.trim() || null,
        username: username.trim() || null,
        department: department.trim() || null,
        costCenter: costCenter.trim() || null,
        email: email.trim() || null,
      };

      const res = await fetch('/api/people', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 201 && data.data) {
        onSuccess(data.data as PersonLookup);
        onClose();
        return;
      }

      if (res.status === 409) {
        setError(data.error || 'A person with this username or personal code already exists.');
      } else if (res.status === 401) {
        setError('Authentication session expired. Please re-authenticate.');
      } else if (res.status === 403) {
        setError('Security CSRF validation failed. Please reload and try again.');
      } else {
        setError(data.error || `Server returned error (${res.status})`);
      }
    } catch (err: any) {
      setError('Network failure or database offline. Person was not registered.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-person-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-lg bg-[#11141c] border border-[#232b3b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1d2330] flex items-center justify-between bg-[#0d1016]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#181d28] border border-[#262f40] text-[#ea8c34]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <span className="block font-mono text-[10px] tracking-widest text-[#ea8c34] uppercase font-semibold">
                PHASE P06 PERSON IDENTITY HELPER
              </span>
              <h2
                id="create-person-title"
                className="text-sm font-semibold tracking-wide text-slate-100 uppercase"
              >
                Register New Person Record
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#181d28] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Explicit Independent Save Notice */}
          <div className="p-3 rounded bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Separate Database Save:</strong> This person record is committed immediately and
              independently to PostgreSQL. It is <strong>not</strong> rolled back if the asset registration
              is cancelled or fails.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Full Name *"
            id="person-full-name"
            placeholder="e.g. Sarah Jenkins"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Personnel Code"
              id="person-code"
              placeholder="e.g. EMP-1049"
              helperText="Official HR personnel identifier"
              value={personalCode}
              onChange={(e) => setPersonalCode(e.target.value)}
            />

            <Input
              label="System Username"
              id="person-username"
              placeholder="e.g. sjenkins"
              helperText="Active Directory / system login"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Department"
              id="person-dept"
              placeholder="e.g. IT Operations"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />

            <Input
              label="Cost Center"
              id="person-cc"
              placeholder="e.g. CC-3020"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
            />
          </div>

          <Input
            label="Email Address"
            id="person-email"
            type="email"
            placeholder="sjenkins@enterprise.internal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1d2330]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={previewMode}
            >
              {previewMode ? 'Save Disabled (Preview)' : 'Create Person Record'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
