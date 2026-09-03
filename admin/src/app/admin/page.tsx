// admin/src/app/admin/page.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Activity,
  Monitor,
  Server,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

type DashboardData = {
  stats: {
    totalUsers: number;
    activeConnections: number;
    totalDevices: number;
    onlineDevices: number;
    totalNodes: number;
    onlineNodes: number;
    blockedNodes: number;
    approvedNodes: number;
    bannedUsers: number;
    bannedDevices: number;
    securityEvents: number;
  };
  system: {
    adminApi: { ok: boolean; label: string };
    firebase: { ok: boolean; label: string };
    auth: { ok: boolean; label: string };
    nodes: { ok: boolean; label: string; warning?: boolean; testing?: boolean; updatedAt?: string | null };
  };
  recentConnections: Array<{
    id: string;
    email: string | null;
    platform: string;
    nodeName: string | null;
    status: string;
    startedAt: number | null;
    lastSeen: number | null;
  }>;
  generatedAt: number;
};

function formatWhen(ts: number | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/dashboard', { credentials: 'same-origin' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error || 'Failed to load dashboard');
      setData(json);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const s = data?.stats;

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Live overview of Joseph FastVPN infrastructure
          </p>
          {data?.generatedAt && (
            <p className="mt-1 text-xs text-gray-600">
              Updated {formatWhen(data.generatedAt)} · refreshes every 30s
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={loading && !s ? '…' : String(s?.totalUsers ?? 0)}
          description="Firestore accounts"
          icon={<Users size={22} />}
        />
        <StatCard
          title="Active Sessions"
          value={loading && !s ? '…' : String(s?.activeConnections ?? 0)}
          description="Connections with recent heartbeat"
          icon={<Activity size={22} />}
        />
        <StatCard
          title="Devices"
          value={loading && !s ? '…' : String(s?.totalDevices ?? 0)}
          description={
            s ? `${s.onlineDevices} online (5 min)` : 'Registered devices'
          }
          icon={<Monitor size={22} />}
        />
        <StatCard
          title="VPN Nodes"
          value={
            loading && !s
              ? '…'
              : s
              ? `${s.onlineNodes}/${s.totalNodes}`
              : '0'
          }
          description={s ? `${s.approvedNodes} approved · ${s.blockedNodes} blocked` : 'RAM health cache'}
          icon={<Server size={22} />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-[#0b1220] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold text-white">Recent Connections</h2>
              <p className="mt-1 text-sm text-gray-500">Latest reported VPN sessions</p>
            </div>
            <Link
              href="/admin/connections"
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
            >
              View all
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="p-4 sm:p-6">
            {!data?.recentConnections?.length ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-gray-500">
                    <Activity size={22} />
                  </div>
                  <h3 className="font-medium text-gray-300">No connections yet</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Appear when apps call /api/connections/report
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-gray-500">
                      <th className="pb-2 pr-3 font-medium">User</th>
                      <th className="pb-2 pr-3 font-medium">Platform</th>
                      <th className="pb-2 pr-3 font-medium">Node</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentConnections.map((c) => (
                      <tr key={c.id} className="border-b border-white/5">
                        <td className="py-2.5 pr-3">{c.email || '—'}</td>
                        <td className="py-2.5 pr-3 capitalize text-gray-400">{c.platform}</td>
                        <td className="py-2.5 pr-3 text-gray-300">{c.nodeName || '—'}</td>
                        <td className="py-2.5 pr-3">
                          {c.status === 'active' ? (
                            <span className="text-xs text-green-400">Active</span>
                          ) : (
                            <span className="text-xs text-gray-500">Ended</span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs text-gray-500">
                          {formatWhen(c.lastSeen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0b1220]">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <h2 className="font-semibold">System Status</h2>
            <p className="mt-1 text-sm text-gray-500">Live health checks</p>
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <StatusItem
              name="Admin API"
              status={data?.system.adminApi.label || '…'}
              warning={data ? !data.system.adminApi.ok : false}
            />
            <StatusItem
              name="Firebase"
              status={data?.system.firebase.label || '…'}
              warning={data ? !data.system.firebase.ok : false}
            />
            <StatusItem
              name="Authentication"
              status={data?.system.auth.label || '…'}
              warning={data ? !data.system.auth.ok : false}
            />
            <StatusItem
              name="VPN Nodes"
              status={data?.system.nodes.label || '…'}
              warning={data?.system.nodes.warning === true || (data ? !data.system.nodes.ok : false)}
            />
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-[#0b1220]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="font-semibold">Security Overview</h2>
              <p className="text-sm text-gray-500">Bans and audit activity</p>
            </div>
          </div>
          <Link
            href="/admin/security"
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            Open Security
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
          <SecurityStat label="Blocked Users" value={String(s?.bannedUsers ?? (loading ? '…' : 0))} />
          <SecurityStat label="Blocked Devices" value={String(s?.bannedDevices ?? (loading ? '…' : 0))} />
          <SecurityStat label="Security Events" value={String(s?.securityEvents ?? (loading ? '…' : 0))} />
          <SecurityStat label="Blocked Nodes" value={String(s?.blockedNodes ?? (loading ? '…' : 0))} />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-[#0b1220] p-6 transition hover:border-blue-500/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-600">{description}</p>
    </div>
  );
}

function StatusItem({
  name,
  status,
  warning = false,
}: {
  name: string;
  status: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${warning ? 'bg-yellow-500' : 'bg-green-500'}`} />
        <span className="text-sm text-gray-300">{name}</span>
      </div>
      <span className={`max-w-[55%] truncate text-right text-xs ${warning ? 'text-yellow-500' : 'text-green-500'}`}>
        {status}
      </span>
    </div>
  );
}

function SecurityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}