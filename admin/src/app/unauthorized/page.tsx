// admin/src/app/unauthorized/page.tsx
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6">

      <div className="text-center">

        <div className="mb-5 text-6xl">
          🔒
        </div>

        <h1 className="text-3xl font-bold text-white">
          Access Denied
        </h1>

        <p className="mt-3 text-gray-400">
          You do not have administrator privileges.
        </p>

        <Link
          href="/login"
          className="mt-7 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Return to Login
        </Link>

      </div>

    </main>
  );
}