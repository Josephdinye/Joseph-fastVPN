'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  Shield,
  Users,
  Server,
  Mail,
  Wrench,
} from 'lucide-react';

type AppSettings = {
  vpnServiceName: string;
  maxDevicesPerUser: number;
  maintenanceMode: boolean;
  allowUserRegistration: boolean;
  excludeRussiaByDefault: boolean;
  supportEmail: string;
  supportUrl: string;
  sessionNote: string;
  updatedAt: number | null;
  updatedBy: string | null;
};

const EMPTY: AppSettings = {
  vpnServiceName: 'Joseph FastVPN',
  maxDevicesPerUser: 3,
  maintenanceMode: false,
  allowUserRegistration: true,
  excludeRussiaByDefault: true,
  supportEmail: '',
  supportUrl: '',
  sessionNote: '',
  updatedAt: null,
  updatedBy: null,
};

export default function SettingsPage() {
  const [form, setForm] = useState<AppSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/settings', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to load settings');
      setForm({ ...EMPTY, ...data.settings });
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          vpnServiceName: form.vpnServiceName,
          maxDevicesPerUser: Number(form.maxDevicesPerUser),
          maintenanceMode: form.maintenanceMode,
          allowUserRegistration: form.allowUserRegistration,
          excludeRussiaByDefault: form.excludeRussiaByDefault,
          supportEmail: form.supportEmail,
          supportUrl: form.supportUrl,
          sessionNote: form.sessionNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Save failed');
      setForm({ ...EMPTY, ...data.settings });
      toast('Settings saved');
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px] py-20 text-center text-gray-500">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Configure Joseph FastVPN administration and product defaults
          </p>
          {form.updatedAt && (
            <p className="mt-1 text-xs text-gray-600">
              Last saved {new Date(form.updatedAt).toLocaleString()}
              {form.updatedBy ? ` · ${form.updatedBy}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
          >
            <RefreshCw size={16} />
            Reload
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* General */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
          <SectionHeader
            icon={<Settings size={20} />}
            title="General"
            description="Brand name shown in admin and client apps"
            tone="blue"
          />
          <div className="mt-6 space-y-5">
            <Field label="VPN service name">
              <input
                value={form.vpnServiceName}
                onChange={(e) => patch('vpnServiceName', e.target.value)}
                className="field-input"
                maxLength={80}
              />
            </Field>
            <Field label="Session / status note (optional)">
              <textarea
                value={form.sessionNote}
                onChange={(e) => patch('sessionNote', e.target.value)}
                rows={3}
                placeholder="Shown to admins or clients if you wire it in the apps"
                className="field-input resize-y"
                maxLength={500}
              />
            </Field>
          </div>
        </section>

        {/* Access */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
          <SectionHeader
            icon={<Users size={20} />}
            title="Access & devices"
            description="Limits for accounts and registrations"
            tone="violet"
          />
          <div className="mt-6 space-y-5">
            <Field label="Maximum devices per user">
              <input
                type="number"
                min={1}
                max={20}
                value={form.maxDevicesPerUser}
                onChange={(e) => patch('maxDevicesPerUser', Number(e.target.value))}
                className="field-input max-w-[200px]"
              />
              <p className="mt-1.5 text-xs text-gray-600">
                Enforce this in device register API (1–20).
              </p>
            </Field>

            <Toggle
              label="Allow user registration"
              description="When off, new self-serve signups should be rejected by your apps"
              checked={form.allowUserRegistration}
              onChange={(v) => patch('allowUserRegistration', v)}
            />
          </div>
        </section>

        {/* Network policy */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
          <SectionHeader
            icon={<Server size={20} />}
            title="Network defaults"
            description="Defaults for node lists served to clients"
            tone="sky"
          />
          <div className="mt-6 space-y-5">
            <Toggle
              label="Exclude Russia nodes by default"
              description="Client APIs can respect this flag when filtering nodes"
              checked={form.excludeRussiaByDefault}
              onChange={(v) => patch('excludeRussiaByDefault', v)}
            />
          </div>
        </section>

        {/* Maintenance */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
          <SectionHeader
            icon={<Wrench size={20} />}
            title="Maintenance"
            description="Global kill switch for client access"
            tone="amber"
          />
          <div className="mt-6">
            <Toggle
              label="Maintenance mode"
              description="When enabled, apps should refuse new VPN connects and show a message"
              checked={form.maintenanceMode}
              onChange={(v) => patch('maintenanceMode', v)}
              danger
            />
          </div>
        </section>

        {/* Support */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
          <SectionHeader
            icon={<Mail size={20} />}
            title="Support"
            description="Contact channels for users"
            tone="green"
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Support email">
              <input
                type="email"
                value={form.supportEmail}
                onChange={(e) => patch('supportEmail', e.target.value)}
                placeholder="support@example.com"
                className="field-input"
              />
            </Field>
            <Field label="Support URL">
              <input
                type="url"
                value={form.supportUrl}
                onChange={(e) => patch('supportUrl', e.target.value)}
                placeholder="https://…"
                className="field-input"
              />
            </Field>
          </div>
        </section>

        {/* Read-only env hints */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
          <SectionHeader
            icon={<Shield size={20} />}
            title="Environment (read-only)"
            description="Configured in .env.local — not stored in Firestore"
            tone="gray"
          />
          <div className="mt-4 grid gap-3 text-sm text-gray-400 sm:grid-cols-2">
            <EnvHint label="NODE_ENV" value={process.env.NODE_ENV || '—'} />
            <EnvHint
              label="Feed / node worker"
              value="DEFAULT_FEED_URLS + NODE_TEST_* in .env.local"
            />
          </div>
        </section>

        <div className="flex justify-end pb-8">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .field-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.25);
          padding: 0.75rem 1rem;
          color: white;
          outline: none;
        }
        .field-input:focus {
          border-color: rgba(59, 130, 246, 0.5);
        }
      `}</style>

      {message && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-black/80 px-4 py-2 text-sm text-white">
          {message}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: 'blue' | 'violet' | 'sky' | 'amber' | 'green' | 'gray';
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    violet: 'bg-violet-500/10 text-violet-400',
    sky: 'bg-sky-500/10 text-sky-400',
    amber: 'bg-amber-500/10 text-amber-400',
    green: 'bg-green-500/10 text-green-400',
    gray: 'bg-white/5 text-gray-400',
  };
  return (
    <div className="flex items-center gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
        {icon}
      </div>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div>
        <div className={`text-sm font-medium ${danger && checked ? 'text-amber-300' : ''}`}>
          {label}
        </div>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? (danger ? 'bg-amber-500' : 'bg-blue-600') : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

function EnvHint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="mt-1 font-mono text-xs text-gray-400">{value}</div>
    </div>
  );
}