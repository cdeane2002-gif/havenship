"use client";

import Image from "next/image";
import Link from "next/link";
import { useClaimedTeam } from "./ClaimedTeamProvider";
import { formDotColorClass, rankColorClass } from "@/lib/theme";

export function StandingsRow({
  rosterId,
  rank,
  name,
  avatarUrl,
  wins,
  losses,
  ties,
  pointsFor,
  pointsAgainst,
  form,
}: {
  rosterId: number;
  rank: number;
  name: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  form: ("W" | "L" | "T")[];
}) {
  const { claimedRosterId, claim, unclaim } = useClaimedTeam();
  const isMine = claimedRosterId === rosterId;
  const gamesPlayed = wins + losses + ties;
  const diff = pointsFor - pointsAgainst;
  const avg = gamesPlayed > 0 ? pointsFor / gamesPlayed : 0;

  return (
    <tr
      className={`border-b border-surface-border/60 last:border-0 hover:bg-surface-row/60 ${
        isMine ? "bg-accent/10" : "even:bg-surface-row/40"
      }`}
    >
      <td className={`px-3 py-3 font-mono font-semibold ${rankColorClass(rank)}`}>{rank}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (isMine ? unclaim() : claim(rosterId))}
            aria-label={isMine ? "This is your team — tap to unclaim" : "Claim this team as yours"}
            className={`shrink-0 text-base leading-none ${
              isMine ? "text-accent" : "text-fg-muted hover:text-fg-secondary"
            }`}
          >
            {isMine ? "★" : "☆"}
          </button>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-full border border-surface-border bg-surface-row"
              unoptimized
            />
          ) : (
            <div className="h-7 w-7 shrink-0 rounded-full border border-surface-border bg-surface-row" />
          )}
          <Link
            href={`/teams/${rosterId}`}
            className="truncate font-medium text-fg-primary hover:underline"
          >
            {name}
          </Link>
        </div>
      </td>
      <td className="px-3 py-3 text-center font-mono tabular-nums text-fg-secondary">
        {wins}-{losses}-{ties}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-fg-primary">
        {pointsFor.toFixed(2)}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-secondary">
        {pointsAgainst.toFixed(2)}
      </td>
      <td
        className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${
          diff > 0 ? "text-win" : diff < 0 ? "text-loss" : "text-fg-secondary"
        }`}
      >
        {diff > 0 ? "+" : ""}
        {diff.toFixed(2)}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-secondary">
        {avg.toFixed(2)}
      </td>
      <td className="px-3 py-3">
        {form.length > 0 ? (
          <div className="flex items-center justify-end gap-1">
            {form.map((r, i) => (
              <span
                key={i}
                title={r === "W" ? "Win" : r === "L" ? "Loss" : "Draw"}
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${formDotColorClass(r)}`}
              />
            ))}
          </div>
        ) : (
          <p className="text-right text-fg-muted">—</p>
        )}
      </td>
    </tr>
  );
}
