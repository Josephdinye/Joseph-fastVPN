// admin/src/app/admin/logs/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';

type LogRow = {
  id: string;
  type: string;
  level: 'info' | 'warn' | 'error' | string;
  message: string;
  actorUid: string | null;
  actorEmail: string | null;
  targetUid: string | null;
  targetEmail: string | null;
  meta: Record<string, unknown> | null;
  createdAt: number | null;
};

function formatWhen(ts: number | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

function LevelBadge({ level }: { level: string }) {
  const l = level || 'info';
  const cls =
    l === 'error'
      ? 'bg-red-500/15 text-red-400'
      : l === 'warn'
      ? 'bg-amber-500/15 text-amber-400'
      : 'bg-sky-500/15 text-sky-300';
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {l}
    </span>
  );
}

export default function SecurityLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/security-logs?limit=300', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to load logs');
      setLogs(data.logs || []);
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

  async function clearOld() {
    if (!confirm('Delete security logs older than 30 days?')) return;
    try {
      const res = await fetch('/api/security-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ olderThanDays: 30 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed');
      toast(`Deleted ${data.deleted} old logs`);
      await load();
    } catch (err: any) {
      toast(err.message || 'Failed');
    }
  }

  const filtered = useMemo(() => {
    let list = [...logs];
    if (level !== 'all') list = list.filter((l) => l.level === level);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          (l.message || '').toLowerCase().includes(q) ||
          (l.type || '').toLowerCase().includes(q) ||
          (l.actorEmail || '').toLowerCase().includes(q) ||
          (l.targetEmail || '').toLowerCase().includes(q) ||
          (l.actorUid || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, search, level]);

  const counts = useMemo(() => {
    return {
      total: logs.length,
      warn: logs.filter((l) => l.level === 'warn').length,
      error: logs.filter((l) => l.level === 'error').length,
    };
  }, [logs]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Authentication, bans, and other security events
          </p>
          <p className="mt-1 text-xs text-gray-600">Auto-refresh every 30s</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={clearOld}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-400 hover:bg-white/5"
          >
            Clear 30d+
          </button>
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
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
          <div className="text-xs text-gray-500">Loaded</div>
          <div className="mt-1 text-2xl font-semibold">{counts.total}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
          <div className="text-xs text-gray-500">Warnings</div>
          <div className="mt-1 text-2xl font-semibold text-amber-400">{counts.warn}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
          <div className="text-xs text-gray-500">Errors</div>
          <div className="mt-1 text-2xl font-semibold text-red-400">{counts.error}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search message, type, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as any)}
          className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm"
        >
          <option value="all">All levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-4 sm:p-6">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading logs…</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-500">
              <FileText size={28} />
            </div>
            <h3 className="font-medium text-gray-300">No security events</h3>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              Events appear when APIs call <code className="text-gray-400">writeSecurityLog()</code>
              (login, bans, failed auth, etc.).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Level</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Message</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Target</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-white/5">
                    <td className="py-3 pr-3 whitespace-nowrap text-xs text-gray-400">
                      {formatWhen(l.createdAt)}
                    </td>
                    <td className="py-3 pr-3">
                      <LevelBadge level={l.level} />
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-gray-300">{l.type}</td>
                    <td className="py-3 pr-3 text-sm text-gray-200">{l.message}</td>
                    <td className="py-3 pr-3 text-xs text-gray-400">
                      {l.actorEmail || (l.actorUid ? `${l.actorUid.slice(0, 8)}…` : '—')}
                    </td>
                    <td className="py-3 pr-3 text-xs text-gray-400">
                      {l.targetEmail || (l.targetUid ? `${l.targetUid.slice(0, 8)}…` : '—')}
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