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
    ? "bg-emerald-500/15 text-emerald-400"
    : isLoss
      ? "bg-rose-500/15 text-rose-400"
      : "bg-neutral-500/15 text-neutral-300";
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
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-neutral-300">
        Couldn&apos;t reach the Sleeper API for this league. Try again shortly.
      </div>
    );
  }

  const rows = buildStandings(rosters, users);
  const seasonHasStarted = rows.some((r) => r.wins > 0 || r.losses > 0 || r.ties > 0);
  const isDrafting = league.status === "drafting";
  const currentPickNo = league.metadata?.current_pick_no;
  const totalPicks = league.total_rosters * 17; // 17 rounds, confirmed via draft settings

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-400">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{league.name}</h1>
      </header>

      {isDrafting && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Draft is underway
          {currentPickNo ? ` — pick ${currentPickNo} of ${totalPicks}` : ""}. Standings will
          fill in once the season kicks off.
        </div>
      )}

      {!isDrafting && !seasonHasStarted && (
        <div className="mb-6 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
          No games played yet this season. Every team starts level.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
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
              const name = row.user ? teamNameForUser(row.user) : `Roster ${row.roster.roster_id}`;
              const avatarUrl = row.user ? avatarUrlForUser(row.user) : null;
              return (
                <tr
                  key={row.roster.roster_id}
                  className="border-b border-neutral-800/60 last:border-0 even:bg-neutral-900/30"
                >
                  <td className="px-3 py-3 text-neutral-400">{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-full bg-neutral-800"
                          unoptimized
                        />
                      ) : (
                        <div className="h-7 w-7 shrink-0 rounded-full bg-neutral-800" />
                      )}
                      <span className="truncate font-medium">{name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums text-neutral-300">
                    {row.wins}-{row.losses}-{row.ties}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-neutral-300">
                    {row.pointsFor.toFixed(1)}
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular-nums text-neutral-300 sm:table-cell">
                    {row.pointsAgainst.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right">{streakBadge(row.streak)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
