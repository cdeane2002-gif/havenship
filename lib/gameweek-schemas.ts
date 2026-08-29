import { z } from "zod";

export const GameweekStarterSchema = z.object({
  player_id: z.string(),
  name: z.string(),
  position: z.string(), // the slot they actually started in this week: GK/D/M/F
  club: z.string(),
  points: z.number(),
});
export type GameweekStarter = z.infer<typeof GameweekStarterSchema>;

export const GameweekTeamSchema = z.object({
  roster_id: z.number(),
  manager_name: z.string(),
  points: z.number(),
  starters: z.array(GameweekStarterSchema),
});
export type GameweekTeam = z.infer<typeof GameweekTeamSchema>;

export const MatchReportSchema = z.object({
  headline: z.string(),
  body: z.string(),
  stat_highlights: z.array(z.string()),
});
export type MatchReport = z.infer<typeof MatchReportSchema>;

export const GameweekMatchupSchema = z.object({
  matchup_id: z.number(),
  teams: z.array(GameweekTeamSchema).min(1).max(2),
  report: MatchReportSchema.nullable(),
});
export type GameweekMatchup = z.infer<typeof GameweekMatchupSchema>;

export const GameweekFileSchema = z.object({
  league_id: z.string(),
  season: z.string(),
  week: z.number(),
  captured_at: z.string(),
  matchups: z.array(GameweekMatchupSchema),
});
export type GameweekFile = z.infer<typeof GameweekFileSchema>;

export const GameweekIndexSchema = z.object({
  league_id: z.string(),
  season: z.string(),
  captured_weeks: z.array(z.number()),
});
export type GameweekIndex = z.infer<typeof GameweekIndexSchema>;
