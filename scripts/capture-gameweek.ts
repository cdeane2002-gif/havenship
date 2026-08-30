// Captures one gameweek's results and writes data/gameweeks/{season}-{week}.json.
//
// Run manually: npm run gameweek:capture -- --week=1
// (omit --week to auto-capture the most recently completed week)
//
// Requires SLEEPER_AUTH_TOKEN (see .env.local) for head-to-head pairings/starters — Sleeper's
// public API doesn't expose these for this sport, only an authenticated internal GraphQL API
// does. Designed to run unattended via the scheduled GitHub Actions workflow
// (.github/workflows/gameweek-capture.yml) — fails loudly (non-zero exit) rather than
// writing partial/silent data, so a CI failure is visible.
//
// AI match reports are disabled for now (no funded Anthropic key) — see lib/ai/client.ts /
// lib/gameweek-builder.ts if re-adding: GameweekMatchup.report stays in the schema as
// nullable so re-enabling later doesn't need a data migration.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LEAGUE_ID,
  getLeague,
  getPlayerStatsForWeek,
  getRosters,
  getSeasonState,
  getUsers,
  teamNameForUser,
} from "../lib/sleeper";
import { getMatchupLegs } from "../lib/sleeper-graphql";
import { buildMatchupsFromLegs } from "../lib/gameweek-builder";
import { recordCapturedWeek } from "../lib/gameweek";
import { GameweekFileSchema } from "../lib/gameweek-schemas";

function parseWeekArg(): number | null {
  const arg = process.argv.find((a) => a.startsWith("--week="));
  if (!arg) return null;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const league = await getLeague(LEAGUE_ID);
  if (!league) throw new Error("Could not load league.");

  let week = parseWeekArg();
  if (week === null) {
    const state = await getSeasonState();
    if (!state) throw new Error("Could not load season state to auto-detect week.");
    week = state.week - 1;
    if (week < 1) throw new Error(`Auto-detected week ${week} is before the season started — nothing to capture yet.`);
  }
  console.log(`Capturing gameweek ${week} for ${league.season}...`);

  const [rosters, users, legs, weekStats] = await Promise.all([
    getRosters(LEAGUE_ID),
    getUsers(LEAGUE_ID),
    getMatchupLegs(LEAGUE_ID, week),
    getPlayerStatsForWeek(league.season, week),
  ]);

  if (legs.length === 0) {
    throw new Error(
      `No matchup data returned for week ${week} — either it hasn't been played yet, or SLEEPER_AUTH_TOKEN needs refreshing.`
    );
  }

  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));
  const managerNameForRoster = (rosterId: number) => {
    const roster = rostersById.get(rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : null;
    return user ? teamNameForUser(user) : `Roster ${rosterId}`;
  };

  const matchups = buildMatchupsFromLegs(legs, managerNameForRoster, weekStats);
  console.log(`Found ${matchups.length} matchups.`);

  const file = GameweekFileSchema.parse({
    league_id: LEAGUE_ID,
    season: league.season,
    week,
    captured_at: new Date().toISOString(),
    matchups,
  });

  const dataDir = resolve(__dirname, "../data/gameweeks");
  mkdirSync(dataDir, { recursive: true });
  const outPath = resolve(dataDir, `${league.season}-${week}.json`);
  writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);

  recordCapturedWeek(LEAGUE_ID, league.season, week);
  console.log(`Updated index.json`);
}

main().catch((err) => {
  console.error("capture-gameweek failed:", err);
  process.exit(1);
});
