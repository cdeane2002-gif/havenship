// Throwaway probe script. Hits the Sleeper API and saves raw JSON to ./.probe/
// Run with: node scripts/probe.mjs
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LEAGUE_ID = "1389372609086382080";
const BASE = "https://api.sleeper.app/v1";
const OUT_DIR = path.resolve("./.probe");

async function fetchJson(url) {
  const res = await fetch(url);
  const status = res.status;
  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => null);
  }
  return { status, body };
}

async function probe(name, url) {
  console.log(`Fetching ${url} ...`);
  const { status, body } = await fetchJson(url);
  await writeFile(
    path.join(OUT_DIR, `${name}.json`),
    JSON.stringify({ url, status, body }, null, 2)
  );
  console.log(`  -> ${status} saved to .probe/${name}.json`);
  return { status, body };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Chain league history via previous_league_id first (need it for season count)
  const leagueChain = [];
  let currentId = LEAGUE_ID;
  let hop = 0;
  while (currentId && hop < 20) {
    const name = hop === 0 ? "league" : `league_prev_${hop}`;
    const { status, body } = await probe(name, `${BASE}/league/${currentId}`);
    leagueChain.push({ id: currentId, status, season: body?.season, previous_league_id: body?.previous_league_id });
    if (status !== 200 || !body?.previous_league_id) break;
    currentId = body.previous_league_id;
    hop++;
  }
  await writeFile(
    path.join(OUT_DIR, "league_chain_summary.json"),
    JSON.stringify(leagueChain, null, 2)
  );

  await probe("rosters", `${BASE}/league/${LEAGUE_ID}/rosters`);
  await probe("users", `${BASE}/league/${LEAGUE_ID}/users`);
  await probe("matchups_week1", `${BASE}/league/${LEAGUE_ID}/matchups/1`);
  await probe("matchups_week5", `${BASE}/league/${LEAGUE_ID}/matchups/5`);
  await probe("matchups_week10", `${BASE}/league/${LEAGUE_ID}/matchups/10`);
  await probe("transactions_week1", `${BASE}/league/${LEAGUE_ID}/transactions/1`);
  const draftsResult = await probe("drafts", `${BASE}/league/${LEAGUE_ID}/drafts`);

  const draftId = Array.isArray(draftsResult.body) && draftsResult.body[0]?.draft_id;
  if (draftId) {
    await probe("draft_detail", `${BASE}/draft/${draftId}`);
    await probe("draft_picks", `${BASE}/draft/${draftId}/picks`);
  } else {
    console.log("No draft_id found in /drafts response, skipping draft detail/picks probes.");
  }

  // Player dictionary sport-key probing
  const sportKeys = ["epl", "soccer", "clubsoccer", "pl", "epl1"];
  for (const key of sportKeys) {
    const url = `${BASE}/players/${key}`;
    console.log(`Fetching ${url} ...`);
    const res = await fetch(url);
    const status = res.status;
    if (status !== 200) {
      await writeFile(path.join(OUT_DIR, `players_${key}.json`), JSON.stringify({ url, status }, null, 2));
      console.log(`  -> ${status} (not saving body)`);
      continue;
    }
    const body = await res.json();
    const keys = Object.keys(body);
    const sampleKeys = keys.slice(0, 3);
    const sample = {};
    for (const k of sampleKeys) sample[k] = body[k];
    await writeFile(
      path.join(OUT_DIR, `players_${key}_sample.json`),
      JSON.stringify({ url, status, totalPlayers: keys.length, sample }, null, 2)
    );
    console.log(`  -> ${status} saved sample to .probe/players_${key}_sample.json (${keys.length} total players)`);
  }

  // FPL bootstrap-static fallback
  console.log("Fetching FPL bootstrap-static ...");
  const fplRes = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const fplStatus = fplRes.status;
  if (fplStatus === 200) {
    const fplBody = await fplRes.json();
    const elementsSample = fplBody.elements?.slice(0, 5);
    const teamsSample = fplBody.teams?.slice(0, 5);
    await writeFile(
      path.join(OUT_DIR, "fpl_bootstrap_sample.json"),
      JSON.stringify(
        {
          status: fplStatus,
          totalElements: fplBody.elements?.length,
          totalTeams: fplBody.teams?.length,
          elementsSample,
          teamsSample,
        },
        null,
        2
      )
    );
    // Save full elements list separately (needed for matching later) but not teams/etc
    await writeFile(
      path.join(OUT_DIR, "fpl_elements_full.json"),
      JSON.stringify(fplBody.elements, null, 2)
    );
    console.log(`  -> ${fplStatus} saved sample + full elements to .probe/`);
  } else {
    console.log(`  -> ${fplStatus} FPL bootstrap-static failed`);
  }

  console.log("\nDone. See ./.probe/ for raw JSON.");
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
