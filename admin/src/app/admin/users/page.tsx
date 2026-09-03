// admin/src/app/admin/users/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

type UserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string;
  badge: string;
  userId: string | null;
  protected: boolean;
  banned: boolean;
  createdAt: number | null;
  lastNodeId: string | null;
  lastSeen: number | null;
};

type Me = { uid: string; role: string };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isSuper = me?.role === 'superadmin';

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setError(null);
    try {
      const res = await fetch('/api/users', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to load users');
      setUsers(data.users || []);
      setMe(data.me || null);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function toast(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3200);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.userId || '').toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleSync() {
    if (
      !confirm(
        'This will create Firestore documents for any Auth users that are missing. Continue?'
      )
    )
      return;

    setSyncing(true);
    try {
      const res = await fetch('/api/users/sync', {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Sync failed');
      toast(data.message || 'Sync completed');
      await fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function toggleBan(uid: string, banned: boolean) {
    setPending((p) => new Set(p).add(uid));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ banned }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Update failed');
      toast(banned ? 'User banned' : 'User unbanned');
      await fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Update failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(uid);
        return n;
      });
    }
  }

  async function deleteUser(uid: string, email: string | null) {
    if (!confirm(`Permanently delete ${email || uid}? This cannot be undone.`)) return;
    setPending((p) => new Set(p).add(uid));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Delete failed');
      toast('User deleted');
      await fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Delete failed');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(uid);
        return n;
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          displayName: createDisplayName.trim() || null,
          role: createRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Create failed');
      toast(`Created ${data.email}${data.userId ? ` (${data.userId})` : ''}`);
      setShowCreate(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateDisplayName('');
      setCreateRole('user');
      await fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  function canBan(u: UserRow) {
    if (u.protected) return false;
    if (isSuper) return true;
    return u.role === 'user';
  }

  function canDelete(u: UserRow) {
    return isSuper && !u.protected && u.uid !== me?.uid;
  }

  function badgeClass(badge: string) {
    if (badge === 'SUPER') return 'bg-purple-500/20 text-purple-300';
    if (badge === 'ADMIN') return 'bg-blue-500/20 text-blue-300';
    return 'bg-gray-500/20 text-gray-300';
  }

  return (
    <div className="mx-auto max-w-[1300px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Users</h1>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search email, name, user ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm"
          />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync from Auth'}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
          >
            + Add user
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220] p-6">
            <h2 className="mb-4 text-xl font-semibold">Create user</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Email</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded border border-white/10 bg-transparent px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full rounded border border-white/10 bg-transparent px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Display name (optional)</label>
                <input
                  type="text"
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  className="w-full rounded border border-white/10 bg-transparent px-3 py-2"
                />
              </div>
              {isSuper && (
                <div>
                  <label className="mb-1 block text-sm text-gray-400">Role</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as 'user' | 'admin')}
                    className="w-full rounded border border-white/10 bg-[#0b1220] px-3 py-2"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading users…</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            {search ? 'No users match your search' : 'No users yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">User ID</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Joined</th>
                  <th className="py-2 pr-4">Last node</th>
                  <th className="py-2 pr-4">Last seen</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.uid} className="border-b border-white/5">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{u.email || u.uid}</div>
                      {u.displayName && (
                        <div className="text-xs text-gray-500">{u.displayName}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-300">
                      {u.userId || '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(u.badge)}`}
                      >
                        {u.badge}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={u.banned ? 'text-red-400' : 'text-green-400'}>
                        {u.banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-400">{u.lastNodeId || '—'}</td>
                    <td className="py-3 pr-4 text-gray-400">
                      {u.lastSeen ? new Date(u.lastSeen).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canBan(u) && (
                          <button
                            onClick={() => toggleBan(u.uid, !u.banned)}
                            disabled={pending.has(u.uid)}
                            className={`rounded border px-3 py-1.5 text-xs disabled:opacity-50 ${
                              u.banned
                                ? 'border-green-500/30 text-green-400'
                                : 'border-red-500/30 text-red-400'
                            }`}
                          >
                            {u.banned ? 'Unban' : 'Ban'}
                          </button>
                        )}
                        {canDelete(u) && (
                          <button
                            onClick={() => deleteUser(u.uid, u.email)}
                            disabled={pending.has(u.uid)}
                            className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
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
        <div className="fixed bottom-6 right-6 rounded-lg bg-black/80 px-4 py-2 text-sm text-white">
          {message}
        </div>
      )}
    </div>
  );
}