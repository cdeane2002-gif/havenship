import Image from "next/image";
import {
  LEAGUE_ID,
  avatarUrlForUser,
  getLeague,
  getRosters,
  getUsers,
  rosterPointsAgainst,
  rosterPointsFor,
  rosterRecord,
  rosterStreak,
  teamNameForUser,
} from "@/lib/sleeper";
import { getPlayoffBracket, SleeperAuthError } from "@/lib/sleeper-graphql";
import { resolveBracket, type ResolvedBracketMatch } from "@/lib/playoff-bracket";
import { rankColorClass } from "@/lib/theme";
import type { SleeperRoster, SleeperUser } from "@/lib/types";

interface StandingsRow {
  roster: SleeperRoster;
  user: SleeperUser | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string | null;
}

function buildStandings(rosters: SleeperRoster[], users: SleeperUser[]): StandingsRow[] {
  const usersById = new Map(users.map((u) => [u.user_id, u]));

  const rows: StandingsRow[] = rosters.map((roster) => {
    const { wins, losses, ties } = rosterRecord(roster);
    return {
      roster,
      user: roster.owner_id ? usersById.get(roster.owner_id) ?? null : null,
      wins,
      losses,
      ties,
      pointsFor: rosterPointsFor(roster),
      pointsAgainst: rosterPointsAgainst(roster),
      streak: rosterStreak(roster),
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.roster.roster_id - b.roster.roster_id;
  });

  return rows;
}

function streakBadge(streak: string | null) {
  if (!streak) return null;
  const isWin = streak.endsWith("W");
  const isLoss = streak.endsWith("L");
  const color = isWin
    ? "bg-win/15 text-win"
    : isLoss
      ? "bg-loss/15 text-loss"
      : "bg-draw/15 text-draw";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${color}`}>
      {streak}
    </span>
  );
}

export default async function StandingsPage() {
  const [league, rosters, users] = await Promise.all([
    getLeague(LEAGUE_ID),
    getRosters(LEAGUE_ID),
    getUsers(LEAGUE_ID),
  ]);

  if (!league) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-fg-secondary">
        Couldn&apos;t reach the Sleeper API for this league. Try again shortly.
      </div>
    );
  }

  const rows = buildStandings(rosters, users);
  const seasonHasStarted = rows.some((r) => r.wins > 0 || r.losses > 0 || r.ties > 0);
  const isDrafting = league.status === "drafting";
  const currentPickNo = league.metadata?.current_pick_no;
  const totalPicks = league.total_rosters * 17; // 17 rounds, confirmed via draft settings

  // Bracket seeding exists from league creation (based on current standings while the
  // regular season is underway), not just once playoffs start. Fails gracefully — a missing/
  // expired auth token shouldn't take down the whole Standings page.
  let bracket: ResolvedBracketMatch[] = [];
  try {
    const managerNameForRoster = (rosterId: number) => {
      const row = rows.find((r) => r.roster.roster_id === rosterId);
      return row ? (row.user ? teamNameForUser(row.user) : `Roster ${rosterId}`) : `Roster ${rosterId}`;
    };
    const rawBracket = await getPlayoffBracket(LEAGUE_ID);
    bracket = resolveBracket(rawBracket, managerNameForRoster);
  } catch (err) {
    if (!(err instanceof SleeperAuthError)) throw err;
    console.error(err.message);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <header className="mb-6 border-b-2 border-page-standings pb-3">
        <p className="text-sm font-medium text-page-standings">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">
          {league.name}
        </h1>
      </header>

      {isDrafting && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Draft is underway
          {currentPickNo ? ` — pick ${currentPickNo} of ${totalPicks}` : ""}. Standings will
          fill in once the season kicks off.
        </div>
      )}

      {!isDrafting && !seasonHasStarted && (
        <div className="mb-6 rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
          No games played yet this season. Every team starts level.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-row text-left text-xs uppercase tracking-wide text-fg-muted">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 text-center font-medium">W-L-D</th>
              <th className="px-3 py-2 text-right font-medium">PF</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">PA</th>
              <th className="px-3 py-2 text-right font-medium">Strk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rank = i + 1;
              const name = row.user ? teamNameForUser(row.user) : `Roster ${row.roster.roster_id}`;
              const avatarUrl = row.user ? avatarUrlForUser(row.user) : null;
              return (
                <tr
                  key={row.roster.roster_id}
                  className="border-b border-surface-border/60 last:border-0 even:bg-surface-row/40 hover:bg-surface-row/60"
                >
                  <td className={`px-3 py-3 font-mono font-semibold ${rankColorClass(rank)}`}>
                    {rank}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
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
                      <span className="truncate font-medium text-fg-primary">{name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-mono tabular-nums text-fg-secondary">
                    {row.wins}-{row.losses}-{row.ties}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-fg-primary">
                    {row.pointsFor.toFixed(2)}
                  </td>
                  <td className="hidden px-3 py-3 text-right font-mono tabular-nums text-fg-secondary sm:table-cell">
                    {row.pointsAgainst.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right">{streakBadge(row.streak)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {bracket.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-semibold text-fg-primary">Current Playoff Bracket</h2>
          <p className="mb-3 text-sm text-fg-secondary">
            Seeded from current standings — updates as the regular season plays out.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {bracket.map((match) => (
              <div
                key={match.matchNumber}
                className="rounded-lg border border-surface-border bg-surface-card p-3"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-page-standings">
                  {match.roundLabel}
                </p>
                <div className="space-y-1 text-sm">
                  <div
                    className={`truncate ${
                      match.winnerLabel === match.team1Label
                        ? "font-semibold text-win"
                        : "text-fg-primary"
                    }`}
                  >
                    {match.team1Label}
                  </div>
                  <div
                    className={`truncate ${
                      match.winnerLabel === match.team2Label
                        ? "font-semibold text-win"
                        : "text-fg-primary"
                    }`}
                  >
                    {match.team2Label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
