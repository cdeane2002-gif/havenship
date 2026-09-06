// House-rule chip tracking — Sleeper has no concept of this, so unlike everything else on
// this site it's not derived from Sleeper data at all. It's a small, manually-maintained
// record (data/time-machine.json), updated by hand whenever someone uses their chip. Keyed by
// roster_id (the stable identifier used everywhere else in this codebase), since a manager's
// team name/roster can change season to season but the chip allowance is theirs, not the
// team's.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface TimeMachineUse {
  used: boolean;
  season?: string;
  week?: number;
  swappedOutPlayer?: string;
  swappedInPlayer?: string;
}

export interface TimeMachineStatus {
  before19: TimeMachineUse;
  after19: TimeMachineUse;
}

const UNUSED: TimeMachineStatus = {
  before19: { used: false },
  after19: { used: false },
};

function readTimeMachineData(): Record<string, TimeMachineStatus> {
  const path = join(process.cwd(), "data", "time-machine.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

/** A roster's Time Machine chip status — one use allowed before GW19, one after. Any roster
 * not present in the data file simply hasn't used either yet. */
export function getTimeMachineStatus(rosterId: number): TimeMachineStatus {
  const data = readTimeMachineData();
  return data[String(rosterId)] ?? UNUSED;
}
