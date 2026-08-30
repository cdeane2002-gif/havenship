// Backfills every gameweek of an already-completed historical season, using the same
// authenticated matchup_legs source as the live/daily capture script. Historical results
// never change, so this is a one-time run per season — not part of the daily automation.
//
// Run manually: npm run season:backfill -- --season=2025
// Optional: --start-week=5 if the league didn't actually start until partway through the
// real EPL season (e.g. formed mid-season) — round numbers here ARE real EPL gameweek
// numbers (confirmed: the same number feeds getPlayerStatsForWeek), and Sleeper can still
// return matchup_legs data for rounds before a league's actual first played week (default/
// placeholder state, not real manager decisions) — skip those explicitly rather than
// capturing weeks that never really happened for this league.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LEAGUE_ID,
  getLeagueSeasonChain,
  getPlayerStatsForWeek,
  getRosters,
  getUsers,
  teamNameForUser,
} from "../lib/sleeper";
import { getMatchupLegs } from "../lib/sleeper-graphql";
import { buildMatchupsFromLegs } from "../lib/gameweek-builder";
import { recordCapturedWeek } from "../lib/gameweek";
import { GameweekFileSchema } from "../lib/gameweek-schemas";

const MAX_ROUNDS = 40; // stops early once a round returns no data

function parseSeasonArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--season="));
  if (!arg) throw new Error("Usage: npm run season:backfill -- --season=2025");
  return arg.split("=")[1];
}

function parseStartWeekArg(): number {
  const arg = process.argv.find((a) => a.startsWith("--start-week="));
  if (!arg) return 1;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

async function main() {
  const targetSeason = parseSeasonArg();
  const startWeek = parseStartWeekArg();

  const chain = await getLeagueSeasonChain(LEAGUE_ID);
  const target = chain.find((s) => s.league.season === targetSeason);
  if (!target) {
    throw new Error(
      `Season ${targetSeason} not found in league history (available: ${chain.map((s) => s.league.season).join(", ")}).`
    );
  }
  const leagueId = target.league.league_id;
  console.log(
    `Backfilling ${targetSeason} (league_id ${leagueId}) from week ${startWeek}...`
  );

  const [rosters, users] = await Promise.all([getRosters(leagueId), getUsers(leagueId)]);
  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));
  const managerNameForRoster = (rosterId: number) => {
    const roster = rostersById.get(rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : null;
    return user ? teamNameForUser(user) : `Roster ${rosterId}`;
  };

  const dataDir = resolve(__dirname, "../data/gameweeks");
  mkdirSync(dataDir, { recursive: true });

  let captured = 0;
  for (let round = startWeek; round <= MAX_ROUNDS; round++) {
    const legs = await getMatchupLegs(leagueId, round);
    if (legs.length === 0) {
      console.log(`Round ${round}: no data — stopping (season had ${captured} rounds).`);
      break;
    }

    const weekStats = await getPlayerStatsForWeek(targetSeason, round);
    const matchups = buildMatchupsFromLegs(legs, managerNameForRoster, weekStats);

    const file = GameweekFileSchema.parse({
      league_id: leagueId,
      season: targetSeason,
      week: round,
      captured_at: new Date().toISOString(),
      matchups,
    });

    const outPath = resolve(dataDir, `${targetSeason}-${round}.json`);
    writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
    recordCapturedWeek(LEAGUE_ID, targetSeason, round);
    captured++;
    console.log(`Round ${round}: ${matchups.length} matchups captured.`);
  }

  console.log(`Done — backfilled ${captured} weeks for ${targetSeason}.`);
}

main().catch((err) => {
  console.error("backfill-season failed:", err);
  process.exit(1);
});
