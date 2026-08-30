// Shared, pure logic for turning raw matchup_legs + weekly player stats into the
// GameweekMatchup shape — used by both the offline capture script and the live (in-request)
// fetch path, so the two never drift apart.

import type { MatchupLeg } from "./sleeper-graphql";
import { pairMatchupLegs } from "./sleeper-graphql";
import type { GameweekMatchup, GameweekTeam } from "./gameweek-schemas";

export function buildTeamFromLeg(
  leg: MatchupLeg,
  managerName: string,
  weekStats: Record<string, Record<string, number>>
): GameweekTeam {
  const starters = (leg.starters ?? []).map((playerId) => {
    const info = leg.player_map?.[playerId];
    const stats = weekStats[playerId];
    return {
      player_id: playerId,
      name: info ? `${info.first_name} ${info.last_name}`.trim() : `Unknown (${playerId})`,
      position: info?.position ?? "?",
      club: info?.team_abbr ?? "?",
      points: stats?.pts_std ?? 0,
    };
  });

  // leg.points is null while the gameweek is still in progress (Sleeper only computes the
  // team total once the round is complete) — sum the starters' own live scores instead.
  const points = leg.points ?? starters.reduce((sum, s) => sum + s.points, 0);

  return {
    roster_id: leg.roster_id,
    manager_name: managerName,
    points,
    starters,
  };
}

export function buildMatchupsFromLegs(
  legs: MatchupLeg[],
  managerNameForRoster: (rosterId: number) => string,
  weekStats: Record<string, Record<string, number>>
): GameweekMatchup[] {
  const pairs = pairMatchupLegs(legs);
  return pairs.map((pair) => ({
    matchup_id: pair.matchup_id,
    teams: pair.legs.map((leg) => buildTeamFromLeg(leg, managerNameForRoster(leg.roster_id), weekStats)),
    report: null,
  }));
}
