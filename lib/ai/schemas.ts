import { z } from "zod";

export const LETTER_GRADES = [
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
] as const;

export const DraftGradeSchema = z.object({
  roster_id: z.number(),
  manager_name: z.string(),
  grade: z.enum(LETTER_GRADES),
  summary: z.string().min(1),
  best_pick: z.object({
    player_name: z.string(),
    reason: z.string().min(1),
  }),
  worst_pick: z.object({
    player_name: z.string(),
    reason: z.string().min(1),
  }),
});
export type DraftGrade = z.infer<typeof DraftGradeSchema>;

export const DraftGradesResponseSchema = z.object({
  grades: z.array(DraftGradeSchema),
});
export type DraftGradesResponse = z.infer<typeof DraftGradesResponseSchema>;

export const DraftGradesFileSchema = z.object({
  generated_at: z.string(),
  league_id: z.string(),
  season: z.string(),
  draft_id: z.string(),
  draft_status: z.string(),
  grades: z.array(DraftGradeSchema),
});
export type DraftGradesFile = z.infer<typeof DraftGradesFileSchema>;

export const PowerRankingEntrySchema = z.object({
  rank: z.number().int().min(1),
  roster_id: z.number(),
  manager_name: z.string(),
  blurb: z.string().min(1),
  movement_note: z.string().nullable(),
});
export type PowerRankingEntry = z.infer<typeof PowerRankingEntrySchema>;

export const PowerRankingsResponseSchema = z.object({
  rankings: z.array(PowerRankingEntrySchema),
});
export type PowerRankingsResponse = z.infer<typeof PowerRankingsResponseSchema>;

export const PowerRankingsFileSchema = z.object({
  generated_at: z.string(),
  league_id: z.string(),
  season: z.string(),
  basis: z.enum(["preseason_draft", "in_season_form"]),
  rankings: z.array(PowerRankingEntrySchema),
});
export type PowerRankingsFile = z.infer<typeof PowerRankingsFileSchema>;
