// Captures one gameweek's results and writes data/gameweeks/{season}-{week}.json, including
// an AI-written match report per head-to-head matchup.
//
// Run manually: npm run gameweek:capture -- --week=1
// (omit --week to auto-capture the most recently completed week)
//
// Requires SLEEPER_AUTH_TOKEN (see .env.local) for head-to-head pairings/starters — Sleeper's
// public API doesn't expose these for this sport, only an authenticated internal GraphQL API
// does. Requires ANTHROPIC_API_KEY for the match reports. Designed to run unattended via the
// scheduled GitHub Actions workflow (.github/workflows/gameweek-capture.yml) — fails loudly
// (non-zero exit) rather than writing partial/silent data, so a CI failure is visible.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { getMatchupLegs, pairMatchupLegs, type MatchupLeg } from "../lib/sleeper-graphql";
import { getAnthropicClient, generateStructuredJson } from "../lib/ai/client";
import { MatchReportResponseSchema } from "../lib/ai/schemas";
import {
  GameweekFileSchema,
  GameweekIndexSchema,
  type GameweekMatchup,
  type GameweekTeam,
  type MatchReport,
} from "../lib/gameweek-schemas";
import { STAT_LABELS } from "../lib/scoring-labels";

function parseWeekArg(): number | null {
  const arg = process.argv.find((a) => a.startsWith("--week="));
  if (!arg) return null;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) ? n : null;
}

function notableStats(rawStats: Record<string, number> | undefined): string[] {
  if (!rawStats) return [];
  const notable: string[] = [];
  for (const [key, value] of Object.entries(rawStats)) {
    const match = key.match(/^pos_(gk|[fmd])_(.+)$/);
    if (!match) continue;
    const label = STAT_LABELS[match[2]];
    if (!label || value === 0) continue;
    if (["Goal", "Assist", "Clean Sheet", "Penalty Saved", "Red Card", "Own Goal"].includes(label.label)) {
      notable.push(value > 1 ? `${value}x ${label.label}` : label.label);
    }
  }
  return notable;
}

async function buildTeam(
  leg: MatchupLeg,
  managerName: string,
  weekStats: Record<string, Record<string, number>>
): Promise<GameweekTeam> {
  const starters = leg.starters.map((playerId) => {
    const info = leg.player_map[playerId];
    const stats = weekStats[playerId];
    return {
      player_id: playerId,
      name: info ? `${info.first_name} ${info.last_name}`.trim() : `Unknown (${playerId})`,
      position: info?.position ?? "?",
      club: info?.team_abbr ?? "?",
      points: stats?.pts_std ?? 0,
    };
  });

  return {
    roster_id: leg.roster_id,
    manager_name: managerName,
    points: leg.points,
    starters,
  };
}

