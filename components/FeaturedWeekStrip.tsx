"use client";

import Link from "next/link";
import { useClaimedTeam } from "./ClaimedTeamProvider";
import type { GameweekMatchup } from "@/lib/gameweek-schemas";
import type { NextFixtureEntry } from "@/lib/next-fixture";

export function FeaturedWeekStrip({
  matchups,
  nextWeek,
  nextFixtures,
}: {
  matchups: GameweekMatchup[];
  nextWeek: number | null;
  nextFixtures: NextFixtureEntry[];
}) {
  const { claimedRosterId } = useClaimedTeam();

  // Your own matchup pulled to the front of the strip — everything else keeps its normal
  // matchup_id order.
  const ordered =
    claimedRosterId === null
      ? matchups
      : [...matchups].sort((a, b) => {
          const aMine = a.teams.some((t) => t.roster_id === claimedRosterId) ? 0 : 1;
          const bMine = b.teams.some((t) => t.roster_id === claimedRosterId) ? 0 : 1;
          return aMine - bMine;
        });

  const myNextFixture =
    claimedRosterId !== null ? nextFixtures.find((f) => f.rosterId === claimedRosterId) : undefined;

  return (
    <>
      {myNextFixture && nextWeek !== null && (
        <p className="mb-3 text-sm text-fg-secondary">
          Next up (GW{nextWeek}):{" "}
          {myNextFixture.opponentManagerName ? (
            <Link
              href={`/teams/${myNextFixture.opponentRosterId}`}
              className="font-medium text-fg-primary hover:underline"
            >
              vs {myNextFixture.opponentManagerName}
            </Link>
          ) : (
            "Bye week"
          )}
        </p>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
        {ordered.map((m) => {
          const [a, b] = m.teams;
          const isMine =
            claimedRosterId !== null && m.teams.some((t) => t.roster_id === claimedRosterId);
          return (
            <div
              key={m.matchup_id}
              className={`w-56 shrink-0 rounded-lg border p-3 text-sm ${
                isMine
                  ? "border-accent bg-accent/10"
                  : "border-surface-border bg-surface-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/teams/${a.roster_id}`}
                  className={`min-w-0 truncate hover:underline ${
                    !b || a.points >= b.points ? "font-semibold text-fg-primary" : "text-fg-secondary"
                  }`}
                >
                  {a.manager_name}
                </Link>
                <span className="shrink-0 font-mono tabular-nums text-fg-primary">
                  {a.points.toFixed(2)}
                </span>
              </div>
              {b ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <Link
                    href={`/teams/${b.roster_id}`}
                    className={`min-w-0 truncate hover:underline ${
                      b.points > a.points ? "font-semibold text-fg-primary" : "text-fg-secondary"
                    }`}
                  >
                    {b.manager_name}
                  </Link>
                  <span className="shrink-0 font-mono tabular-nums text-fg-primary">
                    {b.points.toFixed(2)}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-fg-muted">Bye week</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
