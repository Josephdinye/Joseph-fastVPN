// admin/src/app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { uid?: string; email?: string | null; role?: string } | null = null;

  try {
    user = await requireAdmin();
  } catch {
    redirect('/login');
  }

  return (
    <AdminShell email={user?.email || 'Administrator'}>
      {children}
    </AdminShell>
  );
}