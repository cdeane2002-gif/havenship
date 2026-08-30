// Enriches a Sleeper draft pick with FPL bootstrap-static data (price, last-season output).
// This is context for the AI scripts (draft grades / power rankings), not for name resolution —
// draft pick metadata (first_name/last_name/position/team_abbr) is already authoritative for
// identity. See the step-0 probe notes: Sleeper's own /players/clubsoccer dictionary is NOT
// used anywhere in this app because it resolves ~13% of real players to unrelated MLS stub
// entities.

export interface FplElement {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  now_cost: number; // tenths of a million, e.g. 130 = £13.0m
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  selected_by_percent: string;
}

export interface FplTeam {
  id: number;
  short_name: string;
}

export interface FplData {
  elements: FplElement[];
  teams: FplTeam[];
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

export interface DraftPickLike {
  metadata: {
    first_name: string;
    last_name: string;
    team_abbr: string;
  };
}

export function matchFplElement(
  pick: DraftPickLike,
  fpl: FplData
):
  | {
      element: FplElement;
      confidence: "exact" | "team_surname" | "substring" | "web_name" | "surname_unique";
    }
  | null {
  const teamIdToAbbr = new Map(fpl.teams.map((t) => [t.id, t.short_name]));
  const pFirst = normalizeName(pick.metadata.first_name);
  const pLast = normalizeName(pick.metadata.last_name);
  const pFull = pFirst + pLast;
  const pTeam = pick.metadata.team_abbr;

  const exact = fpl.elements.find(
    (e) => normalizeName(e.first_name) === pFirst && normalizeName(e.second_name) === pLast
  );
  if (exact) return { element: exact, confidence: "exact" };

  const teamSurname = fpl.elements.find(
    (e) => normalizeName(e.second_name) === pLast && teamIdToAbbr.get(e.team) === pTeam
  );
  if (teamSurname) return { element: teamSurname, confidence: "team_surname" };

  const substring = fpl.elements.find((e) => {
    if (teamIdToAbbr.get(e.team) !== pTeam) return false;
    const eLast = normalizeName(e.second_name);
    return eLast.includes(pLast) || pLast.includes(eLast);
  });
  if (substring) return { element: substring, confidence: "substring" };

  const webName = fpl.elements.find((e) => {
    if (teamIdToAbbr.get(e.team) !== pTeam) return false;
    const eWeb = normalizeName(e.web_name);
    return eWeb === pFull || eWeb === pLast || eWeb === pFirst;
  });
  if (webName) return { element: webName, confidence: "web_name" };

  // Last resort: surname match with no team constraint, for players whose club changed
  // between the Sleeper draft snapshot and the current FPL data (a real transfer, not a
  // matching error — e.g. a player transferred mid-window). Only trusted when exactly one
  // FPL player has this surname, to avoid a wrong match between two similarly-named players.
  if (pLast.length >= 4) {
    const surnameCandidates = fpl.elements.filter((e) => normalizeName(e.second_name) === pLast);
    if (surnameCandidates.length === 1) {
      return { element: surnameCandidates[0], confidence: "surname_unique" };
    }
  }

  return null;
}

export async function fetchFplData(): Promise<FplData> {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    next: { revalidate: 60 * 60 }, // 1 hour — this was previously only called from offline
    // scripts (no caching needed); now also used from live pages (player profile fixtures).
  });
  if (!res.ok) throw new Error(`FPL bootstrap-static failed: ${res.status}`);
  const body = (await res.json()) as FplData;
  return { elements: body.elements, teams: body.teams };
}
