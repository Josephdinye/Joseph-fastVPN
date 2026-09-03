// admin/src/app/admin/security/page.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  Server,
  RefreshCw,
  Users,
  Monitor,
  ArrowUpRight,
} from 'lucide-react';

type BannedUser = {
  uid: string;
  email: string | null;
  role: string;
  userId: string | null;
  banned: boolean;
  updatedAt: number | null;
};

type BannedDevice = {
  id: string;
  deviceId: string;
  email: string | null;
  platform: string;
  userId: string | null;
  lastSeen: number | null;
  banned: boolean;
};

type Overview = {
  bannedUsersCount: number;
  bannedDevicesCount: number;
  blockedNodesCount: number;
  onlineNodes: number;
  approvedNodes: number;
  totalNodes: number;
  nodesTesting: boolean;
};

export default function SecurityPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [bannedDevices, setBannedDevices] = useState<BannedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/security', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to load security data');
      setOverview(data.overview);
      setBannedUsers(data.bannedUsers || []);
      setBannedDevices(data.bannedDevices || []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function unbanUser(uid: string) {
    setPending((p) => new Set(p).add(`u:${uid}`));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ banned: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to unban user');
      toast('User unbanned');
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(`u:${uid}`);
        return n;
      });
    }
  }

  async function unbanDevice(id: string) {
    setPending((p) => new Set(p).add(`d:${id}`));
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ banned: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to unban device');
      toast('Device unbanned');
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(`d:${id}`);
        return n;
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Control user, device, and VPN node access
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm hover:bg-white/5"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Banned users"
          value={overview?.bannedUsersCount ?? '—'}
          icon={<Users size={18} />}
          tone="amber"
        />
        <SummaryCard
          label="Banned devices"
          value={overview?.bannedDevicesCount ?? '—'}
          icon={<Monitor size={18} />}
          tone="amber"
        />
        <SummaryCard
          label="Blocked nodes"
          value={overview?.blockedNodesCount ?? '—'}
          icon={<Server size={18} />}
          tone="sky"
        />
        <SummaryCard
          label="Online nodes"
          value={
            overview
              ? `${overview.onlineNodes}/${overview.totalNodes}`
              : '—'
          }
          icon={<ShieldCheck size={18} />}
          tone="green"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Banned users */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220]">
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Blocked users</h2>
                <p className="text-xs text-gray-500">Cannot sign in or use the VPN</p>
              </div>
            </div>
            <Link
              href="/admin/users"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              Manage <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="p-4">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
            ) : bannedUsers.length === 0 ? (
              <EmptyState text="No banned users." />
            ) : (
              <ul className="divide-y divide-white/5">
                {bannedUsers.map((u) => (
                  <li
                    key={u.uid}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{u.email || u.uid}</div>
                      <div className="text-xs text-gray-500">
                        {u.role}
                        {u.userId ? ` · ${u.userId}` : ''}
                      </div>
                    </div>
                    <button
                      disabled={pending.has(`u:${u.uid}`)}
                      onClick={() => unbanUser(u.uid)}
                      className="shrink-0 rounded border border-green-500/40 px-2.5 py-1 text-xs text-green-400 disabled:opacity-50"
                    >
                      Unban
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Banned devices */}
        <section className="rounded-2xl border border-white/10 bg-[#0b1220]">
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Blocked devices</h2>
                <p className="text-xs text-gray-500">Cannot register or connect</p>
              </div>
            </div>
            <Link
              href="/admin/devices"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              Manage <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="p-4">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
            ) : bannedDevices.length === 0 ? (
              <EmptyState text="No banned devices." />
            ) : (
              <ul className="divide-y divide-white/5">
                {bannedDevices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium capitalize">
                        {d.platform}
                        {d.email ? ` · ${d.email}` : ''}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {d.deviceId.slice(0, 16)}…
                      </div>
                    </div>
                    <button
                      disabled={pending.has(`d:${d.id}`)}
                      onClick={() => unbanDevice(d.id)}
                      className="shrink-0 rounded border border-green-500/40 px-2.5 py-1 text-xs text-green-400 disabled:opacity-50"
                    >
                      Unban
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Node policy shortcuts */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-[#0b1220] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <Server size={20} />
            </div>
            <div>
              <h2 className="font-semibold">VPN node policy</h2>
              <p className="text-xs text-gray-500">
                {overview
                  ? `${overview.approvedNodes} approved · ${overview.onlineNodes} online · ${overview.blockedNodesCount} blocked from clients`
                  : 'Node health lives in server RAM'}
                {overview?.nodesTesting ? ' · testing…' : ''}
              </p>
            </div>
          </div>
          <Link
            href="/admin/nodes"
            className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500"
          >
            Open VPN Nodes
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      {message && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-black/80 px-4 py-2 text-sm text-white">
          {message}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'amber' | 'sky' | 'green';
}) {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-400',
    sky: 'bg-sky-500/10 text-sky-400',
    green: 'bg-green-500/10 text-green-400',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-gray-600">
      {text}
    </div>
  );
}