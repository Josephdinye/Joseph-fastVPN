'use client';

export async function createSessionCookie(idToken: string) {
  const res = await fetch('/admin/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', // ensure browser accepts Set-Cookie and sends cookies on same-origin requests
    body: JSON.stringify({ idToken })
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create session');
  // Only reload after we know the server set the session cookie successfully
  window.location.reload();
}

export async function clearSession() {
  await fetch('/admin/api/session/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.reload();
}