// Per-gameweek scoring breakdown for a single player, built the same way Sleeper itself
// must: raw per-player stats (lib/sleeper.ts's getPlayerStatsForWeek) are keyed by
// position-prefixed codes ("pos_d_g", "pos_gk_cs", ...) that line up 1:1 with the league's
// scoring_settings. Multiplying each present stat by its scoring weight and summing reproduces
// pts_std exactly (verified against live data during development) — so this is the actual
// scoring math, not a guess, even though the stat codes themselves are undocumented and their
// English labels below are a best-effort reading of Sleeper's internal abbreviations.

import { getPlayerStatsForWeek } from "./sleeper";

export interface StatContribution {
  code: string;
  label: string;
  count: number;
  pointsPerUnit: number;
  points: number;
}

// Codes are stored with a position prefix (pos_<gk|d|m|f>_<code>) — stripped before lookup,
// since the same code means the same thing regardless of position, just weighted differently.
const STAT_LABELS: Record<string, string> = {
  g: "Goal",
  at: "Assist",
  cs: "Clean Sheet",
  hcs: "Half Clean Sheet",
  ga: "Goal Conceded",
  sv: "Save",
  pks: "Penalty Scored",
  pkm: "Penalty Missed",
  pkd: "Penalty Won",
  og: "Own Goal",
  yc: "Yellow Card",
  yc2: "Second Yellow",
  rc: "Red Card",
  bs: "Blocked Shot",
  sot: "Shot on Target",
  kp: "Key Pass",
  clr: "Clearance",
  int: "Interception",
  tkw: "Tackle Won",
  aer: "Aerial Won",
  cos: "Accurate Cross",
  acnc: "Accurate Long Ball",
  sm: "Save Made",
  dis: "Dispossessed",
};

function labelFor(code: string): string {
  return STAT_LABELS[code] ?? code.toUpperCase();
}

export async function getPointsBreakdown(
  season: string,
  week: number,
  playerId: string,
  scoringSettings: Record<string, number>
): Promise<StatContribution[]> {
  const weekStats = await getPlayerStatsForWeek(season, week);
  const raw = weekStats[playerId];
  if (!raw) return [];

  const contributions: StatContribution[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("pos_")) continue;
    const weight = scoringSettings[key];
    if (!weight) continue;

    const points = value * weight;
    if (points === 0) continue;

    const code = key.replace(/^pos_(gk|d|m|f)_/, "");
    contributions.push({ code, label: labelFor(code), count: value, pointsPerUnit: weight, points });
  }

  contributions.sort((a, b) => b.points - a.points);
  return contributions;
}
