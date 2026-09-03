import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDraftPicks, getLeagueSeasonChain } from "./sleeper";
import { getPlayerBySport } from "./sleeper-graphql";
import { getAllSeasons, getAllGameweekData } from "./gameweek";

export interface PlayerInfo {
  name: string;
  position: string;
  club: string;
}

interface LocalDictEntry {
  first_name: string;
  last_name: string;
  position: string;
  team_abbr: string;
}

/**
 * data/players.json is a local, pre-filtered copy of Sleeper's public /players/clubsoccer
 * dictionary (see scripts/build-player-dictionary.ts). Built locally instead of live-fetched
 * because the raw payload is ~25MB — over Next.js's 2MB Data Cache item limit, so an
 * in-request fetch can't be cached and re-downloads on every cache miss (observed: 5-15s
 * page loads). Refreshed at most once a day via the same GitHub Actions workflow as the
 * gameweek capture. Falls back to an empty dict if the script has never been run.
 */
function readLocalPlayerDictionary(): Record<string, LocalDictEntry> {
  const path = join(process.cwd(), "data", "players.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Player_id -> identity. Primary source is every draft pick across every season in the
 * league's history — self-contained and reliable (a snapshot from draft time). Falls back to
 * Sleeper's public dictionary for players never drafted (pure waiver-wire pickups). An id
 * resolved by neither source should display as "Player #<id>" rather than guessed at.
 */
export async function buildPlayerDictionary(leagueId: string): Promise<Map<string, PlayerInfo>> {
  const seasons = await getLeagueSeasonChain(leagueId);
  const dict = new Map<string, PlayerInfo>();

  for (const { league } of seasons) {
    if (!league.draft_id) continue;
    const picks = await getDraftPicks(league.draft_id);
    for (const p of picks) {
      dict.set(p.player_id, {
        name: `${p.metadata.first_name} ${p.metadata.last_name}`.trim(),
        position: p.metadata.position,
        club: p.metadata.team_abbr,
      });
    }
  }

  return dict;
}

/**
 * Every player_id that has ever started in a captured gameweek, with the name/position/club
 * Sleeper's own authenticated player_map reported at capture time (see gameweek-builder.ts) —
 * unaffected by the public dictionary's ID collisions since it comes from a different,
 * sport-scoped source. Covers anyone who's actually played, drafted or not, as soon as
 * they've started at least once. Free to build — reads already-committed local files, no
 * network call.
 */
function buildDictionaryFromCapturedStarters(): Map<string, PlayerInfo> {
  const dict = new Map<string, PlayerInfo>();
  for (const season of getAllSeasons()) {
    for (const gw of getAllGameweekData(season)) {
      for (const matchup of gw.matchups) {
        for (const team of matchup.teams) {
          for (const starter of team.starters) {
            dict.set(starter.player_id, {
              name: starter.name,
              position: starter.position,
              club: starter.club,
            });
          }
        }
      }
    }
  }
  return dict;
}

/**
 * Like buildPlayerDictionary, but also resolves player_ids not covered by any draft pick.
 * Layered fallback, cheapest/most reliable first: captured gameweek starters (free, and
 * immune to the public dictionary's ID collisions — see sleeper-graphql.ts's getPlayerBySport)
 * → a live sport-scoped GraphQL lookup per still-missing id (handles a very recent
 * waiver/free-agent pickup who's never started yet) → the local, pre-filtered copy of
 * Sleeper's public dictionary as a last resort if the auth token is unavailable. Only use
 * where broader coverage matters (e.g. the Transfers page), not on every page.
 */
export async function buildPlayerDictionaryWithFallback(
  leagueId: string,
  unresolvedIds: string[]
): Promise<Map<string, PlayerInfo>> {
  const dict = await buildPlayerDictionary(leagueId);
  let stillMissing = unresolvedIds.filter((id) => !dict.has(id));
  if (stillMissing.length === 0) return dict;

  const capturedDict = buildDictionaryFromCapturedStarters();
  for (const id of stillMissing) {
    const entry = capturedDict.get(id);
    if (entry) dict.set(id, entry);
  }
  stillMissing = stillMissing.filter((id) => !dict.has(id));
  if (stillMissing.length === 0) return dict;

  const sportLookups = await Promise.all(
    stillMissing.map(async (id) => [id, await getPlayerBySport(id)] as const)
  );
  for (const [id, info] of sportLookups) {
    if (info) dict.set(id, info);
  }
  stillMissing = stillMissing.filter((id) => !dict.has(id));
  if (stillMissing.length === 0) return dict;

  const localDict = readLocalPlayerDictionary();
  for (const id of stillMissing) {
    const entry = localDict[id];
    if (!entry) continue;
    dict.set(id, {
      name: `${entry.first_name} ${entry.last_name}`.trim(),
      position: entry.position,
      club: entry.team_abbr,
    });
  }

  return dict;
}
