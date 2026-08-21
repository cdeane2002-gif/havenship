"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Grows one entry per stage, in the build order: standings -> rules -> draft -> power rankings
// -> records. Results is on hold pending live matchup data (see lib/sleeper.ts getMatchups).
const NAV_ITEMS = [
  { href: "/", label: "Standings", icon: "🏆" },
  { href: "/rules", label: "Rules", icon: "📋" },
  { href: "/draft", label: "Draft", icon: "🎯" },
  { href: "/power-rankings", label: "Rankings", icon: "📈" },
  { href: "/records", label: "Records", icon: "📚" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (NAV_ITEMS.length < 2) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80 sm:hidden">
      <ul className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
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
      <ul className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
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
