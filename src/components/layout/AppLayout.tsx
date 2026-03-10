"use client";

import Link from "next/link";
import { Nav } from "./Nav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-0 flex h-screen flex-col border-r border-slate-200 bg-white">
          <Link
            href="/dashboard"
            className="border-b border-slate-200 px-4 py-4 text-lg font-bold tracking-tight text-slate-900"
          >
            CaseClock
          </Link>
          <Nav />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-24 md:pb-8">
        <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
      </main>

      {/* Mobile bottom nav - fixed */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between gap-1 overflow-x-auto px-2 py-2">
          <Link
            href="/dashboard"
            className="shrink-0 text-sm font-semibold text-slate-900"
          >
            CaseClock
          </Link>
          <Nav />
        </div>
      </div>
    </div>
  );
}
