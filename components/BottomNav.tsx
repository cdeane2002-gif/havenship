"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Standings", icon: "🏆" },
  { href: "/results", label: "Results", icon: "⚽" },
  { href: "/rules", label: "Rules", icon: "📋" },
  { href: "/draft", label: "Draft", icon: "🎯" },
  { href: "/best-xi", label: "Best XI", icon: "⭐" },
  { href: "/transfers", label: "Transfers", icon: "🔄" },
  { href: "/records", label: "Records", icon: "📚" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (NAV_ITEMS.length < 2) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80 sm:hidden">
      <ul className="flex items-stretch overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopNav() {
  const pathname = usePathname();
  if (NAV_ITEMS.length < 2) return null;

  return (
    <nav className="hidden border-b border-neutral-800 sm:block">
      <ul className="mx-auto flex max-w-4xl items-center gap-6 overflow-x-auto px-6 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-emerald-400" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
