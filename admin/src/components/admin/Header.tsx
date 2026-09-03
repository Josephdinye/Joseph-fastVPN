'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, ChevronDown, User } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/admin': { title: 'Dashboard', subtitle: 'Overview of your infrastructure' },
  '/admin/users': { title: 'Users', subtitle: 'Accounts, roles, and access' },
  '/admin/devices': { title: 'Devices', subtitle: 'Registered client devices' },
  '/admin/nodes': { title: 'VPN Nodes', subtitle: 'Servers, health, and policy' },
  '/admin/connections': { title: 'Connections', subtitle: 'Live and recent sessions' },
  '/admin/security': { title: 'Security', subtitle: 'Access control and protection' },
  '/admin/security-logs': { title: 'Security Logs', subtitle: 'Audit trail and events' },
  '/admin/settings': { title: 'Settings', subtitle: 'Admin and system preferences' },
};

function resolveMeta(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = Object.keys(TITLES)
    .filter((k) => k !== '/admin' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return base ? TITLES[base] : { title: 'Administration', subtitle: 'Joseph FastVPN' };
}

export default function Header({
  email,
  onMenuClick,
}: {
  email: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const meta = resolveMeta(pathname);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = (email?.[0] || 'A').toUpperCase();
  const displayName = email?.includes('@') ? email.split('@')[0] : email || 'Administrator';

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function handleLogout() {
    setOpen(false);
    try {
      await firebaseAuth.signOut();
    } catch {
      // ignore
    }
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-white/10 bg-[#050914]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <div className="hidden text-xs text-gray-500 sm:block">
              Administration <span className="mx-1 text-gray-700">/</span>
              <span className="text-gray-400">{meta.title}</span>
            </div>
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {meta.title}
            </h1>
          </div>
        </div>

        {/* Profile */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 transition hover:border-white/20 hover:bg-white/[0.06] sm:gap-3 sm:pr-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold shadow-md shadow-indigo-500/20">
              {initial}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <div className="max-w-[140px] truncate text-sm font-medium capitalize md:max-w-[180px]">
                {displayName}
              </div>
              <div className="max-w-[140px] truncate text-[11px] text-gray-500 md:max-w-[180px]">
                {email}
              </div>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-500 transition ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/50">
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium capitalize">{displayName}</div>
                    <div className="truncate text-xs text-gray-500">{email}</div>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="inline-flex rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                    Administrator
                  </span>
                </div>
              </div>

              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push('/admin/settings');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                >
                  <User size={16} className="text-gray-500" />
                  Account settings
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}