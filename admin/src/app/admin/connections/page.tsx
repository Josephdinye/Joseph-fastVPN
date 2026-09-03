// admin/src/app/admin/connections/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Trash2 } from 'lucide-react';

type Conn = {
  id: string;
  userId: string | null;
  email: string | null;
  deviceId: string | null;
  platform: string;
  nodeId: string | null;
  nodeName: string | null;
  status: 'active' | 'ended';
  startedAt: number | null;
  endedAt: number | null;
  lastSeen: number | null;
  stale?: boolean;
};

function formatWhen(ts: number | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

function formatDuration(start: number | null, end: number | null) {
  if (!start) return '—';
  const ms = (end ?? Date.now()) - start;
  if (ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function ConnectionsPage() {
  const [items, setItems] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [pending, setPending] = useState<Set<string>>(new Set());

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/connections?status=all', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to load connections');
      setItems(data.connections || []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function endSession(id: string) {
    setPending((p) => new Set(p).add(id));
    try {
      const res = await fetch(`/api/connections/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: 'ended' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed');
      toast('Session marked ended');
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  async function removeRow(id: string) {
    if (!confirm('Delete this connection record?')) return;
    setPending((p) => new Set(p).add(id));
    try {
      const res = await fetch(`/api/connections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed');
      toast('Deleted');
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  const filtered = useMemo(() => {
    let list = [...items];
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.email || '').toLowerCase().includes(q) ||
          (c.userId || '').toLowerCase().includes(q) ||
          (c.deviceId || '').toLowerCase().includes(q) ||
          (c.nodeName || '').toLowerCase().includes(q) ||
          (c.nodeId || '').toLowerCase().includes(q) ||
          (c.platform || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search, statusFilter]);

  const activeCount = items.filter((c) => c.status === 'active').length;

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Active and historical VPN sessions reported by clients
          </p>
          <p className="mt-1 text-xs text-gray-600">Auto-refresh every 20s</p>
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
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
          <div className="text-xs text-gray-500">Total shown</div>
          <div className="mt-1 text-2xl font-semibold">{items.length}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
          <div className="text-xs text-gray-500">Active now</div>
          <div className="mt-1 text-2xl font-semibold text-green-400">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
          <div className="text-xs text-gray-500">Ended / stale</div>
          <div className="mt-1 text-2xl font-semibold text-gray-400">
            {items.length - activeCount}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search email, device, node…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'ended')}
          className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
        </select>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading connections…</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-500">
              <Activity size={28} />
            </div>
            <h3 className="font-medium text-gray-300">No connections</h3>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              Sessions appear when apps call{' '}
              <code className="text-gray-400">POST /api/connections/report</code> with
              action connect / heartbeat / disconnect.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">Node</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Duration</th>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-white/5">
                    <td className="py-3 pr-3">
                      <div className="text-sm">{c.email || '—'}</div>
                      <div className="font-mono text-[10px] text-gray-600">
                        {c.userId ? `${c.userId.slice(0, 10)}…` : '—'}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="capitalize text-sm">{c.platform}</div>
                      <div className="font-mono text-[10px] text-gray-600">
                        {c.deviceId ? `${c.deviceId.slice(0, 12)}…` : '—'}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs text-gray-300">
                      {c.nodeName || c.nodeId || '—'}
                    </td>
                    <td className="py-3 pr-3">
                      {c.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {c.stale ? 'Stale' : 'Ended'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {formatDuration(c.startedAt, c.status === 'active' ? null : c.endedAt)}
                    </td>
                    <td className="py-3 pr-3 text-xs text-gray-400">{formatWhen(c.startedAt)}</td>
                    <td className="py-3 pr-3 text-xs text-gray-400">{formatWhen(c.lastSeen)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {c.status === 'active' && (
                          <button
                            disabled={pending.has(c.id)}
                            onClick={() => endSession(c.id)}
                            className="rounded border border-amber-500/40 px-2.5 py-1 text-xs text-amber-400 disabled:opacity-50"
                          >
                            End
                          </button>
                        )}
                        <button
                          disabled={pending.has(c.id)}
                          onClick={() => removeRow(c.id)}
                          className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-400 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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