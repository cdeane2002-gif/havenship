"use client";

import { useState } from "react";
import type { StatContribution } from "@/lib/stat-breakdown";

export function ScoreBreakdown({
  season,
  week,
  playerId,
}: {
  season: string;
  week: number;
  playerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<StatContribution[] | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data || loading) return;

    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(
        `/api/player-breakdown?season=${encodeURIComponent(season)}&week=${week}&playerId=${encodeURIComponent(playerId)}`
      );
      if (!res.ok) throw new Error("request failed");
      const json = (await res.json()) as { breakdown: StatContribution[] };
      setData(json.breakdown);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        className="text-[11px] font-medium text-fg-muted underline decoration-dotted hover:text-fg-secondary"
      >
        {open ? "Hide breakdown" : "Breakdown"}
      </button>
      {open && (
        <div className="mt-1.5 rounded border border-surface-border/60 bg-surface-row/40 px-2.5 py-2">
          {loading && <p className="text-xs text-fg-muted">Loading…</p>}
          {failed && <p className="text-xs text-loss">Couldn&apos;t load breakdown.</p>}
          {data && data.length === 0 && (
            <p className="text-xs text-fg-muted">No scoring stats recorded for this week.</p>
          )}
          {data && data.length > 0 && (
            <div className="space-y-1">
              {data.map((c) => (
                <div key={c.code} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-fg-secondary">
                    {c.label}
                    {c.count !== 1 ? ` × ${c.count}` : ""}
                  </span>
                  <span
                    className={`shrink-0 font-mono tabular-nums ${
                      c.points >= 0 ? "text-win" : "text-loss"
                    }`}
                  >
                    {c.points >= 0 ? "+" : ""}
                    {c.points.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
