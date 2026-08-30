import { LEAGUE_ID, getLeague, getSeasonState } from "@/lib/sleeper";
import { getAvailableWeeks, getGameweekData } from "@/lib/gameweek";
import { getLiveGameweekData } from "@/lib/gameweek-live";
import { computeBestXI } from "@/lib/best-xi";

export default async function BestXIPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const league = await getLeague(LEAGUE_ID);

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
        <header className="mb-6 border-b-2 border-page-bestxi pb-3">
          <p className="text-sm font-medium text-page-bestxi">{league.season} Season</p>
          <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">
            Best XI
          </h1>
        </header>
        <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
          No gameweeks captured yet. The Best XI appears here once the first gameweek is
          underway.
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
  const slots = gameweek ? computeBestXI(gameweek.matchups.flatMap((m) => m.teams)) : [];
  const totalPoints = slots.reduce((sum, s) => sum + s.candidate.points, 0);
  const topScorerId =
    slots.length > 0
      ? slots.reduce((best, s) => (s.candidate.points > best.candidate.points ? s : best)).candidate
          .player_id
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 border-b-2 border-page-bestxi pb-3">
        <p className="text-sm font-medium text-page-bestxi">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">
          Best XI
        </h1>
        <p className="mt-1 text-sm text-fg-secondary">
          The highest-scoring valid lineup across every manager&apos;s starters this gameweek —
          {" "}
          {totalPoints.toFixed(2)} combined points.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {availableWeeks.map((w) => (
          <a
            key={w}
            href={`/best-xi?week=${w}`}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              w === week
                ? "bg-page-bestxi/20 text-page-bestxi"
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
        <div className="overflow-hidden rounded-lg border border-surface-border">
          {slots.map((slot, i) => {
            const isTopScorer = slot.candidate.player_id === topScorerId;
            return (
              <div
                key={`${slot.slot}-${i}`}
                className={`flex items-center gap-3 border-b border-surface-border/60 px-4 py-3 last:border-0 ${
                  isTopScorer ? "bg-gold/10" : "bg-surface-card even:bg-surface-row/30"
                }`}
              >
                <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-fg-muted">
                  {slot.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate text-sm font-medium text-fg-primary">
                    {isTopScorer && (
                      <span className="text-gold" title="Top scorer this gameweek" aria-hidden>
                        ★
                      </span>
                    )}
                    <span className="truncate">{slot.candidate.name}</span>
                    <span className="shrink-0 text-xs font-normal text-fg-secondary">
                      {slot.candidate.club}
                    </span>
                  </div>
                  <div className="truncate text-xs text-fg-secondary">
                    {slot.candidate.manager_name}
                  </div>
                </div>
                <span
                  className={`shrink-0 font-mono tabular-nums text-lg font-bold ${
                    isTopScorer ? "text-gold" : "text-fg-primary"
                  }`}
                >
                  {slot.candidate.points.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
