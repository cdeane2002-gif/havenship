import Link from "next/link";
import { LEAGUE_ID, avatarUrlForUser, getLeague, getSeasonState, getUsers } from "@/lib/sleeper";
import { getAvailableWeeks, getGameweekData } from "@/lib/gameweek";
import { getLiveGameweekData } from "@/lib/gameweek-live";
import { PlayerLink } from "@/components/PlayerLink";
import type { GameweekTeam } from "@/lib/gameweek-schemas";

function TeamRow({
  team,
  isWinner,
  avatarUrl,
}: {
  team: GameweekTeam;
  isWinner: boolean;
  avatarUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-surface-border bg-surface-row"
        />
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full border border-surface-border bg-surface-row" />
      )}
      <Link
        href={`/teams/${team.roster_id}`}
        className={`min-w-0 flex-1 truncate text-sm font-medium hover:underline ${
          isWinner ? "text-fg-primary" : "text-fg-secondary"
        }`}
      >
        {team.manager_name}
      </Link>
      <span
        className={`shrink-0 font-mono tabular-nums text-lg font-bold ${
          isWinner ? "text-win" : "text-fg-secondary"
        }`}
      >
        {team.points.toFixed(2)}
      </span>
    </div>
  );
}

function StartersList({ team }: { team: GameweekTeam }) {
  const sorted = [...team.starters].sort((a, b) => b.points - a.points);
  return (
    <div className="grid grid-cols-1 gap-0.5">
      {sorted.map((s) => (
        <div key={s.player_id} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 flex-1 items-center text-fg-secondary">
            <span className="mr-1.5 inline-block w-6 shrink-0 text-fg-muted">{s.position}</span>
            <PlayerLink playerId={s.player_id} name={s.name} className="text-fg-secondary" />
          </span>
          <span className="shrink-0 font-mono tabular-nums text-fg-secondary">
            {s.points.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const league = await getLeague(LEAGUE_ID);
  const users = await getUsers(LEAGUE_ID);
  const usersByName = new Map(
    users.map((u) => [u.metadata?.team_name?.trim() || u.display_name, u])
  );

  if (!league) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-fg-secondary">
        Couldn&apos;t reach the Sleeper API for this league. Try again shortly.
      </div>
    );
  }

  const state = await getSeasonState();
  const currentWeek = state?.week ?? null;

  const capturedWeeks = getAvailableWeeks(league.season);
  const availableWeeks = Array.from(
    new Set(currentWeek ? [...capturedWeeks, currentWeek] : capturedWeeks)
  ).sort((a, b) => a - b);

  if (availableWeeks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <header className="mb-6 border-b-2 border-page-results pb-3">
          <p className="text-sm font-medium text-page-results">{league.season} Season</p>
          <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">
            Results
          </h1>
        </header>
        <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
          No gameweeks captured yet. Results appear here once the first gameweek is underway.
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const requestedWeek = Array.isArray(params.week) ? params.week[0] : params.week;
  const parsedWeek = requestedWeek ? Number(requestedWeek) : NaN;
  const week = availableWeeks.includes(parsedWeek) ? parsedWeek : availableWeeks[availableWeeks.length - 1];

  const isLiveWeek = week === currentWeek;
  const gameweek = isLiveWeek
    ? (await getLiveGameweekData(LEAGUE_ID, league.season, week)) ?? getGameweekData(league.season, week)
    : getGameweekData(league.season, week);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 border-b-2 border-page-results pb-3">
        <p className="text-sm font-medium text-page-results">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">Results</h1>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {availableWeeks.map((w) => (
          <a
            key={w}
            href={`/results?week=${w}`}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              w === week
                ? "bg-page-results/20 text-page-results"
                : "bg-surface-row text-fg-secondary hover:bg-surface-border"
            }`}
          >
            GW{w}
            {w === currentWeek ? " •" : ""}
          </a>
        ))}
      </div>

      {isLiveWeek && (
        <div className="mb-4 flex items-center gap-1.5 text-xs font-medium text-page-results">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-page-results" />
          LIVE — updates as matches are played
        </div>
      )}

      {!gameweek ? (
        <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
          {isLiveWeek
            ? "Gameweek is underway but no scores yet — check back once matches kick off."
            : `Couldn't load gameweek ${week}.`}
        </div>
      ) : (
        <div className="space-y-4">
          {gameweek.matchups.map((matchup) => {
            const [teamA, teamB] = [...matchup.teams].sort((a, b) => b.points - a.points);
            return (
              <div
                key={matchup.matchup_id}
                className="rounded-lg border border-surface-border bg-surface-card p-4"
              >
                <div className="mb-3 space-y-2">
                  <TeamRow
                    team={teamA}
                    isWinner={!teamB || teamA.points > teamB.points}
                    avatarUrl={
                      usersByName.get(teamA.manager_name)
                        ? avatarUrlForUser(usersByName.get(teamA.manager_name)!)
                        : null
                    }
                  />
                  {teamB && (
                    <TeamRow
                      team={teamB}
                      isWinner={teamB.points > teamA.points}
                      avatarUrl={
                        usersByName.get(teamB.manager_name)
                          ? avatarUrlForUser(usersByName.get(teamB.manager_name)!)
                          : null
                      }
                    />
                  )}
                </div>

                {!teamB && <p className="mb-3 text-sm text-fg-secondary">Bye week.</p>}

                <details className="text-sm">
                  <summary className="cursor-pointer text-fg-secondary hover:text-fg-primary">
                    Full lineups
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-fg-muted">
                        {teamA.manager_name}
                      </p>
                      <StartersList team={teamA} />
                    </div>
                    {teamB && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-fg-muted">
                          {teamB.manager_name}
                        </p>
                        <StartersList team={teamB} />
                      </div>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
