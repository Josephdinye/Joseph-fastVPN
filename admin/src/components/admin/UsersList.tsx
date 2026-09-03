// admin/src/components/admin/UsersList.tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import AddUserModal from './AddUserModal';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';

type UserRecord = { id: string; uid?: string; email?: string; displayName?: string; [k: string]: any };

export default function UsersList() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authInitialized, setAuthInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();

  // Subscribe to client auth changes purely for UI (Add button / Sign in)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthInitialized(true);
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  // Fetch users (server-side session cookie will be used)
  async function fetchUsers(query = '') {
    setLoading(true);
    setError(null);
    try {
      // Use the API route that exists: /api/users
      const url = '/api/users' + (query ? `?q=${encodeURIComponent(query)}` : '');
      const res = await fetch(url, { method: 'GET', credentials: 'same-origin' });

      // Safely handle non-JSON responses (avoid Unexpected token '<')
      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        throw new Error(txt || `Server returned ${res.status}`);
      }

      if (!res.ok || !data || !data.success) {
        const message = data?.error || `HTTP ${res.status}`;
        // If 401/403, keep message clear
        if (res.status === 401 || res.status === 403) {
          throw new Error(data?.error || 'Not authorized (admin only).');
        }
        throw new Error(message);
      }

      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || String(err));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial fetch on mount (do this regardless of client auth)
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const list = useMemo(() => users, [users]);

  function openLogin() {
    router.push('/login'); // ensure your login page is at /login
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            placeholder="Search users..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0b1220] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-3">
          {!authInitialized ? null : !currentUser ? (
            <button onClick={openLogin} className="rounded-xl bg-blue-600 px-4 py-2 text-white">Sign in</button>
          ) : (
            <button onClick={() => setShowAdd(true)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium transition hover:bg-blue-500">
              <UserPlus size={17} />
              Add User
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]">
        <div className="p-4">
          {!authInitialized ? (
            <div className="py-12 text-center text-gray-500">Initializing authentication…</div>
          ) : error ? (
            <div className="py-12 text-center text-red-400">{error}</div>
          ) : loading ? (
            <div className="py-12 text-center text-gray-500">Loading users...</div>
          ) : list.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-500">
                  <svg width="25" height="25" viewBox="0 0 24 24" fill="none"><path d="M16 11C18.2091 11 20 9.20914 20 7C20 4.79086 18.2091 3 16 3C13.7909 3 12 4.79086 12 7C12 9.20914 13.7909 11 16 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3 className="font-medium">No users yet</h3>
                <p className="mt-2 text-sm text-gray-600">Users registered through your VPN client will appear here.</p>
              </div>
            </div>
          ) : (
            <table className="w-full table-auto">
              <thead>
                <tr className="text-left text-sm text-gray-400">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">UID</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id || u.uid} className="border-t border-white/5">
                    <td className="p-3">{u.displayName || '—'}</td>
                    <td className="p-3">{u.email || '—'}</td>
                    <td className="p-3 text-sm text-gray-500 break-all">{u.uid || u.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd && <AddUserModal onClose={() => { setShowAdd(false); fetchUsers(); }} />}
    </div>
  );
}