'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Monitor, RefreshCw, Smartphone, Laptop, Trash2 } from 'lucide-react';

type DeviceRow = {
  id: string;
  deviceId: string;
  userId: string | null;
  email: string | null;
  platform: string;
  appName: string | null;
  appVersion: string | null;
  model: string | null;
  lastSeen: number | null;
  lastNodeId: string | null;
  lastNodeName: string | null;
  createdAt: number | null;
  banned: boolean;
};

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'android' || p === 'ios') {
    return <Smartphone size={16} className="text-sky-400" />;
  }
  return <Laptop size={16} className="text-violet-400" />;
}

function formatWhen(ts: number | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

function isOnline(lastSeen: number | null) {
  if (!lastSeen) return false;
  return Date.now() - lastSeen < 5 * 60 * 1000; // seen in last 5 min
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<'all' | string>('all');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [hideBanned, setHideBanned] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/devices', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to load devices');
      setDevices(data.devices || []);
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

  async function setBanned(id: string, banned: boolean) {
    setPending((p) => new Set(p).add(id));
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ banned }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Update failed');
      toast(banned ? 'Device banned' : 'Device unbanned');
      await load();
    } catch (err: any) {
      toast(err.message || 'Update failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  async function removeDevice(id: string) {
    if (!confirm('Remove this device record from the database?')) return;
    setPending((p) => new Set(p).add(id));
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Delete failed');
      toast('Device removed');
      await load();
    } catch (err: any) {
      toast(err.message || 'Delete failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  const filtered = useMemo(() => {
    let list = [...devices];
    if (platform !== 'all') list = list.filter((d) => d.platform === platform);
    if (onlyOnline) list = list.filter((d) => isOnline(d.lastSeen));
    if (hideBanned) list = list.filter((d) => !d.banned);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          (d.email || '').toLowerCase().includes(q) ||
          (d.deviceId || '').toLowerCase().includes(q) ||
          (d.userId || '').toLowerCase().includes(q) ||
          (d.model || '').toLowerCase().includes(q) ||
          (d.lastNodeName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [devices, search, platform, onlyOnline, hideBanned]);

  const stats = useMemo(() => {
    const online = devices.filter((d) => isOnline(d.lastSeen)).length;
    const banned = devices.filter((d) => d.banned).length;
    return { total: devices.length, online, banned };
  }, [devices]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Registered clients that reported into Joseph FastVPN
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Online = last seen within 5 minutes · auto-refresh every 30s
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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total devices', value: stats.total },
          { label: 'Online now', value: stats.online, color: 'text-green-400' },
          { label: 'Banned', value: stats.banned, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.color || ''}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search email, device ID, node…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm sm:w-72"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm"
        >
          <option value="all">All platforms</option>
          <option value="windows">Windows</option>
          <option value="macos">macOS</option>
          <option value="linux">Linux</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
          <option value="unknown">Unknown</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} />
          Online only
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={hideBanned} onChange={(e) => setHideBanned(e.target.checked)} />
          Hide banned
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading devices…</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-500">
              <Monitor size={28} />
            </div>
            <h3 className="font-medium text-gray-300">No devices yet</h3>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              Devices appear when the Electron, Android, or iOS app calls{' '}
              <code className="text-gray-400">POST /api/devices/register</code> after login.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last node</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2 pr-3">Registered</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const online = isOnline(d.lastSeen);
                  return (
                    <tr
                      key={d.id}
                      className={`border-b border-white/5 ${d.banned ? 'opacity-50' : ''}`}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                            <PlatformIcon platform={d.platform} />
                          </div>
                          <div>
                            <div className="font-medium capitalize">
                              {d.platform}
                              {d.appVersion ? (
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  v{d.appVersion}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-500">
                              {d.model || d.appName || 'Joseph FastVPN'}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-gray-600">
                              {d.deviceId.slice(0, 12)}…
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="text-sm">{d.email || '—'}</div>
                        <div className="font-mono text-[10px] text-gray-600">
                          {d.userId ? `${d.userId.slice(0, 10)}…` : '—'}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        {d.banned ? (
                          <span className="text-xs text-amber-400">Banned</span>
                        ) : online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                            Online
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">Offline</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-gray-300">
                        {d.lastNodeName || d.lastNodeId || '—'}
                      </td>
                      <td className="py-3 pr-3 text-xs text-gray-400">{formatWhen(d.lastSeen)}</td>
                      <td className="py-3 pr-3 text-xs text-gray-500">{formatWhen(d.createdAt)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={pending.has(d.id)}
                            onClick={() => setBanned(d.id, !d.banned)}
                            className={`rounded border px-2.5 py-1 text-xs disabled:opacity-50 ${
                              d.banned
                                ? 'border-green-500/40 text-green-400'
                                : 'border-amber-500/40 text-amber-400'
                            }`}
                          >
                            {d.banned ? 'Unban' : 'Ban'}
                          </button>
                          <button
                            disabled={pending.has(d.id)}
                            onClick={() => removeDevice(d.id)}
                            className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-400 disabled:opacity-50"
                            title="Delete record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {message && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-black/80 px-4 py-2 text-sm text-white">
          {message}
        </div>
      )}
    </div>
  );
}