// Builds data/players.json: a trimmed, corruption-filtered copy of Sleeper's public
// /players/clubsoccer dictionary, used as a fallback for player_ids the draft-pick
// dictionary doesn't cover (pure waiver-wire pickups never drafted).
//
// Run manually or on a schedule: npm run dict:build
//
// Why this exists instead of live-fetching on every request: the raw payload is ~25MB,
// which exceeds Next.js's 2MB Data Cache item limit, so an in-request fetch silently can't
// be cached and re-downloads the full file on every cache miss (observed: 5-15s page loads
// on /transfers). A local file read is instant. Per the original plan, refresh at most once
// a day — it's wired into the same daily GitHub Actions workflow as the gameweek capture.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface RawPlayer {
  first_name?: string;
  last_name?: string;
  position?: string;
  team_abbr?: string;
}

async function main() {
  console.log("Fetching Sleeper's public clubsoccer player dictionary...");
  const res = await fetch("https://api.sleeper.app/v1/players/clubsoccer");
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const raw = (await res.json()) as Record<string, RawPlayer>;

  const total = Object.keys(raw).length;
  console.log(`Fetched ${total} entries. Filtering out corrupted stub entries...`);

  // Known corruption signature (see step-0 probe + 2026-08-29 Transfers page investigation):
  // MLS/other-league club stub entries leak in with no team_abbr at all. A real player
  // always has one.
  const trimmed: Record<string, { first_name: string; last_name: string; position: string; team_abbr: string }> = {};
  let kept = 0;
  for (const [id, p] of Object.entries(raw)) {
    if (!p.team_abbr || !p.first_name || !p.last_name || !p.position) continue;
    trimmed[id] = {
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position,
      team_abbr: p.team_abbr,
    };
    kept++;
  }
  console.log(`Kept ${kept}/${total} entries (${total - kept} filtered as corrupted/incomplete).`);

  const outPath = resolve(__dirname, "../data/players.json");
  writeFileSync(outPath, JSON.stringify(trimmed) + "\n");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error("build-player-dictionary failed:", err);
  process.exit(1);
});
