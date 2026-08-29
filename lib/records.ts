import {
  getLeagueSeasonChain,
  getRosters,
  getUsers,
  rosterPointsFor,
  rosterRecord,
  teamNameForUser,
} from "./sleeper";
import { getAllGameweekData } from "./gameweek";
import type { SleeperRoster, SleeperUser } from "./types";

export interface SeasonRecordsData {
  season: string;
  leagueId: string;
  status: string;
  rosters: SleeperRoster[];
  users: SleeperUser[];
}

/**
 * Fetches roster + user data for every season in the league's history (via
 * previous_league_id chain), newest first. Records built from this are automatically
 * season-agnostic — a new season just appears in the chain, no code changes needed.
 */
export async function getAllSeasonsData(leagueId: string): Promise<SeasonRecordsData[]> {
  const chain = await getLeagueSeasonChain(leagueId);
  return Promise.all(
    chain.map(async ({ league }) => ({
      season: league.season,
      leagueId: league.league_id,
      status: league.status,
      rosters: await getRosters(league.league_id),
      users: await getUsers(league.league_id),
    }))
  );
}

export interface SeasonPointsEntry {
  season: string;
  managerName: string;
  points: number;
}

/** One entry per manager (their single best season), not per roster-season — otherwise a
 * manager who's had multiple good seasons crowds out everyone else on this leaderboard. */
export function topSeasonPoints(seasons: SeasonRecordsData[], limit = 10): SeasonPointsEntry[] {
  const bestByOwner = new Map<string, SeasonPointsEntry>();
  for (const s of seasons) {
    const usersById = new Map(s.users.map((u) => [u.user_id, u]));
    for (const r of s.rosters) {
      const points = rosterPointsFor(r);
      if (points <= 0) continue; // season not started / no games played for this roster yet
      const ownerKey = r.owner_id ?? `roster-${s.season}-${r.roster_id}`;
      const user = r.owner_id ? usersById.get(r.owner_id) : null;
      const entry: SeasonPointsEntry = {
        season: s.season,
        managerName: user ? teamNameForUser(user) : `Roster ${r.roster_id}`,
        points,
      };
      const existing = bestByOwner.get(ownerKey);
      if (!existing || entry.points > existing.points) bestByOwner.set(ownerKey, entry);
    }
  }
  return Array.from(bestByOwner.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

export interface CareerRecord {
  userId: string;
  managerName: string;
  wins: number;
  losses: number;
  ties: number;
  seasonsPlayed: number;
}

export function careerWinLoss(seasons: SeasonRecordsData[]): CareerRecord[] {
  const byUser = new Map<string, CareerRecord>();
  // Walk oldest-to-newest so the most recent team name wins for display.
  const oldestFirst = [...seasons].reverse();
  for (const s of oldestFirst) {
    const usersById = new Map(s.users.map((u) => [u.user_id, u]));
    for (const r of s.rosters) {
      if (!r.owner_id) continue;
      const user = usersById.get(r.owner_id);
      const name = user ? teamNameForUser(user) : r.owner_id;
      const rec = rosterRecord(r);
      const gamesPlayed = rec.wins + rec.losses + rec.ties;
      const existing = byUser.get(r.owner_id) ?? {
        userId: r.owner_id,
        managerName: name,
        wins: 0,
        losses: 0,
        ties: 0,
        seasonsPlayed: 0,
      };
      existing.wins += rec.wins;
      existing.losses += rec.losses;
      existing.ties += rec.ties;
      if (gamesPlayed > 0) existing.seasonsPlayed += 1;
      existing.managerName = name;
      byUser.set(r.owner_id, existing);
    }
  }
  return Array.from(byUser.values()).sort((a, b) => {
    const gamesA = a.wins + a.losses + a.ties;
    const gamesB = b.wins + b.losses + b.ties;
    const pctA = gamesA > 0 ? a.wins / gamesA : 0;
    const pctB = gamesB > 0 ? b.wins / gamesB : 0;
    if (pctB !== pctA) return pctB - pctA;
    return b.wins - a.wins;
  });
}

export interface StreakEntry {
  season: string;
  managerName: string;
  length: number;
}

/**
 * Longest single-season win streak, derived from roster.metadata.record — a per-gameweek
 * W/L/T string Sleeper maintains independent of the (currently 404ing) matchups endpoint.
 */
export function longestWinStreaks(seasons: SeasonRecordsData[], limit = 10): StreakEntry[] {
  const entries: StreakEntry[] = [];
  for (const s of seasons) {
    const usersById = new Map(s.users.map((u) => [u.user_id, u]));
    for (const r of s.rosters) {
      const record = r.metadata?.record;
      if (!record) continue;
      let maxRun = 0;
      let current = 0;
      for (const ch of record) {
        if (ch === "W") {
          current++;
          maxRun = Math.max(maxRun, current);
        } else {
          current = 0;
        }
      }
      if (maxRun === 0) continue;
      const user = r.owner_id ? usersById.get(r.owner_id) : null;
      entries.push({
        season: s.season,
        managerName: user ? teamNameForUser(user) : `Roster ${r.roster_id}`,
        length: maxRun,
      });
    }
  }
  entries.sort((a, b) => b.length - a.length);
  return entries.slice(0, limit);
}

export interface SingleWeekScoreEntry {
  season: string;
  week: number;
  managerName: string;
  points: number;
}

/**
 * One entry per team per captured (finalized) gameweek — only ever reads committed
 * data/gameweeks/*.json, never a live in-progress week, so these records reflect final
 * results only. Shared by topSingleWeekScores and worstSingleWeekXI.
 */
function allSingleWeekScores(seasons: SeasonRecordsData[]): SingleWeekScoreEntry[] {
  const entries: SingleWeekScoreEntry[] = [];
  for (const s of seasons) {
    for (const gw of getAllGameweekData(s.season)) {
      for (const matchup of gw.matchups) {
        for (const team of matchup.teams) {
          entries.push({
            season: s.season,
            week: gw.week,
            managerName: team.manager_name,
            points: team.points,
          });
        }
      }
    }
  }
  return entries;
}

export function topSingleWeekScores(seasons: SeasonRecordsData[], limit = 10): SingleWeekScoreEntry[] {
  return allSingleWeekScores(seasons)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

/** "Worst Starting XI" — the lowest-scoring set of starters any manager fielded in a
 * single gameweek. */
export function worstSingleWeekXI(seasons: SeasonRecordsData[], limit = 10): SingleWeekScoreEntry[] {
  return allSingleWeekScores(seasons)
    .sort((a, b) => a.points - b.points)
    .slice(0, limit);
}

export interface WinMarginEntry {
  season: string;
  week: number;
  winnerName: string;
  winnerPoints: number;
  loserName: string;
  loserPoints: number;
  margin: number;
}

export function biggestWinMargins(seasons: SeasonRecordsData[], limit = 10): WinMarginEntry[] {
  const entries: WinMarginEntry[] = [];
  for (const s of seasons) {
    for (const gw of getAllGameweekData(s.season)) {
      for (const matchup of gw.matchups) {
        if (matchup.teams.length !== 2) continue; // skip byes
        const [a, b] = matchup.teams;
        const winner = a.points >= b.points ? a : b;
        const loser = a.points >= b.points ? b : a;
        entries.push({
          season: s.season,
          week: gw.week,
          winnerName: winner.manager_name,
          winnerPoints: winner.points,
          loserName: loser.manager_name,
          loserPoints: loser.points,
          margin: winner.points - loser.points,
        });
      }
    }
  }
  entries.sort((a, b) => b.margin - a.margin);
  return entries.slice(0, limit);
}
