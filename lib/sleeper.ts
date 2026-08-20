import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
} from "./types";

const BASE_URL = "https://api.sleeper.app/v1";

// Standings/roster data during the season. Games are decided at matchday, so a shorter
// window during a live gameweek keeps things fresh without hammering the API on every request.
const LEAGUE_DATA_REVALIDATE_SECONDS = 60 * 60; // 1 hour
export const LIVE_MATCHDAY_REVALIDATE_SECONDS = 60 * 5; // 5 minutes

export const LEAGUE_ID = "1389372609086382080";

async function sleeperGet<T>(
  path: string,
  revalidateSeconds: number = LEAGUE_DATA_REVALIDATE_SECONDS
): Promise<T | null> {
  const res = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: revalidateSeconds },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Sleeper API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function getLeague(leagueId: string = LEAGUE_ID): Promise<SleeperLeague | null> {
  return sleeperGet<SleeperLeague>(`/league/${leagueId}`);
}

export async function getRosters(leagueId: string = LEAGUE_ID): Promise<SleeperRoster[]> {
  return (await sleeperGet<SleeperRoster[]>(`/league/${leagueId}/rosters`)) ?? [];
}

export async function getUsers(leagueId: string = LEAGUE_ID): Promise<SleeperUser[]> {
  return (await sleeperGet<SleeperUser[]>(`/league/${leagueId}/users`)) ?? [];
}

export async function getDrafts(leagueId: string = LEAGUE_ID): Promise<SleeperDraft[]> {
  return (await sleeperGet<SleeperDraft[]>(`/league/${leagueId}/drafts`)) ?? [];
}

export async function getDraft(draftId: string): Promise<SleeperDraft | null> {
  return sleeperGet<SleeperDraft>(`/draft/${draftId}`);
}

export async function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return (await sleeperGet<SleeperDraftPick[]>(`/draft/${draftId}/picks`)) ?? [];
}

export async function getTransactions(
  leagueId: string,
  week: number
): Promise<SleeperTransaction[]> {
  return (await sleeperGet<SleeperTransaction[]>(`/league/${leagueId}/transactions/${week}`)) ?? [];
}

/**
 * Matchups are per-gameweek boxscores. As of the step-0 probe (2026-08-20), this endpoint
 * 404s for every week in both the completed 2025 season and the in-progress 2026 season.
 * Kept here so it's ready to use once the 2026 season's first gameweek (starts 2026-08-21)
 * produces real data — but every caller must handle a null/empty return.
 */
export async function getMatchups(leagueId: string, week: number): Promise<unknown[]> {
  return (
    (await sleeperGet<unknown[]>(
      `/league/${leagueId}/matchups/${week}`,
      LIVE_MATCHDAY_REVALIDATE_SECONDS
    )) ?? []
  );
}

export interface SeasonRef {
  league: SleeperLeague;
}

/**
 * Walks the league's previous_league_id chain to find every prior season.
 * Returns seasons newest-first, starting with the given league.
 */
export async function getLeagueSeasonChain(
  leagueId: string = LEAGUE_ID
): Promise<SeasonRef[]> {
  const chain: SeasonRef[] = [];
  let currentId: string | null = leagueId;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const league = await getLeague(currentId);
    if (!league) break;
    chain.push({ league });
    currentId = league.previous_league_id;
  }

  return chain;
}

export function teamNameForUser(user: SleeperUser): string {
  return user.metadata?.team_name?.trim() || user.display_name;
}

export function avatarUrlForUser(user: SleeperUser): string | null {
  if (user.metadata?.avatar) return user.metadata.avatar;
  if (!user.avatar) return null;
  return `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
}

export function rosterRecord(roster: SleeperRoster): { wins: number; losses: number; ties: number } {
  return {
    wins: roster.settings.wins ?? 0,
    losses: roster.settings.losses ?? 0,
    ties: roster.settings.ties ?? 0,
  };
}

export function rosterPointsFor(roster: SleeperRoster): number {
  const whole = roster.settings.fpts ?? 0;
  const decimal = roster.settings.fpts_decimal ?? 0;
  return whole + decimal / 100;
}

export function rosterPointsAgainst(roster: SleeperRoster): number {
  const whole = roster.settings.fpts_against ?? 0;
  const decimal = roster.settings.fpts_against_decimal ?? 0;
  return whole + decimal / 100;
}

export function rosterStreak(roster: SleeperRoster): string | null {
  return roster.metadata?.streak ?? null;
}
