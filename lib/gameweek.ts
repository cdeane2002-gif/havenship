import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  GameweekFileSchema,
  GameweekIndexSchema,
  type GameweekFile,
} from "./gameweek-schemas";

const GAMEWEEKS_DIR = join(process.cwd(), "data", "gameweeks");

export function getAvailableWeeks(season: string): number[] {
  const indexPath = join(GAMEWEEKS_DIR, "index.json");
  if (!existsSync(indexPath)) return [];
  try {
    const index = GameweekIndexSchema.parse(JSON.parse(readFileSync(indexPath, "utf-8")));
    if (index.season !== season) return [];
    return index.captured_weeks;
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
