// Reconstructs the league table as it stood after a given gameweek — something Sleeper's own
// API can't answer (it only ever exposes the CURRENT cumulative roster totals, never a
// historical snapshot). Built entirely from our own committed data/gameweeks/*.json files,
// replaying every captured week from 1 through the cutoff week for a season.

import { avatarUrlForUser, teamNameForUser } from "./sleeper";
import { getAllGameweekData } from "./gameweek";
import type { SleeperRoster, SleeperUser } from "./types";

export interface HistoricalStandingsRow {
  rosterId: number;
  name: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  form: ("W" | "L" | "T")[]; // chronological, most recent (as of the cutoff week) last
}

/** The standings table as of the end of `throughWeek` — every captured week up to and
 * including it, for every roster in the league. Rosters with no matches yet still appear,
 * at 0-0-0. */
export function getStandingsThroughWeek(
  season: string,
  throughWeek: number,
  rosters: SleeperRoster[],
  users: SleeperUser[]
): HistoricalStandingsRow[] {
  const usersById = new Map(users.map((u) => [u.user_id, u]));

  const statsByRoster = new Map<
    number,
    { wins: number; losses: number; ties: number; pf: number; pa: number; form: ("W" | "L" | "T")[] }
  >();
  for (const roster of rosters) {
    statsByRoster.set(roster.roster_id, { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, form: [] });
  }

  const weeks = getAllGameweekData(season)
    .filter((gw) => gw.week <= throughWeek)
    .sort((a, b) => a.week - b.week);

  for (const gw of weeks) {
    for (const matchup of gw.matchups) {
      for (const team of matchup.teams) {
        const stats = statsByRoster.get(team.roster_id);
        if (!stats) continue;

        const opponent = matchup.teams.find((t) => t.roster_id !== team.roster_id);
        stats.pf += team.points;
        if (!opponent) continue; // bye week — no opponent to compare against or count PA from

        stats.pa += opponent.points;
        if (team.points > opponent.points) {
          stats.wins++;
          stats.form.push("W");
        } else if (team.points < opponent.points) {
          stats.losses++;
          stats.form.push("L");
        } else {
          stats.ties++;
          stats.form.push("T");
        }
      }
    }
  }

  const rows: HistoricalStandingsRow[] = rosters.map((roster) => {
    const stats = statsByRoster.get(roster.roster_id)!;
    const user = roster.owner_id ? usersById.get(roster.owner_id) ?? null : null;
    return {
      rosterId: roster.roster_id,
      name: user ? teamNameForUser(user) : `Roster ${roster.roster_id}`,
      avatarUrl: user ? avatarUrlForUser(user) : null,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      pointsFor: stats.pf,
      pointsAgainst: stats.pa,
      form: stats.form.slice(-5),
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.rosterId - b.rosterId;
  });

  return rows;
}
