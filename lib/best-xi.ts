import type { GameweekStarter, GameweekTeam } from "./gameweek-schemas";

export interface BestXICandidate extends GameweekStarter {
  roster_id: number;
  manager_name: string;
}

export interface BestXISlot {
  slot: string;
  label: string;
  candidate: BestXICandidate;
}

const SLOT_LABELS: Record<string, string> = {
  GK: "Goalkeeper",
  D: "Defender",
  M: "Midfielder",
  F: "Forward",
  FM_FLEX: "Flex (F/M)",
  MD_FLEX: "Flex (M/D)",
  FMD_FLEX: "Flex (F/M/D)",
};

/**
 * Picks the highest-scoring valid lineup across every team's starters that week, respecting
 * this league's actual roster shape (1 GK, 3 D, 3 M, 1 F, plus 3 flex slots). Processes
 * slots from least to most flexible (position-exclusive first, then 2-way flex, then 3-way
 * flex) so each pick never blocks a better later option — the standard greedy-exchange
 * ordering for this kind of superset-eligibility assignment problem.
 */
export function computeBestXI(teams: GameweekTeam[]): BestXISlot[] {
  const candidates: BestXICandidate[] = teams.flatMap((team) =>
    team.starters.map((s) => ({ ...s, roster_id: team.roster_id, manager_name: team.manager_name }))
  );

  const used = new Set<string>();
  const result: BestXISlot[] = [];

  function takeBest(pool: BestXICandidate[], slot: string) {
    const best = pool
      .filter((c) => !used.has(c.player_id))
      .sort((a, b) => b.points - a.points)[0];
    if (best) {
      used.add(best.player_id);
      result.push({ slot, label: SLOT_LABELS[slot], candidate: best });
    }
  }

  const byPos = (pos: string) => candidates.filter((c) => c.position === pos);

  takeBest(byPos("GK"), "GK");
  takeBest(byPos("D"), "D");
  takeBest(byPos("D"), "D");
  takeBest(byPos("D"), "D");
  takeBest(byPos("M"), "M");
  takeBest(byPos("M"), "M");
  takeBest(byPos("M"), "M");
  takeBest(byPos("F"), "F");

  takeBest(
    candidates.filter((c) => c.position === "F" || c.position === "M"),
    "FM_FLEX"
  );
  takeBest(
    candidates.filter((c) => c.position === "M" || c.position === "D"),
    "MD_FLEX"
  );
  takeBest(
    candidates.filter((c) => ["F", "M", "D"].includes(c.position)),
    "FMD_FLEX"
  );

  return result;
}
