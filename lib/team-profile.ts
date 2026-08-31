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

export interface OpponentRecord {
  opponentRosterId: number;
  opponentName: string;
  wins: number;
  losses: number;
  ties: number;
}

/** This roster's head-to-head record against every opponent it's ever played, derived from
 * getTeamMatchHistory. Byes are excluded — there's no opponent to attribute a result to. */
function getOpponentRecords(rosterId: number): OpponentRecord[] {
  const byOpponent = new Map<number, OpponentRecord>();
  for (const match of getTeamMatchHistory(rosterId)) {
    if (match.isBye || match.opponentRosterId === null || match.opponentName === null) continue;
    const existing = byOpponent.get(match.opponentRosterId) ?? {
      opponentRosterId: match.opponentRosterId,
      opponentName: match.opponentName,
      wins: 0,
      losses: 0,
      ties: 0,
    };
    if (match.result === "W") existing.wins++;
    else if (match.result === "L") existing.losses++;
    else if (match.result === "T") existing.ties++;
    existing.opponentName = match.opponentName; // keep the most recent name on file
    byOpponent.set(match.opponentRosterId, existing);
  }
  return Array.from(byOpponent.values());
}

/** The opponent this roster has beaten the most — null until it has at least one win against
 * anyone. Ties broken alphabetically for a stable, arbitrary-feeling-free order. */
export function getFavouriteOpponent(rosterId: number): OpponentRecord | null {
  const best = [...getOpponentRecords(rosterId)]
    .filter((o) => o.wins > 0)
    .sort((a, b) => b.wins - a.wins || a.opponentName.localeCompare(b.opponentName))[0];
  return best ?? null;
}

/** The opponent this roster has lost to the most — null until it has at least one loss. */
export function getLeastFavouriteOpponent(rosterId: number): OpponentRecord | null {
  const worst = [...getOpponentRecords(rosterId)]
    .filter((o) => o.losses > 0)
    .sort((a, b) => b.losses - a.losses || a.opponentName.localeCompare(b.opponentName))[0];
  return worst ?? null;
}

export interface ArchenemyEntry {
  playerId: string;
  playerName: string;
  points: number;
}

/** The single opposing player who has scored the most cumulative points against this roster,
 * across every match it's ever played — not per-opponent, just whoever's hurt them the most
 * in total. null if this roster has no captured matches yet. */
export function getArchenemy(rosterId: number): ArchenemyEntry | null {
  const pointsByPlayer = new Map<string, { name: string; points: number }>();

  for (const season of getAllSeasons()) {
    for (const gw of getAllGameweekData(season)) {
      for (const matchup of gw.matchups) {
        const mine = matchup.teams.find((t) => t.roster_id === rosterId);
        if (!mine) continue;
        const opponent = matchup.teams.find((t) => t.roster_id !== rosterId);
        if (!opponent) continue;

        for (const starter of opponent.starters) {
          const existing = pointsByPlayer.get(starter.player_id);
          if (existing) existing.points += starter.points;
          else pointsByPlayer.set(starter.player_id, { name: starter.name, points: starter.points });
        }
      }
    }
  }

  let best: ArchenemyEntry | null = null;
  for (const [playerId, v] of pointsByPlayer.entries()) {
    if (!best || v.points > best.points) best = { playerId, playerName: v.name, points: v.points };
  }
  return best;
}
