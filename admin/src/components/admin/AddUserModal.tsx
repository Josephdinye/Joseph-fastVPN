// src/components/admin/AddUserModal.tsx
'use client';
import React, { useState } from 'react';

export default function AddUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createUser() {
    setBusy(true);
    setError(null);
    try {
      if (!email || !password) throw new Error('Email and password required');

      // POST to the route that exists (/api/users)
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // ensure session cookie is sent
        body: JSON.stringify({ email, password, displayName }),
      });

      // Guard against HTML/404 responses (avoid "Unexpected token '<'")
      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        throw new Error(txt || `Server returned ${res.status}`);
      }

      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

      onClose();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-[#071125] p-6">
        <h3 className="mb-4 text-lg font-semibold">Add User</h3>

        <label className="block text-sm text-gray-400">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mb-3 w-full rounded border border-white/10 bg-transparent p-2 text-white" />

        <label className="block text-sm text-gray-400">Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mb-3 w-full rounded border border-white/10 bg-transparent p-2 text-white" />

        <label className="block text-sm text-gray-400">Temporary password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} className="mb-4 w-full rounded border border-white/10 bg-transparent p-2 text-white" />

        {error && <div className="mb-2 text-sm text-red-400">{error}</div>}

        <div className="flex justify-end gap-2">
          <button className="rounded-xl px-4 py-2" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-white" onClick={createUser} disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}