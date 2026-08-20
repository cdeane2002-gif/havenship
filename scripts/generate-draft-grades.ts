// Generates data/draft-grades.json from the current season's draft.
// Run manually: npm run grades:generate
//
// Grades are based on positional balance, value relative to draft position (using FPL price
// as a value benchmark), and last season's FPL output as context for returning players. The
// 2026 season hasn't kicked off yet (starts 2026-08-21), so there is no "how picks have
// performed this season" signal yet — the prompt is explicit about that and leans on last
// season's numbers plus draft value instead. Re-run this script once games are played to get
// grades that actually reflect in-season performance.

import { writeFileSync } from "node:fs";
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
import { DraftGradesFileSchema, DraftGradesResponseSchema } from "../lib/ai/schemas";

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
  if (picks.length === 0) throw new Error("Draft has no picks yet — nothing to grade.");

  console.log(`Fetched ${picks.length} picks. Fetching FPL data for value context...`);
  const fpl = await fetchFplData();

  let matched = 0;
  const enrichedPicks = picks.map((pick) => {
    const match = matchFplElement(pick, fpl);
    if (match) matched++;
    return {
      pick,
      fpl: match
        ? {
            price_million: match.element.now_cost / 10,
            last_season_points: match.element.total_points,
            last_season_goals: match.element.goals_scored,
            last_season_assists: match.element.assists,
            selected_by_percent: match.element.selected_by_percent,
            match_confidence: match.confidence,
          }
        : null,
    };
  });
  console.log(`Matched ${matched}/${picks.length} picks to FPL value data.`);

  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));

  const picksByRoster = new Map<number, typeof enrichedPicks>();
  for (const entry of enrichedPicks) {
    const list = picksByRoster.get(entry.pick.roster_id) ?? [];
    list.push(entry);
    picksByRoster.set(entry.pick.roster_id, list);
  }

  const managerSummaries = Array.from(picksByRoster.entries()).map(([rosterId, entries]) => {
    const roster = rostersById.get(rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : null;
    const managerName = user ? teamNameForUser(user) : `Roster ${rosterId}`;

    const sortedPicks = [...entries].sort((a, b) => a.pick.pick_no - b.pick.pick_no);
    const positionCounts: Record<string, number> = {};
    for (const { pick } of sortedPicks) {
      positionCounts[pick.metadata.position] = (positionCounts[pick.metadata.position] ?? 0) + 1;
    }

    return {
      roster_id: rosterId,
      manager_name: managerName,
      required_positions: "1 GK, 3 D, 3 M, 1 F, plus 3 flex (FM/MD/FMD) and 6 bench",
      drafted_position_counts: positionCounts,
      picks: sortedPicks.map(({ pick, fpl: fplData }) => ({
        round: pick.round,
        pick_no: pick.pick_no,
        player: `${pick.metadata.first_name} ${pick.metadata.last_name}`,
        position: pick.metadata.position,
        club: pick.metadata.team_abbr,
        fpl_price_million: fplData?.price_million ?? null,
        fpl_last_season_points: fplData?.last_season_points ?? null,
        fpl_last_season_goals: fplData?.last_season_goals ?? null,
        fpl_last_season_assists: fplData?.last_season_assists ?? null,
        fpl_selected_by_percent: fplData?.selected_by_percent ?? null,
      })),
    };
  });

  const draftComplete = draft.status === "complete";
  const totalSlots = draft.settings.rounds * draft.settings.teams;

  const system = `You are writing draft grades for a private Premier League fantasy draft league's companion website. The audience is the ~10 people in the league themselves, in a group-chat context — be confident, funny, and a bit cutting. Never be mean about anything outside the fantasy football (no comments on real players' personal lives beyond form/performance, nothing about the managers themselves as people). You are an expert at analyzing Fantasy Premier League (FPL) draft value: FPL price (in £m) is a reasonable proxy for a player's consensus value, and last season's FPL points/goals/assists are the best available signal for a player's expected output, since ${league.season} season has not started yet (kicks off 2026-08-21) — there is no in-season performance data at all yet. Do not invent stats or results that aren't in the data provided.

For each manager, output:
- grade: a letter grade (A+ through F) for the whole draft
- summary: exactly two sentences of reasoning covering positional balance and value relative to where players went
- best_pick: the single best value pick (name + one-line reason, referencing price/round/last-season output)
- worst_pick: the single worst value pick (name + one-line reason) — if a manager's draft was genuinely strong throughout, the "worst" pick can just be their weakest relative value, it doesn't need to be a bad pick`;

  const userPrompt = `League: ${league.name}, ${league.season} season.
Draft status: ${draft.status}${draftComplete ? "" : ` (${picks.length} of ${totalSlots} picks made so far — grade only on what's been drafted)`}.
Roster requirement per team: 1 Goalkeeper, 3 Defenders, 3 Midfielders, 1 Forward starters, plus 3 flex slots (Forward/Midfielder, Midfielder/Defender, and any-outfield) and 6 bench spots — 17 total picks per team.

Manager draft data (JSON):
${JSON.stringify(managerSummaries, null, 2)}

Return JSON matching this exact shape:
{"grades": [{"roster_id": number, "manager_name": string, "grade": string, "summary": string, "best_pick": {"player_name": string, "reason": string}, "worst_pick": {"player_name": string, "reason": string}}]}

Include one entry per manager listed above.`;

  console.log("Calling Claude for draft grades...");
  const client = getAnthropicClient();
  const result = await generateStructuredJson({
    client,
    system,
    userPrompt,
    schema: DraftGradesResponseSchema,
  });

  const file = DraftGradesFileSchema.parse({
    generated_at: new Date().toISOString(),
    league_id: LEAGUE_ID,
    season: league.season,
    draft_id: draft.draft_id,
    draft_status: draft.status,
    grades: result.grades,
  });

  const outPath = resolve(__dirname, "../data/draft-grades.json");
  writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`Wrote ${result.grades.length} grades to ${outPath}`);
}

main().catch((err) => {
  console.error("generate-draft-grades failed:", err);
  process.exit(1);
});
