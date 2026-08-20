// Types derived from real Sleeper API responses probed against league 1389372609086382080.
// Do not add fields that weren't observed in the probe output — Sleeper's clubsoccer/EPL
// support isn't officially documented, only NFL is, so undocumented fields are unverifiable.

export interface SleeperLeagueSettings {
  num_teams: number;
  playoff_teams: number;
  playoff_week_start: number;
  start_week: number;
  trade_deadline: number;
  waiver_type: number;
  waiver_budget: number;
  reserve_slots: number;
  [key: string]: number;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  status: "drafting" | "in_season" | "complete" | "pre_draft" | (string & {});
  season: string;
  season_type: string;
  sport: string;
  avatar: string | null;
  draft_id: string | null;
  previous_league_id: string | null;
  total_rosters: number;
  roster_positions: string[];
  settings: SleeperLeagueSettings;
  scoring_settings: Record<string, number>;
  metadata: Record<string, string> | null;
}

export interface SleeperRosterSettings {
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  ppts?: number;
  ppts_decimal?: number;
  total_moves: number;
  waiver_position: number;
  waiver_budget_used: number;
}

export interface SleeperRoster {
  roster_id: number;
  league_id: string;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  settings: SleeperRosterSettings;
  metadata: {
    record?: string; // per-week W/L/T string, e.g. "WWLLWLWWW..."
    streak?: string; // e.g. "1W", "3L"
    formation?: string; // JSON-encoded map of week -> formation string
    [key: string]: string | undefined; // includes p_nick_<player_id> custom nicknames
  } | null;
}

export interface SleeperUser {
  user_id: string;
  league_id: string;
  display_name: string;
  avatar: string | null;
  is_owner: boolean | null;
  is_bot: boolean;
  metadata: {
    team_name?: string;
    avatar?: string; // custom avatar URL override
    [key: string]: string | undefined;
  } | null;
}

export interface SleeperDraftSettings {
  rounds: number;
  teams: number;
  slots_bn: number;
  slots_gk: number;
  slots_d: number;
  slots_m: number;
  slots_f: number;
  slots_fm_flex: number;
  slots_md_flex: number;
  slots_fmd_flex: number;
  pick_timer: number;
  nomination_timer: number;
  [key: string]: number;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  season_type: string;
  sport: string;
  status: "pre_draft" | "drafting" | "complete" | (string & {});
  type: string; // "snake"
  start_time: number | null;
  created: number;
  draft_order: Record<string, number> | null; // user_id -> draft slot
  slot_to_roster_id: Record<string, number> | null;
  settings: SleeperDraftSettings;
  metadata: {
    name?: string;
    description?: string;
    scoring_type?: string;
    league_type?: string;
    show_team_names?: string;
  } | null;
}

export interface SleeperDraftPickMetadata {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string; // "F" | "M" | "D" | "GK"
  team: string; // numeric club id as string
  team_abbr: string; // e.g. "MCI"
  status: string; // "A" active, etc.
  injury_status: string;
  number: string;
  years_exp: string;
  sport: string;
  news_updated: string;
  team_changed_at: string;
}

export interface SleeperDraftPick {
  draft_id: string;
  round: number;
  pick_no: number;
  draft_slot: number;
  roster_id: number;
  picked_by: string; // user_id
  player_id: string;
  is_keeper: boolean | null;
  metadata: SleeperDraftPickMetadata;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: "waiver" | "free_agent" | "trade" | (string & {});
  status: string;
  leg: number;
  creator: string;
  created: number;
  status_updated: number;
  roster_ids: number[];
  consenter_ids: number[];
  adds: Record<string, number> | null; // player_id -> roster_id
  drops: Record<string, number> | null; // player_id -> roster_id
  draft_picks: unknown[];
  metadata: { notes?: string } | null;
  settings: { seq?: number } | null;
}

// Resolved identity of a player, built at build-time from draft-pick metadata
// (authoritative) with an FPL bootstrap-static fallback. See scripts/build-player-dictionary.ts.
export interface PlayerIdentity {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team_abbr: string;
  source: "draft_pick" | "fpl_fallback" | "manual_override";
}
