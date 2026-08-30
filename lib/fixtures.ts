import { fetchFplData } from "./player-value";

export interface Fixture {
  gameweek: number;
  kickoffTime: string;
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
}

interface RawFplFixture {
  event: number | null;
  kickoff_time: string;
  team_h: number;
  team_a: number;
  finished: boolean;
}

const FIXTURES_REVALIDATE_SECONDS = 60 * 60; // 1 hour

/** Upcoming EPL fixtures for a club (by its Sleeper/FPL short code, e.g. "MCI"), soonest
 * first. Used on player profile pages. */
export async function getUpcomingFixturesForClub(clubAbbr: string, limit = 5): Promise<Fixture[]> {
  const [fixturesRes, fplData] = await Promise.all([
    fetch("https://fantasy.premierleague.com/api/fixtures/?future=1", {
      next: { revalidate: FIXTURES_REVALIDATE_SECONDS },
    }),
    fetchFplData(),
  ]);
  if (!fixturesRes.ok) return [];
  const fixtures = (await fixturesRes.json()) as RawFplFixture[];

  const team = fplData.teams.find((t) => t.short_name === clubAbbr);
  if (!team) return [];
  const teamIdToAbbr = new Map(fplData.teams.map((t) => [t.id, t.short_name]));

  return fixtures
    .filter((f) => !f.finished && f.event !== null && (f.team_h === team.id || f.team_a === team.id))
    .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
    .slice(0, limit)
    .map((f) => ({
      gameweek: f.event!,
      kickoffTime: f.kickoff_time,
      homeTeam: teamIdToAbbr.get(f.team_h) ?? "?",
      awayTeam: teamIdToAbbr.get(f.team_a) ?? "?",
      isHome: f.team_h === team.id,
    }));
}
