// Sleeper's clubsoccer scoring_settings keys follow the pattern pos_<position>_<stat>.
// Only nfl is officially documented, so these labels were reverse-engineered from the
// abbreviations, the point-value patterns (e.g. clean sheet weighted GK 8 > D 6 > M 1 > F 0,
// which matches real-world position-weighted clean sheet scoring), and sibling families
// (pks/pkm/pkd sharing a "pk" prefix for penalty saved/missed/drawn). Anything not confidently
// identifiable is left untranslated and surfaced verbatim in the raw settings section instead
// of guessed at.

export const POSITION_LABELS: Record<string, string> = {
  gk: "Goalkeeper",
  d: "Defender",
  m: "Midfielder",
  f: "Forward",
};

export const POSITION_ORDER = ["gk", "d", "m", "f"];

export type StatCategory = "Attacking" | "Defending" | "Discipline & Errors";

export interface StatLabel {
  label: string;
  category: StatCategory;
}

export const STAT_LABELS: Record<string, StatLabel> = {
  g: { label: "Goal", category: "Attacking" },
  at: { label: "Assist", category: "Attacking" },
  sot: { label: "Shot on Target", category: "Attacking" },
  kp: { label: "Key Pass", category: "Attacking" },

  cs: { label: "Clean Sheet", category: "Defending" },
  cs90: { label: "Clean Sheet (pro-rated by minutes)", category: "Defending" },
  ga: { label: "Goal Conceded", category: "Defending" },
  sv: { label: "Save", category: "Defending" },
  pks: { label: "Penalty Saved", category: "Defending" },
  int: { label: "Interception", category: "Defending" },
  clr: { label: "Clearance", category: "Defending" },
  tkw: { label: "Tackle Won", category: "Defending" },
  bs: { label: "Blocked Shot", category: "Defending" },
  aer: { label: "Aerial Duel Won", category: "Defending" },

  yc: { label: "Yellow Card", category: "Discipline & Errors" },
  yc2: { label: "Second Yellow Card (Red)", category: "Discipline & Errors" },
  rc: { label: "Red Card", category: "Discipline & Errors" },
  og: { label: "Own Goal", category: "Discipline & Errors" },
  pkm: { label: "Penalty Missed", category: "Discipline & Errors" },
  pkd: { label: "Penalty Won", category: "Discipline & Errors" },
  dis: { label: "Dispossessed", category: "Discipline & Errors" },
  min: { label: "Minutes Played", category: "Discipline & Errors" },
};

export const CATEGORY_ORDER: StatCategory[] = ["Attacking", "Defending", "Discipline & Errors"];

export interface ParsedScoringKey {
  key: string;
  position: string;
  stat: string;
}

export function parseScoringKey(key: string): ParsedScoringKey | null {
  const match = key.match(/^pos_(gk|[fmd])_(.+)$/);
  if (!match) return null;
  return { key, position: match[1], stat: match[2] };
}

export interface ScoringMatrixRow {
  stat: string;
  label: string;
  category: StatCategory;
  valuesByPosition: Record<string, number | undefined>;
}

export function buildScoringMatrix(scoringSettings: Record<string, number>): {
  rows: ScoringMatrixRow[];
  rawKeys: { key: string; value: number }[];
} {
  const entries = Object.entries(scoringSettings)
    .map(([key, value]) => ({ parsed: parseScoringKey(key), value }))
    .filter((x): x is { parsed: ParsedScoringKey; value: number } => x.parsed !== null);

  const statsByCode = new Map<string, Record<string, number>>();
  const rawKeys: { key: string; value: number }[] = [];

  for (const { parsed, value } of entries) {
    const label = STAT_LABELS[parsed.stat];
    if (!label) {
      rawKeys.push({ key: parsed.key, value });
      continue;
    }
    if (!statsByCode.has(parsed.stat)) statsByCode.set(parsed.stat, {});
    statsByCode.get(parsed.stat)![parsed.position] = value;
  }

  const rows: ScoringMatrixRow[] = Array.from(statsByCode.entries()).map(([stat, valuesByPosition]) => ({
    stat,
    label: STAT_LABELS[stat].label,
    category: STAT_LABELS[stat].category,
    valuesByPosition,
  }));

  rows.sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.label.localeCompare(b.label);
  });

  rawKeys.sort((a, b) => a.key.localeCompare(b.key));

  return { rows, rawKeys };
}

export const ROSTER_SLOT_LABELS: Record<string, string> = {
  F: "Forward",
  M: "Midfielder",
  D: "Defender",
  GK: "Goalkeeper",
  FM_FLEX: "Flex (Forward / Midfielder)",
  MD_FLEX: "Flex (Midfielder / Defender)",
  FMD_FLEX: "Flex (Forward / Midfielder / Defender)",
  BN: "Bench",
};

export interface RosterSlotSummary {
  slot: string;
  label: string;
  count: number;
}

export function summarizeRosterPositions(rosterPositions: string[]): RosterSlotSummary[] {
  const counts = new Map<string, number>();
  for (const slot of rosterPositions) {
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  const order = ["GK", "D", "M", "F", "MD_FLEX", "FM_FLEX", "FMD_FLEX", "BN"];
  return Array.from(counts.entries())
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([slot, count]) => ({
      slot,
      label: ROSTER_SLOT_LABELS[slot] ?? slot,
      count,
    }));
}

// League-level settings worth surfacing in plain English. Everything else in league.settings
// goes into the raw section — several fields (waiver_type, playoff_type, playoff_seed_type,
// playoff_round_type, and the various waiver day/time enums) depend on numeric codes that
// aren't documented for this sport, so we don't guess at their meaning.
export interface LeagueSettingLabel {
  key: string;
  label: string;
  format: (value: number) => string;
}

export const LEAGUE_SETTING_LABELS: LeagueSettingLabel[] = [
  { key: "num_teams", label: "Number of Teams", format: (v) => String(v) },
  { key: "playoff_teams", label: "Playoff Teams", format: (v) => String(v) },
  { key: "playoff_week_start", label: "Playoffs Start", format: (v) => `Gameweek ${v}` },
  { key: "start_week", label: "Season Start", format: (v) => `Gameweek ${v}` },
  { key: "reserve_slots", label: "Reserve / IR Slots", format: (v) => String(v) },
  { key: "waiver_budget", label: "Waiver Budget (FAAB)", format: (v) => `$${v}` },
  {
    key: "trade_deadline",
    label: "Trade Deadline",
    format: (v) => (v >= 39 ? "None (no deadline this season)" : `Gameweek ${v}`),
  },
  {
    key: "pick_trading",
    label: "Draft Pick Trading",
    format: (v) => (v ? "Enabled" : "Disabled"),
  },
  {
    key: "daily_waivers",
    label: "Daily Waivers",
    format: (v) => (v ? "Enabled" : "Disabled (weekly waivers)"),
  },
];
