// Generates data/power-rankings.json. Run manually: npm run rankings:generate
//
// Basis depends on whether the season has started:
//  - preseason_draft: before any gameweek is played, "form" doesn't exist yet, so rankings
//    are based on roster construction/draft value instead. Current rosters are derived from
//    draft picks grouped by roster_id rather than roster.players, because Sleeper leaves
//    roster.players null until the draft fully completes — but since zero transactions have
//    happened this season (confirmed via the transactions endpoint), draft picks so far ARE
//    the complete, accurate roster.
//  - in_season_form: once matchup data exists, this should be rebuilt to use actual recent
//    results/scores instead. Not implemented yet — see lib/sleeper.ts getMatchups().
//
// If data/power-rankings.json already exists for the same league/season, it's passed to the
// model as "last week's rankings" so it can write real movement notes instead of guessing.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LEAGUE_ID,
  getDraft,
  getDraftPicks,
  getLeague,
  getRosters,
  getUsers,
  teamNameForUser,
} from "../lib/sleeper";
import { fetchFplData, matchFplElement } from "../lib/player-value";
import { getAnthropicClient, generateStructuredJson } from "../lib/ai/client";
import { PowerRankingsFileSchema, PowerRankingsResponseSchema } from "../lib/ai/schemas";

async function main() {
  console.log("Fetching league data...");
  const league = await getLeague(LEAGUE_ID);
  if (!league?.draft_id) throw new Error("League has no draft_id.");

  const [draft, picks, users, rosters] = await Promise.all([
    getDraft(league.draft_id),
    getDraftPicks(league.draft_id),
    getUsers(LEAGUE_ID),
    getRosters(LEAGUE_ID),
  ]);
  if (!draft) throw new Error("Could not load draft.");
  if (picks.length === 0) throw new Error("Draft has no picks yet — nothing to rank.");

  console.log(`Fetched ${picks.length} picks. Fetching FPL data for value context...`);
  const fpl = await fetchFplData();

  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));

  const picksByRoster = new Map<number, typeof picks>();
  for (const pick of picks) {
    const list = picksByRoster.get(pick.roster_id) ?? [];
    list.push(pick);
    picksByRoster.set(pick.roster_id, list);
  }

  const teamSummaries = Array.from(picksByRoster.entries()).map(([rosterId, rosterPicks]) => {
    const roster = rostersById.get(rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : null;
    const managerName = user ? teamNameForUser(user) : `Roster ${rosterId}`;

    const sorted = [...rosterPicks].sort((a, b) => a.pick_no - b.pick_no);
    const players = sorted.map((pick) => {
      const match = matchFplElement(pick, fpl);
      return {
        player: `${pick.metadata.first_name} ${pick.metadata.last_name}`,
        position: pick.metadata.position,
        club: pick.metadata.team_abbr,
        round: pick.round,
        pick_no: pick.pick_no,
        fpl_price_million: match ? match.element.now_cost / 10 : null,
        fpl_last_season_points: match ? match.element.total_points : null,
      };
    });

    return {
      roster_id: rosterId,
      manager_name: managerName,
      picks_so_far: players.length,
      players,
    };
  });

  const dataDir = resolve(__dirname, "../data");
  const outPath = resolve(dataDir, "power-rankings.json");

  let previousRankingsContext: string | null = null;
  if (existsSync(outPath)) {
    try {
      const prev = JSON.parse(readFileSync(outPath, "utf-8"));
      if (prev.league_id === LEAGUE_ID && prev.season === league.season) {
        previousRankingsContext = JSON.stringify(prev.rankings, null, 2);
      }
    } catch {
      // Ignore unreadable/corrupt previous file — proceed without movement context.
    }
  }

  const draftComplete = draft.status === "complete";
  const basis: "preseason_draft" | "in_season_form" = "preseason_draft";

  const system = `You are writing AI power rankings for a private Premier League fantasy draft league's companion website. The audience is the ~10 people in the league, in a group-chat context — be confident, funny, and a bit cutting. Never be mean about anything outside the fantasy football. The ${league.season} season has not started yet (kicks off 2026-08-21), so there is no in-season form or results to reference — do not invent match results, scores, or "recent form" that doesn't exist. Instead, rank teams by expected strength based on their draft: positional balance, last season's FPL output for their players, and value relative to draft position. Mention actual player names and specifics from the data — a ranking that could apply to any league is useless.

For each team, output:
- rank: 1 (strongest) through the number of teams
- blurb: one paragraph, mentioning specific players and why they matter to this team's outlook
- movement_note: a one-line reason ONLY if you were given a previous ranking and this team moved meaningfully; otherwise null`;

  const userPrompt = `League: ${league.name}, ${league.season} season, ${draft.settings.teams} teams.
Draft status: ${draft.status}${draftComplete ? " (draft finished)" : ` (${picks.length} of ${draft.settings.rounds * draft.settings.teams} picks made — some teams' rosters are still incomplete)`}.

Team data (JSON):
${JSON.stringify(teamSummaries, null, 2)}

${
  previousRankingsContext
    ? `Previous rankings (for movement_note comparisons):\n${previousRankingsContext}`
    : "No previous rankings exist yet — this is the first run, so movement_note should be null for every team."
}

Return JSON matching this exact shape:
{"rankings": [{"rank": number, "roster_id": number, "manager_name": string, "blurb": string, "movement_note": string | null}]}

Include exactly one entry per team listed above, ranked 1 to ${teamSummaries.length}.`;

  console.log("Calling Claude for power rankings...");
  const client = getAnthropicClient();
  const result = await generateStructuredJson({
    client,
    system,
    userPrompt,
    schema: PowerRankingsResponseSchema,
  });

  const file = PowerRankingsFileSchema.parse({
    generated_at: new Date().toISOString(),
    league_id: LEAGUE_ID,
    season: league.season,
    basis,
    rankings: result.rankings,
  });

  writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`Wrote ${result.rankings.length} rankings to ${outPath}`);
}

main().catch((err) => {
  console.error("generate-power-rankings failed:", err);
  process.exit(1);
});
