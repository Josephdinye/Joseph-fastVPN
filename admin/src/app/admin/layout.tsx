// admin/src/app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import Sidebar from '@/components/admin/Sidebar';
import Header from '@/components/admin/Header';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireAdmin();
  } catch (err) {
    // If auth fails (not signed in / session invalid / not admin) redirect to login.
    // Using next/navigation.redirect from a Server Component triggers an immediate server-side redirect.
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#050914] text-white">
      <Sidebar />

      <div className="lg:pl-64">
        {/* Keep header sticky so page content scrolls beneath it */}
        <div className="sticky top-0 z-40 bg-transparent">
          <Header email={user?.email || 'Administrator'} />
        </div>

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}