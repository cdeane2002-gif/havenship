import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDraftPicks, getLeagueSeasonChain } from "./sleeper";

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
 * Like buildPlayerDictionary, but also resolves player_ids not covered by any draft pick
 * using the local data/players.json fallback. Only use where broader coverage matters (e.g.
 * the Transfers page), not on every page.
 */
export async function buildPlayerDictionaryWithFallback(
  leagueId: string,
  unresolvedIds: string[]
): Promise<Map<string, PlayerInfo>> {
  const dict = await buildPlayerDictionary(leagueId);
  const stillMissing = unresolvedIds.filter((id) => !dict.has(id));
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
