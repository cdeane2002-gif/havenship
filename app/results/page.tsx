import { LEAGUE_ID, avatarUrlForUser, getLeague, getUsers } from "@/lib/sleeper";
import { getAvailableWeeks, getGameweekData } from "@/lib/gameweek";
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
        <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full bg-neutral-800" />
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-800" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
          isWinner ? "text-neutral-100" : "text-neutral-300"
        }`}
      >
        {team.manager_name}
      </span>
      <span
        className={`shrink-0 tabular-nums text-lg font-bold ${
          isWinner ? "text-emerald-400" : "text-neutral-400"
        }`}
      >
        {team.points.toFixed(1)}
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
          <span className="min-w-0 flex-1 truncate text-neutral-300">
            <span className="mr-1.5 inline-block w-6 text-neutral-500">{s.position}</span>
            {s.name}
          </span>
          <span className="shrink-0 tabular-nums text-neutral-400">{s.points.toFixed(1)}</span>
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
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-neutral-300">
        Couldn&apos;t reach the Sleeper API for this league. Try again shortly.
      </div>
    );
  }

  const availableWeeks = getAvailableWeeks(league.season);

  if (availableWeeks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <header className="mb-6">
          <p className="text-sm font-medium text-emerald-400">{league.season} Season</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Results</h1>
        </header>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-300">
          No gameweeks captured yet. Results appear here once the first gameweek is complete.
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const requestedWeek = Array.isArray(params.week) ? params.week[0] : params.week;
  const parsedWeek = requestedWeek ? Number(requestedWeek) : NaN;
  const week = availableWeeks.includes(parsedWeek) ? parsedWeek : availableWeeks[availableWeeks.length - 1];

  const gameweek = getGameweekData(league.season, week);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-400">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Results</h1>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {availableWeeks.map((w) => (
          <a
            key={w}
            href={`/results?week=${w}`}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              w === week
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            GW{w}
          </a>
        ))}
      </div>

      {!gameweek ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-300">
          Couldn&apos;t load gameweek {week}.
        </div>
      ) : (
        <div className="space-y-4">
          {gameweek.matchups.map((matchup) => {
            const [teamA, teamB] = [...matchup.teams].sort((a, b) => b.points - a.points);
            return (
              <div
                key={matchup.matchup_id}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
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

                {!teamB ? (
                  <p className="mb-3 text-sm text-neutral-400">Bye week.</p>
                ) : matchup.report ? (
                  <div className="mb-3 rounded border border-neutral-800 bg-neutral-950/50 p-3">
                    <p className="mb-1 text-sm font-semibold text-neutral-100">
                      {matchup.report.headline}
                    </p>
                    <p className="mb-2 text-sm text-neutral-300">{matchup.report.body}</p>
                    <ul className="space-y-0.5">
                      {matchup.report.stat_highlights.map((stat, i) => (
                        <li key={i} className="text-xs text-neutral-400">
                          • {stat}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mb-3 text-sm text-amber-300">Report pending.</p>
                )}

                <details className="text-sm">
                  <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">
                    Full lineups
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-neutral-400">
                        {teamA.manager_name}
                      </p>
                      <StartersList team={teamA} />
                    </div>
                    {teamB && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-neutral-400">
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
