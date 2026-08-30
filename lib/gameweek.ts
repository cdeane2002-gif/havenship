import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  GameweekFileSchema,
  GameweekIndexSchema,
  type GameweekFile,
} from "./gameweek-schemas";

const GAMEWEEKS_DIR = join(process.cwd(), "data", "gameweeks");

/** Every season that has at least one captured gameweek — newest first is not guaranteed,
 * callers should sort if order matters. */
export function getAllSeasons(): string[] {
  const indexPath = join(GAMEWEEKS_DIR, "index.json");
  if (!existsSync(indexPath)) return [];
  try {
    const index = GameweekIndexSchema.parse(JSON.parse(readFileSync(indexPath, "utf-8")));
    return Object.keys(index.seasons);
  } catch {
    return [];
  }
}

export function getAvailableWeeks(season: string): number[] {
  const indexPath = join(GAMEWEEKS_DIR, "index.json");
  if (!existsSync(indexPath)) return [];
  try {
    const index = GameweekIndexSchema.parse(JSON.parse(readFileSync(indexPath, "utf-8")));
    return index.seasons[season] ?? [];
  } catch {
    return [];
  }
}

export function getGameweekData(season: string, week: number): GameweekFile | null {
  const path = join(GAMEWEEKS_DIR, `${season}-${week}.json`);
  if (!existsSync(path)) return null;
  try {
    return GameweekFileSchema.parse(JSON.parse(readFileSync(path, "utf-8")));
  } catch {
    return null;
  }
}

/** All captured weeks for a season, loaded in full — used by pages that need cross-week data
 * (e.g. Best XI defaults to the latest week, Results needs the list to build a week selector). */
export function getAllGameweekData(season: string): GameweekFile[] {
  return getAvailableWeeks(season)
    .map((week) => getGameweekData(season, week))
    .filter((f): f is GameweekFile => f !== null);
}

// Guards against an empty/missing directory (e.g. before the first capture has ever run).
export function gameweeksDirExists(): boolean {
  return existsSync(GAMEWEEKS_DIR) && readdirSync(GAMEWEEKS_DIR).length > 0;
}

/** Records a captured week against the shared index.json, across all seasons — used by both
 * the daily capture script and the historical backfill script so they share one index. */
export function recordCapturedWeek(leagueId: string, season: string, week: number): void {
  const indexPath = join(GAMEWEEKS_DIR, "index.json");
  let index: { league_id: string; seasons: Record<string, number[]> } = {
    league_id: leagueId,
    seasons: {},
  };
  if (existsSync(indexPath)) {
    try {
      index = GameweekIndexSchema.parse(JSON.parse(readFileSync(indexPath, "utf-8")));
    } catch {
      // Corrupt index — rebuild from scratch.
    }
  }
  const weeks = index.seasons[season] ?? [];
  if (!weeks.includes(week)) weeks.push(week);
  weeks.sort((a, b) => a - b);
  index.seasons[season] = weeks;
  writeFileSync(indexPath, JSON.stringify(GameweekIndexSchema.parse(index), null, 2) + "\n");
}
