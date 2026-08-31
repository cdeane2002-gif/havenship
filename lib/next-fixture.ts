// Sleeper generates the full season's fantasy matchup pairings up front — matchup_legs for a
// future round returns real roster_id pairings (points/starters null, since unplayed), not
// just for the current/past round. Confirmed by querying round = current+1 mid-season: full
// pairings came back immediately. That's what makes "your next opponent" possible without
// waiting for the round to start.

import { LEAGUE_ID, getRosters, getUsers, teamNameForUser } from "./sleeper";
import { getMatchupLegs, pairMatchupLegs, SleeperAuthError } from "./sleeper-graphql";

export interface NextFixtureEntry {
  rosterId: number;
  opponentRosterId: number | null; // null = bye
  opponentManagerName: string | null;
}

/** Every roster's opponent for a given (usually upcoming) round. Fails gracefully to an empty
 * list on a missing/expired auth token — this is a nice-to-have, not core page content. */
export async function getRoundFixtures(week: number): Promise<NextFixtureEntry[]> {
  let legs;
  try {
    legs = await getMatchupLegs(LEAGUE_ID, week);
  } catch (err) {
    if (err instanceof SleeperAuthError) {
      console.error(err.message);
      return [];
    }
    throw err;
  }
  if (legs.length === 0) return [];

  const [rosters, users] = await Promise.all([getRosters(LEAGUE_ID), getUsers(LEAGUE_ID)]);
  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));
  const managerNameForRoster = (rosterId: number) => {
    const roster = rostersById.get(rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : null;
    return user ? teamNameForUser(user) : `Roster ${rosterId}`;
  };

  const pairs = pairMatchupLegs(legs);
  const entries: NextFixtureEntry[] = [];
  for (const pair of pairs) {
    for (const leg of pair.legs) {
      const opponent = pair.legs.find((l) => l.roster_id !== leg.roster_id);
      entries.push({
        rosterId: leg.roster_id,
        opponentRosterId: opponent?.roster_id ?? null,
        opponentManagerName: opponent ? managerNameForRoster(opponent.roster_id) : null,
      });
    }
  }
  return entries;
}
