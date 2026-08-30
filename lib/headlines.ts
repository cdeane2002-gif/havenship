// Deterministic, data-driven weekly highlights — no AI involved. Computed straight from a
// captured (or live) gameweek's scores, so there's zero ongoing cost and nothing to keep in
// sync with an Anthropic key. Intentionally a small, fixed set of superlatives rather than
// prose, so it reads at a glance on the homepage.

import type { GameweekFile, GameweekTeam } from "./gameweek-schemas";

export interface Headline {
  label: string;
  text: string;
  href?: string;
}

interface PlayedMatchup {
  teamA: GameweekTeam;
  teamB: GameweekTeam;
}

export function buildWeeklyHeadlines(gameweek: GameweekFile): Headline[] {
  const headlines: Headline[] = [];
  const allTeams = gameweek.matchups.flatMap((m) => m.teams);
  if (allTeams.length === 0) return headlines;

  const playedMatchups: PlayedMatchup[] = gameweek.matchups
    .filter((m) => m.teams.length === 2)
    .map((m) => ({ teamA: m.teams[0], teamB: m.teams[1] }));

  // Top individual scorer, across every team's starters.
  const allStarters = allTeams.flatMap((t) =>
    t.starters.map((s) => ({ ...s, managerName: t.manager_name }))
  );
  if (allStarters.length > 0) {
    const top = allStarters.reduce((best, s) => (s.points > best.points ? s : best));
    headlines.push({
      label: "Top Scorer",
      text: `${top.name} — ${top.points.toFixed(2)} pts for ${top.managerName}`,
      href: `/players/${top.player_id}`,
    });
  }

  // Highest / lowest team score.
  const highest = allTeams.reduce((best, t) => (t.points > best.points ? t : best));
  const lowest = allTeams.reduce((worst, t) => (t.points < worst.points ? t : worst));
  headlines.push({
    label: "Highest Score",
    text: `${highest.manager_name} — ${highest.points.toFixed(2)} pts`,
  });
  if (lowest.roster_id !== highest.roster_id) {
    headlines.push({
      label: "Lowest Score",
      text: `${lowest.manager_name} — ${lowest.points.toFixed(2)} pts`,
    });
  }

  // Biggest margin / closest match — only meaningful with a completed head-to-head.
  if (playedMatchups.length > 0) {
    const margins = playedMatchups.map(({ teamA, teamB }) => ({
      teamA,
      teamB,
      margin: Math.abs(teamA.points - teamB.points),
    }));

    const biggest = margins.reduce((best, m) => (m.margin > best.margin ? m : best));
    const winner = biggest.teamA.points > biggest.teamB.points ? biggest.teamA : biggest.teamB;
    const loser = biggest.teamA.points > biggest.teamB.points ? biggest.teamB : biggest.teamA;
    headlines.push({
      label: "Biggest Win",
      text: `${winner.manager_name} beat ${loser.manager_name} by ${biggest.margin.toFixed(2)}`,
    });

    if (margins.length > 1) {
      const closest = margins.reduce((best, m) => (m.margin < best.margin ? m : best));
      if (closest.margin !== biggest.margin) {
        headlines.push({
          label: "Nail-Biter",
          text: `${closest.teamA.manager_name} vs ${closest.teamB.manager_name} — decided by ${closest.margin.toFixed(2)}`,
        });
      }
    }
  }

  return headlines;
}
