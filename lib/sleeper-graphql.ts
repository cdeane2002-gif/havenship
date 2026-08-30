// Sleeper's public v1 REST API (lib/sleeper.ts) needs no auth, but head-to-head matchup
// pairings and per-week starters are only exposed through Sleeper's internal, undocumented
// GraphQL API — which requires a logged-in session. See the step-0 probe notes and the
// 2026-08-28 investigation: /matchups/<week> 404s permanently for this sport on the public
// API, and a v2 REST equivalent + this GraphQL query both confirmed the data exists but is
// authenticated (401 / "unauthorized").
//
// SLEEPER_AUTH_TOKEN is the user's own session JWT, extracted from their browser (never a
// password) and stored only in .env.local / CI secrets — never committed, never sent to the
// deployed site. This is unofficial and could break if Sleeper changes their auth scheme;
// every caller here should surface auth failures loudly rather than fail silently.

const GRAPHQL_URL = "https://sleeper.com/graphql";

export interface GraphQLPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string;
  fantasy_positions: string[];
  team_abbr: string;
  injury_status: string | null;
  status: string;
  number: number | null;
}

export interface MatchupLeg {
  round: number;
  roster_id: number;
  matchup_id: number;
  // null while the gameweek is still in progress — Sleeper only computes this team total
  // once the round is complete. Sum each starter's individual score as a live fallback.
  points: number | null;
  // Both observed null for some historical (already-final) rounds, not just live ones —
  // treat as always-optional, not just a live-week quirk.
  starters: string[] | null;
  players: string[] | null;
  player_map: Record<string, GraphQLPlayer> | null;
}

export class SleeperAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SleeperAuthError";
  }
}

function getAuthToken(): string {
  const token = process.env.SLEEPER_AUTH_TOKEN;
  if (!token) {
    throw new SleeperAuthError(
      "SLEEPER_AUTH_TOKEN is not set. Add it to .env.local (see the comment there for how to get one)."
    );
  }
  return token;
}

async function graphqlRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Sleeper GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as { data: T; errors?: { message: string; code?: string }[] };

  if (body.errors?.length) {
    const authError = body.errors.find(
      (e) => e.code === "unauthorized" || /unauthoriz/i.test(e.message)
    );
    if (authError) {
      throw new SleeperAuthError(
        "Sleeper rejected SLEEPER_AUTH_TOKEN as unauthorized — it's likely expired. " +
          "Grab a fresh one via chrome://net-export/ (see .env.local comment) and update it."
      );
    }
    throw new Error(`Sleeper GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`);
  }

  return body.data;
}

const MATCHUP_LEGS_QUERY = `
  query($round: Int!, $league_id: Snowflake!) {
    matchup_legs(round: $round, league_id: $league_id) {
      round
      roster_id
      matchup_id
      points
      starters
      players
      player_map
    }
  }
`;

export async function getMatchupLegs(leagueId: string, round: number): Promise<MatchupLeg[]> {
  const data = await graphqlRequest<{ matchup_legs: MatchupLeg[] | null }>(MATCHUP_LEGS_QUERY, {
    round,
    league_id: leagueId,
  });
  return data.matchup_legs ?? [];
}

export interface BracketMatchFrom {
  w?: number; // winner of match #
  l?: number; // loser of match #
}

export interface BracketMatch {
  m: number; // match number
  r: number; // round
  p?: number; // "place" this match decides — 1 = championship, 3 = 3rd place, 5 = 5th place
  t1: number | null; // roster_id, null if not yet determined
  t2: number | null;
  t1_from?: BracketMatchFrom;
  t2_from?: BracketMatchFrom;
  w: number | null; // winner roster_id, null until played
  l: number | null;
}

const PLAYOFF_BRACKET_QUERY = `
  query($league_id: Snowflake!) {
    league_playoff_bracket(league_id: $league_id)
  }
`;

/** Current playoff bracket seeding/structure — populated as soon as the league is created
 * (seeded from current standings while the regular season is still underway), not just once
 * playoffs start. Matches with t1/t2 both null haven't had their earlier-round winner decided
 * yet; use t1_from/t2_from to render "Winner of Match N" in the meantime. */
export async function getPlayoffBracket(leagueId: string): Promise<BracketMatch[]> {
  const data = await graphqlRequest<{ league_playoff_bracket: BracketMatch[] | null }>(
    PLAYOFF_BRACKET_QUERY,
    { league_id: leagueId }
  );
  return data.league_playoff_bracket ?? [];
}

// "scores" is Sleeper's real-world (Premier League) fixture/result feed — unrelated to
// fantasy matchups. metadata is an opaque Json scalar (can't select sub-fields in the query
// itself); shape below reflects what's actually been observed for clubsoccer:epl, including
// which real player_ids started for each side, which is how a fantasy player is matched to
// a specific fixture and side.
interface ScoreClubMeta {
  abbr: string;
  name: string;
  team: string;
}

interface ScoreRosterPlayer {
  player_id: string;
}

interface ScoreMetadata {
  home_team?: ScoreClubMeta;
  away_team?: ScoreClubMeta;
  rosters?: {
    home?: { players?: ScoreRosterPlayer[] };
    away?: { players?: ScoreRosterPlayer[] };
  };
}

interface RawScore {
  game_id: string;
  metadata: ScoreMetadata | null;
}

const SCORES_QUERY = `
  query($sport: String!, $season_type: String!, $season: String!, $week: Int) {
    scores(sport: $sport, season_type: $season_type, season: $season, week: $week) {
      game_id
      metadata
    }
  }
`;

export interface FixtureOpponent {
  isHome: boolean;
  club: ScoreClubMeta;
  opponent: ScoreClubMeta;
}

/** Finds the real-world Premier League fixture a player appeared in for a given gameweek,
 * and which club they faced. Returns null if the player can't be found in any fixture's
 * starting/bench roster that week (e.g. an unused bench player in Sleeper's own feed). */
export async function getFixtureOpponentForPlayer(
  season: string,
  week: number,
  playerId: string
): Promise<FixtureOpponent | null> {
  const data = await graphqlRequest<{ scores: RawScore[] | null }>(SCORES_QUERY, {
    sport: "clubsoccer:epl",
    season_type: "regular",
    season,
    week,
  });

  for (const score of data.scores ?? []) {
    const meta = score.metadata;
    if (!meta?.home_team || !meta?.away_team) continue;

    const inHome = meta.rosters?.home?.players?.some((p) => p.player_id === playerId);
    if (inHome) return { isHome: true, club: meta.home_team, opponent: meta.away_team };

    const inAway = meta.rosters?.away?.players?.some((p) => p.player_id === playerId);
    if (inAway) return { isHome: false, club: meta.away_team, opponent: meta.home_team };
  }

  return null;
}

export interface MatchupPair {
  matchup_id: number;
  round: number;
  legs: MatchupLeg[]; // usually 2 (head-to-head); could be 1 for a bye
}

/** Groups matchup legs into head-to-head pairs by matchup_id. */
export function pairMatchupLegs(legs: MatchupLeg[]): MatchupPair[] {
  const byMatchupId = new Map<number, MatchupLeg[]>();
  for (const leg of legs) {
    const list = byMatchupId.get(leg.matchup_id) ?? [];
    list.push(leg);
    byMatchupId.set(leg.matchup_id, list);
  }
  return Array.from(byMatchupId.entries())
    .map(([matchup_id, matchLegs]) => ({
      matchup_id,
      round: matchLegs[0].round,
      legs: matchLegs.sort((a, b) => (b.points ?? 0) - (a.points ?? 0)),
    }))
    .sort((a, b) => a.matchup_id - b.matchup_id);
}
