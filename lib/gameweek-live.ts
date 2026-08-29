// Fetches the CURRENT (in-progress or just-finished) gameweek's scores live, at request
// time, rather than from a committed data/gameweeks/*.json snapshot. This is what makes
// "live scores" actually live for the gameweek that's happening right now — every other
// (past, already-captured) week is served from the committed file instead.
//
// Trade-off: this means SLEEPER_AUTH_TOKEN must be set as a Vercel environment variable
// too, not just locally and in GitHub Actions — still server-side only (used inside a
// Server Component's fetch, never sent to the browser), but a broader footprint than the
// capture-only design. No caching here: pages using this are already dynamic (searchParams),
// traffic is tiny (~12 users), and freshness matters more than shaving a request.

import { getPlayerStatsForWeek, getRosters, getUsers, teamNameForUser } from "./sleeper";
import { getMatchupLegs, SleeperAuthError } from "./sleeper-graphql";
import { buildMatchupsFromLegs } from "./gameweek-builder";
import type { GameweekFile } from "./gameweek-schemas";

export async function getLiveGameweekData(
  leagueId: string,
  season: string,
  week: number
): Promise<GameweekFile | null> {
  let legs;
  try {
    legs = await getMatchupLegs(leagueId, week);
  } catch (err) {
    if (err instanceof SleeperAuthError) {
      console.error(err.message);
      return null;
    }
    throw err;
  }

  if (legs.length === 0) return null;

  const [rosters, users, weekStats] = await Promise.all([
    getRosters(leagueId),
    getUsers(leagueId),
    getPlayerStatsForWeek(season, week),
  ]);

  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));
  const managerNameForRoster = (rosterId: number) => {
    const roster = rostersById.get(rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : null;
    return user ? teamNameForUser(user) : `Roster ${rosterId}`;
  };

  const matchups = buildMatchupsFromLegs(legs, managerNameForRoster, weekStats);

  return {
    league_id: leagueId,
    season,
    week,
    captured_at: new Date().toISOString(),
    matchups,
  };
}
