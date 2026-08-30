// Fetched on-demand by ScoreBreakdown.tsx when a viewer expands a specific gameweek row on a
// player's profile — not prefetched for every row up front, since a long-tenured player can
// have 30+ appearances and each breakdown needs its own weekly stats fetch.

import { NextRequest, NextResponse } from "next/server";
import { LEAGUE_ID, getLeagueSeasonChain } from "@/lib/sleeper";
import { getPointsBreakdown } from "@/lib/stat-breakdown";
import { getFixtureOpponentForPlayer, SleeperAuthError } from "@/lib/sleeper-graphql";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");
  const week = Number(searchParams.get("week"));
  const playerId = searchParams.get("playerId");

  if (!season || !playerId || !Number.isFinite(week)) {
    return NextResponse.json({ error: "Missing season, week, or playerId" }, { status: 400 });
  }

  const chain = await getLeagueSeasonChain(LEAGUE_ID);
  const seasonEntry = chain.find((c) => c.league.season === season);
  if (!seasonEntry) {
    return NextResponse.json({ error: `Unknown season ${season}` }, { status: 404 });
  }

  const [breakdown, fixture] = await Promise.all([
    getPointsBreakdown(season, week, playerId, seasonEntry.league.scoring_settings),
    getFixtureOpponentForPlayer(season, week, playerId).catch((err) => {
      if (err instanceof SleeperAuthError) {
        console.error(err.message);
        return null;
      }
      throw err;
    }),
  ]);

  return NextResponse.json({ breakdown, fixture });
}
