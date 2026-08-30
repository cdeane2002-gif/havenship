// Cross-season match history for a single roster, built the same way lib/player-profile.ts
// builds a player's score history: scan every committed gameweek file and pull out the rows
// that mention this roster_id. roster_id (not manager_name) is the stable join key — team
// names can change season to season, roster_id doesn't within this league's history.

import { getAllSeasons, getAllGameweekData } from "./gameweek";
import type { GameweekTeam } from "./gameweek-schemas";

export interface TeamMatchResult {
  season: string;
  week: number;
  points: number;
  opponentRosterId: number | null;
  opponentName: string | null;
  opponentPoints: number | null;
  result: "W" | "L" | "T" | null;
  isBye: boolean;
}

function resultFor(points: number, opponentPoints: number | null): "W" | "L" | "T" | null {
  if (opponentPoints === null) return null;
  if (points > opponentPoints) return "W";
  if (points < opponentPoints) return "L";
  return "T";
}

/** Every captured match (across all seasons) involving this roster_id, oldest first. */
export function getTeamMatchHistory(rosterId: number): TeamMatchResult[] {
  const results: TeamMatchResult[] = [];

  for (const season of getAllSeasons()) {
    for (const gw of getAllGameweekData(season)) {
      for (const matchup of gw.matchups) {
        const team = matchup.teams.find((t) => t.roster_id === rosterId);
        if (!team) continue;

        const opponent = matchup.teams.find((t) => t.roster_id !== rosterId) as
          | GameweekTeam
          | undefined;

        results.push({
          season,
          week: gw.week,
          points: team.points,
          opponentRosterId: opponent?.roster_id ?? null,
          opponentName: opponent?.manager_name ?? null,
          opponentPoints: opponent?.points ?? null,
          result: resultFor(team.points, opponent?.points ?? null),
          isBye: !opponent,
        });
      }
    }
  }

  results.sort((a, b) => (a.season === b.season ? a.week - b.week : a.season.localeCompare(b.season)));
  return results;
}
