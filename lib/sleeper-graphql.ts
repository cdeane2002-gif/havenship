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
  points: number;
  starters: string[];
  players: string[];
  player_map: Record<string, GraphQLPlayer>;
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
      legs: matchLegs.sort((a, b) => b.points - a.points),
    }))
    .sort((a, b) => a.matchup_id - b.matchup_id);
}
