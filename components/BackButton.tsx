"use client";

import { useRouter } from "next/navigation";

// A player/team can be reached from many places (Results, Best XI, Transfers, Standings,
// another profile's roster or headlines) — a hardcoded href would only be right for one of
// them. Real browser history back gets the viewer to whichever of those they actually came
// from, falling back to a sensible default only when there's no history to go back to (e.g.
// the page was opened directly via a shared link).
export function BackButton({ fallbackHref, label = "← Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="mb-4 inline-block text-sm text-fg-secondary hover:text-fg-primary"
    >
      {label}
    </button>
  );
}