async function generateReport(
  client: ReturnType<typeof getAnthropicClient>,
  teamA: GameweekTeam,
  teamB: GameweekTeam,
  weekStats: Record<string, Record<string, number>>,
  week: number
): Promise<MatchReport> {
  const describeTeam = (team: GameweekTeam) => ({
    manager: team.manager_name,
    total_points: team.points,
    starters: team.starters
      .map((s) => ({
        name: s.name,
        position: s.position,
        points: s.points,
        notable_stats: notableStats(weekStats[s.player_id]),
      }))
      .sort((a, b) => b.points - a.points),
  });

  const system = `You are writing a gameweek match report for a private Premier League fantasy draft league's companion website. The audience is the ~10 people in the league, in a group-chat context — be confident, funny, and a bit cutting. Never be mean about anything outside the fantasy football. Reference specific players and specific stats from the data provided — never invent stats or results that aren't in the data. Mention the most important stat performances (goals, assists, clean sheets, cards) that decided the match.

Output:
- headline: a short, punchy one-liner for this match (not just "Team A beats Team B")
- body: two to four sentences of narrative recap, referencing specific players and stats
- stat_highlights: 2-4 short bullet-style strings, each citing a specific stat (e.g. "Haaland: 2 goals, 15.5 pts")`;

  const userPrompt = `Gameweek ${week} matchup.

Team A: ${JSON.stringify(describeTeam(teamA), null, 2)}

Team B: ${JSON.stringify(describeTeam(teamB), null, 2)}

Return JSON matching this exact shape:
{"headline": string, "body": string, "stat_highlights": string[]}`;

  return generateStructuredJson({
    client,
    system,
    userPrompt,
    schema: MatchReportResponseSchema,
  });
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

  const pairs = pairMatchupLegs(legs);
  console.log(`Found ${pairs.length} matchups.`);

  // Reuse any already-successful reports from a previous run of this same week, so a retry
  // (e.g. after topping up credits) only pays for the matchups that actually failed.
  const dataDir = resolve(__dirname, "../data/gameweeks");
  mkdirSync(dataDir, { recursive: true });
  const outPath = resolve(dataDir, `${league.season}-${week}.json`);
  const existingReportsByMatchupId = new Map<number, MatchReport>();
  if (existsSync(outPath)) {
    try {
      const existing = GameweekFileSchema.parse(JSON.parse(readFileSync(outPath, "utf-8")));
      for (const m of existing.matchups) {
        if (m.report) existingReportsByMatchupId.set(m.matchup_id, m.report);
      }
      console.log(`Found existing capture with ${existingReportsByMatchupId.size} report(s) already generated.`);
    } catch {
      // Corrupt existing file — proceed as if this is a fresh capture.
    }
  }

  // Report generation is best-effort: capturing scores/starters is time-sensitive and has
  // nothing to do with Anthropic API availability, so a credits/rate-limit failure on the AI
  // call must not block the core data from being written. Failed reports come back as null
  // and can be backfilled later by re-running this script with the same --week.
  let client: ReturnType<typeof getAnthropicClient> | null = null;
  try {
    client = getAnthropicClient();
  } catch (err) {
    console.warn(`AI reports unavailable: ${(err as Error).message}`);
  }

  let reportFailures = 0;
  const matchups: GameweekMatchup[] = [];

  for (const pair of pairs) {
    const teams = await Promise.all(
      pair.legs.map((leg) => buildTeam(leg, managerNameForRoster(leg.roster_id), weekStats))
    );

    let report: MatchReport | null = existingReportsByMatchupId.get(pair.matchup_id) ?? null;
    if (!report && teams.length === 2 && client) {
      console.log(`Generating report: ${teams[0].manager_name} vs ${teams[1].manager_name}...`);
      try {
        report = await generateReport(client, teams[0], teams[1], weekStats, week);
      } catch (err) {
        reportFailures++;
        console.warn(`Report generation failed for matchup ${pair.matchup_id}: ${(err as Error).message}`);
      }
    } else if (!report && teams.length !== 2) {
      console.log(`Matchup ${pair.matchup_id} has ${teams.length} team(s) — bye week, skipping report.`);
    }

    matchups.push({ matchup_id: pair.matchup_id, teams, report });
  }

  if (reportFailures > 0) {
    console.warn(
      `${reportFailures} of ${pairs.length} match reports failed to generate — captured with report: null. Re-run this script (same --week) once resolved to backfill them.`
    );
  }

  const file = GameweekFileSchema.parse({
    league_id: LEAGUE_ID,
    season: league.season,
    week,
    captured_at: new Date().toISOString(),
    matchups,
  });

  writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);

  const indexPath = resolve(dataDir, "index.json");
  let index = { league_id: LEAGUE_ID, season: league.season, captured_weeks: [] as number[] };
  if (existsSync(indexPath)) {
    try {
      const existing = GameweekIndexSchema.parse(JSON.parse(readFileSync(indexPath, "utf-8")));
      if (existing.season === league.season) index = existing;
    } catch {
      // Corrupt/mismatched index — rebuild from scratch for this season.
    }
  }
  if (!index.captured_weeks.includes(week)) index.captured_weeks.push(week);
  index.captured_weeks.sort((a, b) => a - b);
  writeFileSync(indexPath, JSON.stringify(GameweekIndexSchema.parse(index), null, 2) + "\n");
  console.log(`Updated ${indexPath}`);
}

main().catch((err) => {
  console.error("capture-gameweek failed:", err);
  process.exit(1);
});
