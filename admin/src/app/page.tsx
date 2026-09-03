import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050914] text-white">

      {/* Header */}

      <header className="border-b border-white/10">

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold">
              J
            </div>

            <div>
              <h1 className="font-bold">
                Joseph FastVPN
              </h1>

              <p className="text-xs text-gray-500">
                Secure connection
              </p>
            </div>

          </div>

          <Link
            href="/login"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
          >
            Sign in
          </Link>

        </div>

      </header>

      {/* Hero */}

      <section className="mx-auto max-w-7xl px-6 py-24">

        <div className="max-w-3xl">

          <div className="mb-6 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
            Joseph FastVPN
          </div>

          <h2 className="text-5xl font-bold tracking-tight sm:text-6xl">
            A faster and more secure
            <span className="text-blue-500">
              {" "}internet connection.
            </span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-500">
            Connect to your Joseph FastVPN service, manage your
            devices and protect your network traffic.
          </p>

          <div className="mt-8 flex gap-4">

            <Link
              href="/login"
              className="rounded-xl bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500"
            >
              Get Started
            </Link>

          </div>

        </div>

      </section>

      {/* Features */}

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-20 md:grid-cols-3">

        <Feature
          title="Secure Connections"
          description="Connect through configured VPN infrastructure."
        />

        <Feature
          title="Device Management"
          description="Manage the devices associated with your account."
        />

        <Feature
          title="Connection Monitoring"
          description="View connection status and account activity."
        />

      </section>

    </main>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">

      <h3 className="font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-gray-500">
        {description}
      </p>

    </div>
  );
}