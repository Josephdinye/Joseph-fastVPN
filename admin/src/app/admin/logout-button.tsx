// admin/src/app/admin/logout-button.tsx
'use client';
import { useRouter } from 'next/navigation';
import { firebaseAuth } from '@/lib/firebase-client';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
  try {
    await firebaseAuth.signOut();
  } catch {
    // IndexedDB “connection is closing” is common during signOut — ignore
  }
  try {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    // ignore
  }
  router.push('/login');
  router.refresh();
}

  return (
    <button onClick={handleLogout} className="rounded border border-white/10 px-3 py-1.5 hover:bg-white/5">
      Sign out
    </button>
  );
}