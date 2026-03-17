"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/timeline", label: "Timeline" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/cases", label: "Cases" },
  { href: "/contacts", label: "Contacts" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="flex flex-1 flex-wrap justify-center gap-1 overflow-x-auto md:flex-col md:flex-nowrap md:overflow-visible md:py-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors md:mx-2 md:px-3 md:py-2.5 md:text-sm ${
              isActive
                ? "bg-blue-50 text-blue-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      {user ? (
        <button
          type="button"
          onClick={handleSignOut}
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 md:mx-2 md:px-3 md:py-2.5 md:text-sm"
        >
          Sign out
        </button>
      ) : (
        <Link
          href="/login"
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 md:mx-2 md:px-3 md:py-2.5 md:text-sm"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
