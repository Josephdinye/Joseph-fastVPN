'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NodeRow = {
  id: string; name: string | null; flag: string | null; iso: string | null;
  subtitle: string | null; countIndex: number | null; isRussia: boolean;
  protocol: string; status: string; ping: number | null; score: number | null;
  failReason: string | null; lastTestedAt: number | null; enabled: boolean;
  rawConfig: string | null; transportSecurity?: string | null;
  securityStatus?: string | null; securityScore?: number | null;
  securityReasons?: string[] | null; host?: string | null; port?: number | null;
};
type Stats = { total: number; online: number; offline: number; untested: number; blocked: number; enabled?: number; lastRefresh: number | null; testing?: boolean; };

function FlagImg({ iso, flag }: { iso: string | null; flag: string | null }) {
  const [fail, setFail] = useState(false);
  const code = iso?.toLowerCase();
  if (code && code.length === 2 && !fail) {
    return <img src={`https://flagcdn.com/w40/${code}.png`} alt={code} width={22} height={16} className="rounded-sm" onError={() => setFail(true)} />;
  }
  return <span className="text-">{flag || '🌐'}</span>;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [hideBlocked, setHideBlocked] = useState(false);
  const [securityFilter, setSecurityFilter] = useState('all');
  const [transportFilter, setTransportFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  const toast = useCallback((m: string) => { setMessage(m); setTimeout(() => setMessage(null), 3000); }, []);

  const loadAll = useCallback(async () => {
    try {
      const [nr, sr] = await Promise.all([
        fetch('/api/nodes?online=0&excludeRf=0', { credentials: 'same-origin' }),
        fetch('/api/nodes/stats', { credentials: 'same-origin' }),
      ]);
      const nd = await nr.json(); const sd = await sr.json();
      if (nd.success) setNodes(nd.nodes); if (sd.success) setStats(sd.stats);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    if (!confirm('Refresh nodes from source? This will update the list.')) return;
    setRefreshing(true);
    pollRef.current = setInterval(() => loadAll(), 2500);
    await fetch('/api/nodes/refresh', { method: 'POST', credentials: 'same-origin' });
    toast('Refresh started...');
    setTimeout(() => { clearInterval(pollRef.current); setRefreshing(false); loadAll(); }, 8000);
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    setPending(p => new Set(p).add(id));
    await fetch(`/api/nodes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ enabled })
    });
    await loadAll();
    setPending(p => { const n = new Set(p); n.delete(id); return n; });
  };

  const bulkSet = async (ids: string[], enabled: boolean) => {
    for (const id of ids) {
      await fetch(`/api/nodes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ enabled })
      });
    }
    setSelected(new Set()); await loadAll();
    toast(`${enabled ? 'Enabled' : 'Blocked'} ${ids.length} nodes`);
  };

  const filtered = useMemo(() => {
    let list = [...nodes];
    if (onlyOnline) list = list.filter(n => n.status === 'online');
    if (hideBlocked) list = list.filter(n => n.enabled);
    if (securityFilter !== 'all') list = list.filter(n => n.securityStatus === securityFilter);
    if (transportFilter !== 'all') list = list.filter(n => n.transportSecurity === transportFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(n => (n.name||'').toLowerCase().includes(q) || (n.host||'').toLowerCase().includes(q) || (n.iso||'').toLowerCase().includes(q));
    }
    return list.sort((a,b) => (a.enabled===b.enabled ? (a.ping??9999)-(b.ping??9999) : a.enabled ? -1 : 1));
  }, [nodes, search, onlyOnline, hideBlocked, securityFilter, transportFilter]);

  return (
    <div className="min-h-screen bg-[#080a12] px-8 py-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text- font-semibold text-white">VPN Nodes</h1>
          <p className="text- text-zinc-500 mt-1">{stats ? `${stats.total} total • ${stats.enabled ?? 0} active • ${stats.blocked} blocked • Updated ${stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleTimeString() : 'now'}` : 'Loading...'}</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="h-9 px-4 rounded-lg bg-white text-black text- font-medium">{refreshing ? 'Refreshing...' : 'Refresh nodes'}</button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5 max-w-">
        <div className="rounded-xl border border-white/10 bg-[#101725] p-4"><div className="text- uppercase text-zinc-500">Total</div><div className="text-xl font-semibold text-white mt-1">{stats?.total ?? 0}</div></div>
        <div className="rounded-xl border border-white/10 bg-[#101725] p-4"><div className="text- uppercase text-zinc-500">Active</div><div className="text-xl font-semibold text-emerald-400 mt-1">{stats?.enabled ?? 0}</div></div>
        <div className="rounded-xl border border-white/10 bg-[#101725] p-4"><div className="text- uppercase text-zinc-500">Online</div><div className="text-xl font-semibold text-sky-400 mt-1">{stats?.online ?? 0}</div></div>
        <div className="rounded-xl border border-white/10 bg-[#101725] p-4"><div className="text- uppercase text-zinc-500">Blocked</div><div className="text-xl font-semibold text-amber-400 mt-1">{stats?.blocked ?? 0}</div></div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search country, host..." className="h-9 w-72 rounded-lg bg-[#111a2d] border border-white/10 px-3 text-sm text-white outline-none" />
        <select value={securityFilter} onChange={e => setSecurityFilter(e.target.value)} className="h-9 rounded-lg bg-[#111a2d] border border-white/10 px-3 text-sm text-white">
          <option value="all">Security: all</option><option value="approved">Approved</option><option value="suspicious">Suspicious</option><option value="blocked">Needs review</option>
        </select>
        <select value={transportFilter} onChange={e => setTransportFilter(e.target.value)} className="h-9 rounded-lg bg-[#111a2d] border border-white/10 px-3 text-sm text-white">
          <option value="all">Transport: all</option><option value="reality">REALITY</option><option value="tls">TLS</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={onlyOnline} onChange={e => setOnlyOnline(e.target.checked)} /> Online only</label>
        <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={hideBlocked} onChange={e => setHideBlocked(e.target.checked)} /> Hide blocked</label>
      </div>

      {selected.size > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => bulkSet([...selected], false)} className="h-8 px-3 rounded-lg border border-amber-500/30 text-amber-400 text-xs">Block {selected.size}</button>
          <button onClick={() => bulkSet([...selected], true)} className="h-8 px-3 rounded-lg border border-emerald-500/30 text-emerald-400 text-xs">Unblock {selected.size}</button>
          <button onClick={() => setSelected(new Set())} className="h-8 px-3 rounded-lg border border-white/10 text-xs text-white">Clear</button>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0e1424] overflow-hidden">
        <div className="grid grid-cols-[36px_2.6fr_1fr_1.3fr_0.8fr_0.7fr_100px] px-4 h-10 items-center text- uppercase tracking-wider text-zinc-500 border-b border-white/10 bg-white/[0.02]">
          <div></div><div>Node</div><div>Status</div><div>Security Note</div><div>Latency</div><div>App</div><div className="text-right">Action</div>
        </div>
        {loading ? <div className="p-12 text-center text-zinc-500 text-sm">Loading...</div> :
          filtered.map(n => (
            <div key={n.id} className={`grid grid-cols-[36px_2.6fr_1fr_1.3fr_0.8fr_0.7fr_100px] px-4 h- items-center border-b border-white/[0.04] hover:bg-white/[0.03] ${!n.enabled ? 'opacity-60' : ''}`}>
              <div><input type="checkbox" checked={selected.has(n.id)} onChange={() => setSelected(p => { const ns = new Set(p); ns.has(n.id) ? ns.delete(n.id) : ns.add(n.id); return ns; })} /></div>
              <div className="flex items-center gap-3 min-w-0">
                <FlagImg iso={n.iso} flag={n.flag} />
                <div className="min-w-0"><div className="text- font-medium text-white truncate">{n.name} {n.countIndex ? `#${n.countIndex}` : ''}</div><div className="text- text-zinc-500 truncate">{n.host}:{n.port}</div></div>
              </div>
              <div><span className={`text- px-2 py-1 rounded-full ${n.status==='online'?'bg-emerald-500/10 text-emerald-400':'bg-zinc-500/10 text-zinc-400'}`}>{n.status}</span></div>
              <div className="text- truncate pr-2">{n.securityReasons?.[0] ? <span className="text-amber-400">{n.securityReasons[0]}</span> : <span className="text-zinc-600">—</span>}</div>
              <div className="text-xs text-zinc-300">{n.ping ? `${Math.round(n.ping)} ms` : '—'}</div>
              <div className={`text-xs ${n.enabled ? 'text-emerald-400' : 'text-amber-400'}`}>{n.enabled ? 'Active' : 'Blocked'}</div>
              <div className="text-right"><button disabled={pending.has(n.id)} onClick={() => toggleEnabled(n.id, !n.enabled)} className={`text-xs px-3 py-1 rounded-lg border ${n.enabled ? 'border-white/10 text-zinc-300' : 'border-emerald-500/30 text-emerald-400'}`}>{n.enabled ? 'Block' : 'Unblock'}</button></div>
            </div>
          ))}
      </div>
      {message && <div className="fixed bottom-5 right-5 bg-[#111a2d] border border-white/10 px-4 py-2 rounded-lg text-sm text-white">{message}</div>}
    </div>
  );
}