// admin/src/app/admin/nodes/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NodeRow = {
  id: string;
  name: string | null;
  flag: string | null;
  iso: string | null;
  subtitle: string | null;
  countIndex: number | null;
  isRussia: boolean;
  protocol: string;
  status: string;
  ping: number | null;
  score: number | null;
  failReason: string | null;
  lastTestedAt: number | null;
  enabled: boolean;
  rawConfig: string | null;
  transportSecurity?: string | null;
  securityStatus?: string | null;
  securityScore?: number | null;
  securityReasons?: string[] | null;
  host?: string | null;
  port?: number | null;
};

type Stats = {
  total: number;
  online: number;
  offline: number;
  untested: number;
  russia: number;
  blocked: number;
  approved?: number;
  suspicious?: number;
  lastRefresh: number | null;
  testing?: boolean;
  cycle?: number;
};

type SecurityFilter = 'all' | 'approved' | 'suspicious' | 'blocked' | 'pending';
type TransportFilter = 'all' | 'reality' | 'tls' | 'none' | 'unknown';
type SortMode = 'score' | 'latency' | 'name';

function FlagImg({ iso, flag, size = 24 }: { iso: string | null; flag: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const clean = iso && iso.trim().length === 2 ? iso.trim().toLowerCase() : null;

  if (clean && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://flagcdn.com/w40/${clean}.png`}
        alt={clean}
        width={size}
        height={Math.round(size * 0.75)}
        className="rounded-sm shadow-sm"
        style={{ width: size, height: 'auto', display: 'inline-block' }}
        onError={() => setFailed(true)}
      />
    );
  }
  return <span style={{ fontSize: size * 0.85 }}>{flag || '🌐'}</span>;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [excludeRf, setExcludeRf] = useState(true);
  const [hideBlocked, setHideBlocked] = useState(false);
  const [clientSafeOnly, setClientSafeOnly] = useState(false);
  const [securityFilter, setSecurityFilter] = useState<SecurityFilter>('all');
  const [transportFilter, setTransportFilter] = useState<TransportFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshingRef = useRef(false);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const [nodesRes, statsRes] = await Promise.all([
        fetch('/api/nodes?online=0&excludeRf=0', { credentials: 'same-origin' }),
        fetch('/api/nodes/stats', { credentials: 'same-origin' }),
      ]);
      const nodesData = await nodesRes.json();
      const statsData = await statsRes.json();

      if (!nodesRes.ok || !nodesData.success) {
        throw new Error(nodesData?.error || 'Failed to load nodes');
      }
      setNodes(nodesData.nodes || []);
      if (statsRes.ok && statsData.success) setStats(statsData.stats);
    } catch (err: any) {
      if (!silent) setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(
    async (fromAuto = false) => {
      if (refreshingRef.current) return;
      if (!fromAuto && !confirm('Fetch feeds and re-test all nodes?')) return;

      refreshingRef.current = true;
      setRefreshing(true);

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => loadAll(true), 2500);

      try {
        const res = await fetch('/api/nodes/refresh', {
          method: 'POST',
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data?.error || 'Refresh failed');
        toast(data.message || 'Refresh started');
        await loadAll(true);

        setTimeout(() => {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          refreshingRef.current = false;
          setRefreshing(false);
          loadAll(true);
        }, 120000);
      } catch (err: any) {
        if (!fromAuto) toast(err.message || 'Refresh failed');
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        refreshingRef.current = false;
        setRefreshing(false);
      }
    },
    [loadAll, toast]
  );

  useEffect(() => {
    loadAll();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadAll]);

  async function toggleEnabled(id: string, enabled: boolean) {
    setPending((p) => new Set(p).add(id));
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Update failed');
      toast(enabled ? 'Node visible to clients' : 'Node blocked from clients');
      await loadAll(true);
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

  async function bulkSetEnabled(ids: string[], enabled: boolean) {
    if (ids.length === 0) return toast('Nothing selected');
    if (!confirm(`${enabled ? 'Unblock' : 'Block'} ${ids.length} node(s)?`)) return;

    setBulkWorking(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ enabled }),
        });
        const data = await res.json();
        if (res.ok && data.success) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setBulkWorking(false);
    setSelected(new Set());
    toast(`${enabled ? 'Unblocked' : 'Blocked'} ${ok}` + (fail ? ` · ${fail} failed` : ''));
    await loadAll(true);
  }

  async function copyConfig(raw: string | null) {
    if (!raw) return toast('No config');
    try {
      await navigator.clipboard.writeText(raw);
      toast('Config link copied');
    } catch {
      toast('Copy failed');
    }
  }

  function isClientSafe(n: NodeRow) {
    return (
      n.enabled &&
      n.status === 'online' &&
      n.securityStatus === 'approved' &&
      (n.securityScore == null || n.securityScore >= 80)
    );
  }

  const filtered = useMemo(() => {
    let list = [...nodes];

    if (excludeRf) list = list.filter((n) => !n.isRussia);
    if (onlyOnline) list = list.filter((n) => n.status === 'online');
    if (hideBlocked) list = list.filter((n) => n.enabled);
    if (clientSafeOnly) list = list.filter(isClientSafe);
    if (securityFilter !== 'all') {
      list = list.filter((n) => (n.securityStatus || 'pending') === securityFilter);
    }
    if (transportFilter !== 'all') {
      list = list.filter((n) => (n.transportSecurity || 'unknown') === transportFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          (n.name || '').toLowerCase().includes(q) ||
          (n.subtitle || '').toLowerCase().includes(q) ||
          (n.iso || '').toLowerCase().includes(q) ||
          (n.id || '').toLowerCase().includes(q) ||
          (n.host || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortMode === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortMode === 'latency') {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (b.status === 'online' && a.status !== 'online') return 1;
        return (a.ping ?? 99999) - (b.ping ?? 99999);
      }
      // score
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (b.status === 'online' && a.status !== 'online') return 1;
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.ping ?? 99999) - (b.ping ?? 99999);
    });

    return list;
  }, [
    nodes,
    search,
    onlyOnline,
    excludeRf,
    hideBlocked,
    clientSafeOnly,
    securityFilter,
    transportFilter,
    sortMode,
  ]);

  const clientSafeCount = useMemo(() => nodes.filter(isClientSafe).length, [nodes]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((n) => n.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function exportVisible() {
    const payload = filtered.map((n) => ({
      id: n.id,
      name: n.name,
      iso: n.iso,
      status: n.status,
      latency: n.ping,
      score: n.score,
      securityStatus: n.securityStatus,
      transportSecurity: n.transportSecurity,
      enabled: n.enabled,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joseph-nodes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${payload.length} nodes`);
  }

  const offlineIds = useMemo(
    () => filtered.filter((n) => n.status === 'offline' && n.enabled).map((n) => n.id),
    [filtered]
  );
  const russiaIds = useMemo(
    () => filtered.filter((n) => n.isRussia && n.enabled).map((n) => n.id),
    [filtered]
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">VPN Nodes</h1>
          <p className="mt-1 text-xs text-gray-500">
            Control plane: validate · security · TCP health · rank (RAM)
            {stats?.lastRefresh ? ` · last: ${new Date(stats.lastRefresh).toLocaleString()}` : ''}
            {stats?.testing ? ' · testing…' : ''}
            {` · client-safe: ${clientSafeCount}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportVisible}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
          >
            Export visible
          </button>
          <button
            onClick={() => handleRefresh(false)}
            disabled={refreshing}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {refreshing ? 'Testing…' : 'Refresh & Test'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Online', value: stats.online, color: 'text-green-400' },
            { label: 'Offline', value: stats.offline, color: 'text-red-400' },
            { label: 'Blocked', value: stats.blocked, color: 'text-amber-400' },
            { label: 'Approved', value: stats.approved ?? '—' },
            { label: 'Suspicious', value: stats.suspicious ?? '—' },
            { label: 'Client-safe', value: clientSafeCount, color: 'text-sky-300' },
            {
              label: 'Last test',
              value: stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleString() : '—',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className={`mt-1 text-lg font-semibold ${s.color || ''}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search country, id, host…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm"
        />

        <select
          value={securityFilter}
          onChange={(e) => setSecurityFilter(e.target.value as SecurityFilter)}
          className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm"
        >
          <option value="all">Security: all</option>
          <option value="approved">Approved</option>
          <option value="suspicious">Suspicious</option>
          <option value="blocked">Blocked (policy)</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={transportFilter}
          onChange={(e) => setTransportFilter(e.target.value as TransportFilter)}
          className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm"
        >
          <option value="all">Transport: all</option>
          <option value="reality">REALITY</option>
          <option value="tls">TLS</option>
          <option value="none">none</option>
          <option value="unknown">unknown</option>
        </select>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm"
        >
          <option value="score">Sort: score</option>
          <option value="latency">Sort: latency</option>
          <option value="name">Sort: name</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} />
          Online
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={excludeRf} onChange={(e) => setExcludeRf(e.target.checked)} />
          Exclude RF
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={hideBlocked} onChange={(e) => setHideBlocked(e.target.checked)} />
          Hide blocked
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={clientSafeOnly}
            onChange={(e) => setClientSafeOnly(e.target.checked)}
          />
          Client-safe only
        </label>
      </div>

      {/* Bulk actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={selectAllFiltered}
          className="rounded border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/5"
        >
          Select visible ({filtered.length})
        </button>
        <button
          onClick={clearSelection}
          className="rounded border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/5"
        >
          Clear selection
        </button>
        <button
          disabled={bulkWorking || selected.size === 0}
          onClick={() => bulkSetEnabled([...selected], false)}
          className="rounded border border-amber-500/40 px-2.5 py-1.5 text-xs text-amber-400 disabled:opacity-50"
        >
          Block selected ({selected.size})
        </button>
        <button
          disabled={bulkWorking || selected.size === 0}
          onClick={() => bulkSetEnabled([...selected], true)}
          className="rounded border border-green-500/40 px-2.5 py-1.5 text-xs text-green-400 disabled:opacity-50"
        >
          Unblock selected
        </button>
        <button
          disabled={bulkWorking || offlineIds.length === 0}
          onClick={() => bulkSetEnabled(offlineIds, false)}
          className="rounded border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 disabled:opacity-50"
        >
          Block offline in view ({offlineIds.length})
        </button>
        <button
          disabled={bulkWorking || russiaIds.length === 0}
          onClick={() => bulkSetEnabled(russiaIds, false)}
          className="rounded border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 disabled:opacity-50"
        >
          Block Russia in view ({russiaIds.length})
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading nodes…</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            {nodes.length === 0 ? 'No nodes yet. Click Refresh & Test.' : 'No nodes match filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2 pr-2 w-8"></th>
                  <th className="py-2 pr-3">Node</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Security</th>
                  <th className="py-2 pr-3">Latency</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Frontend</th>
                  <th className="py-2 pr-3">Detail</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => (
                  <tr
                    key={`${n.id}-${i}`}
                    className={`border-b border-white/5 ${!n.enabled ? 'opacity-50' : ''}`}
                  >
                    <td className="py-3 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(n.id)}
                        onChange={() => toggleSelect(n.id)}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex w-8 justify-center">
                          <FlagImg iso={n.iso} flag={n.flag} size={24} />
                        </div>
                        <div>
                          <div className="font-medium">
                            {n.name} {n.countIndex != null ? `#${n.countIndex}` : ''}
                            {i < 2 && n.status === 'online' && n.enabled && (
                              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                BEST
                              </span>
                            )}
                            {isClientSafe(n) && (
                              <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-300">
                                SAFE
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {n.subtitle}
                            {n.transportSecurity ? ` · ${n.transportSecurity}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={
                          n.status === 'online'
                            ? 'text-green-400'
                            : n.status === 'offline'
                            ? 'text-red-400'
                            : 'text-gray-500'
                        }
                      >
                        {n.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      <span
                        className={
                          n.securityStatus === 'approved'
                            ? 'text-green-400'
                            : n.securityStatus === 'blocked'
                            ? 'text-red-400'
                            : n.securityStatus === 'suspicious'
                            ? 'text-amber-400'
                            : 'text-gray-500'
                        }
                      >
                        {n.securityStatus || '—'}
                        {n.securityScore != null ? ` (${n.securityScore})` : ''}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {n.ping != null ? `${Math.round(n.ping)} ms` : '—'}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-sky-300">
                      {n.score != null ? n.score : '—'}
                    </td>
                    <td className="py-3 pr-3">
                      {n.enabled ? (
                        <span className="text-xs text-green-400">Visible</span>
                      ) : (
                        <span className="text-xs text-amber-400">Blocked</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 max-w-[180px] text-[10px] text-gray-500 truncate" title={n.failReason || ''}>
                      {n.failReason || (n.securityReasons && n.securityReasons[0]) || '—'}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copyConfig(n.rawConfig)}
                          className="rounded border border-white/15 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/5"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => toggleEnabled(n.id, !n.enabled)}
                          disabled={pending.has(n.id)}
                          className={`rounded border px-2.5 py-1 text-xs disabled:opacity-50 ${
                            n.enabled
                              ? 'border-amber-500/40 text-amber-400'
                              : 'border-green-500/40 text-green-400'
                          }`}
                        >
                          {n.enabled ? 'Block' : 'Unblock'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-gray-500">
              No fake Mbps. Latency is real TCP health. Score = reliability + latency + REALITY/TLS
              policy. Block removes nodes from client-facing lists. Full IP-hiding still needs a
              separate relay gateway.
            </p>
          </div>
        )}
      </div>

      {message && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-black/80 px-4 py-2 text-sm text-white">
          {message}
        </div>
      )}
    </div>
  );
}