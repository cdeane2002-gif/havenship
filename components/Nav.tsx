"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One nav, rendered once. Text-only labels (no emoji — glyphs render inconsistently across
// devices/fonts) with each page's accent (see app/globals.css's --color-page-* tokens) marking
// the active link. Positioned as a fixed bottom bar on mobile and a sticky top bar on desktop
// via responsive classes on the same markup, rather than two separate nav components.
export const NAV_ITEMS = [
  { href: "/", label: "Standings", accent: "text-page-standings", accentBorder: "border-page-standings" },
  { href: "/results", label: "Results", accent: "text-page-results", accentBorder: "border-page-results" },
  { href: "/rules", label: "Rules", accent: "text-page-rules", accentBorder: "border-page-rules" },
  { href: "/draft", label: "Draft", accent: "text-page-draft", accentBorder: "border-page-draft" },
  { href: "/best-xi", label: "Best XI", accent: "text-page-bestxi", accentBorder: "border-page-bestxi" },
  { href: "/transfers", label: "Transfers", accent: "text-page-transfers", accentBorder: "border-page-transfers" },
  { href: "/records", label: "Records", accent: "text-page-records", accentBorder: "border-page-records" },
];

export default function Nav() {
  const pathname = usePathname();
  if (NAV_ITEMS.length < 2) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-border bg-surface-page/95 backdrop-blur supports-[backdrop-filter]:bg-surface-page/80 sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b">
      <ul
        className="flex items-stretch overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:mx-auto sm:max-w-4xl sm:justify-center sm:overflow-visible sm:px-6"
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={`flex items-center border-t-2 px-3.5 py-3 text-[13px] font-medium transition-colors sm:border-t-0 sm:border-b-2 sm:px-4 sm:py-4 sm:text-sm ${
                  active
                    ? `${item.accent} ${item.accentBorder}`
                    : "border-transparent text-fg-secondary hover:text-fg-primary"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Visual hint that there's more to scroll to on mobile — the fixed-position + touch
          horizontal scroll combo is easy to miss without one. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface-page to-transparent sm:hidden" />
    </nav>
  );
}
