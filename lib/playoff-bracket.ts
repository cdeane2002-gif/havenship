import type { BracketMatch } from "./sleeper-graphql";

export interface ResolvedBracketMatch {
  matchNumber: number;
  round: number;
  roundLabel: string;
  team1Label: string;
  team2Label: string;
  winnerLabel: string | null;
}

function roundLabel(match: BracketMatch): string {
  if (match.p === 1) return "Championship";
  if (match.p === 3) return "3rd Place";
  if (match.p === 5) return "5th Place";
  return `Round ${match.r}`;
}

function slotLabel(
  teamId: number | null,
  from: { w?: number; l?: number } | undefined,
  managerNameForRoster: (rosterId: number) => string
): string {
  if (teamId !== null) return managerNameForRoster(teamId);
  if (from?.w) return `Winner of Match ${from.w}`;
  if (from?.l) return `Loser of Match ${from.l}`;
  return "TBD";
}

export function resolveBracket(
  matches: BracketMatch[],
  managerNameForRoster: (rosterId: number) => string
): ResolvedBracketMatch[] {
  return [...matches]
    .sort((a, b) => a.m - b.m)
    .map((match) => ({
      matchNumber: match.m,
      round: match.r,
      roundLabel: roundLabel(match),
      team1Label: slotLabel(match.t1, match.t1_from, managerNameForRoster),
      team2Label: slotLabel(match.t2, match.t2_from, managerNameForRoster),
      winnerLabel: match.w !== null ? managerNameForRoster(match.w) : null,
    }));
}
