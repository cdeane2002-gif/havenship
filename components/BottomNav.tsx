"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Each page gets its own accent (active-tab underline, page-title rule, in-page highlights) —
// see app/globals.css's --color-page-* tokens. Surfaces stay identical across every page.
export const NAV_ITEMS = [
  { href: "/", label: "Standings", icon: "🏆", accent: "text-page-standings", accentBorder: "border-page-standings" },
  { href: "/results", label: "Results", icon: "⚽", accent: "text-page-results", accentBorder: "border-page-results" },
  { href: "/rules", label: "Rules", icon: "📋", accent: "text-page-rules", accentBorder: "border-page-rules" },
  { href: "/draft", label: "Draft", icon: "🎯", accent: "text-page-draft", accentBorder: "border-page-draft" },
  { href: "/best-xi", label: "Best XI", icon: "⭐", accent: "text-page-bestxi", accentBorder: "border-page-bestxi" },
  { href: "/transfers", label: "Transfers", icon: "🔄", accent: "text-page-transfers", accentBorder: "border-page-transfers" },
  { href: "/records", label: "Records", icon: "📚", accent: "text-page-records", accentBorder: "border-page-records" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (NAV_ITEMS.length < 2) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-border bg-surface-page/95 backdrop-blur supports-[backdrop-filter]:bg-surface-page/80 sm:hidden">
      <ul className="flex items-stretch overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 border-t-2 px-3.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? `${item.accent} ${item.accentBorder}` : "border-transparent text-fg-secondary"
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
    <nav className="hidden border-b border-surface-border sm:block">
      <ul className="mx-auto flex max-w-4xl items-center gap-6 overflow-x-auto px-6 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  active ? item.accent : "text-fg-secondary hover:text-fg-primary"
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
