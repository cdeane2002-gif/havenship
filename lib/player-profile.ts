import { getAllGameweekData, getAllSeasons } from "./gameweek";

export interface PlayerAppearance {
  season: string;
  week: number;
  points: number;
  managerName: string;
  opponentManagerName: string | null; // the fantasy opponent that week — null on a bye
  club: string;
  position: string;
  name: string;
}

/** Scans every captured gameweek across every season for a player_id appearing in any
 * team's starters. Small enough dataset (well under 10k starter entries even with a full
 * season backfilled) that a full scan per profile-page load is fine — no separate index. */
export function getPlayerHistory(playerId: string): PlayerAppearance[] {
  const appearances: PlayerAppearance[] = [];
  for (const season of getAllSeasons()) {
    for (const gw of getAllGameweekData(season)) {
      for (const matchup of gw.matchups) {
        for (const team of matchup.teams) {
          const starter = team.starters.find((s) => s.player_id === playerId);
          if (starter) {
            const opponent = matchup.teams.find((t) => t.roster_id !== team.roster_id);
            appearances.push({
              season,
              week: gw.week,
              points: starter.points,
              managerName: team.manager_name,
              opponentManagerName: opponent?.manager_name ?? null,
              club: starter.club,
              position: starter.position,
              name: starter.name,
            });
          }
        }
      }
    }
  }
  appearances.sort((a, b) =>
    a.season === b.season ? a.week - b.week : a.season.localeCompare(b.season)
  );
  return appearances;
}
