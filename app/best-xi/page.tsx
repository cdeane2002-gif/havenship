import { LEAGUE_ID, getLeague } from "@/lib/sleeper";
import { getAvailableWeeks, getGameweekData } from "@/lib/gameweek";
import { computeBestXI } from "@/lib/best-xi";

export default async function BestXIPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const league = await getLeague(LEAGUE_ID);

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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Best XI</h1>
        </header>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-300">
          No gameweeks captured yet. The Best XI appears here once the first gameweek is
          complete.
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const requestedWeek = Array.isArray(params.week) ? params.week[0] : params.week;
  const parsedWeek = requestedWeek ? Number(requestedWeek) : NaN;
  const week = availableWeeks.includes(parsedWeek) ? parsedWeek : availableWeeks[availableWeeks.length - 1];

  const gameweek = getGameweekData(league.season, week);
  const slots = gameweek ? computeBestXI(gameweek.matchups.flatMap((m) => m.teams)) : [];
  const totalPoints = slots.reduce((sum, s) => sum + s.candidate.points, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-400">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Best XI</h1>
        <p className="mt-1 text-sm text-neutral-300">
          The highest-scoring valid lineup across every manager&apos;s starters this gameweek —
          {" "}
          {totalPoints.toFixed(1)} combined points.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {availableWeeks.map((w) => (
          <a
            key={w}
            href={`/best-xi?week=${w}`}
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
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          {slots.map((slot, i) => {
            return (
              <div
                key={`${slot.slot}-${i}`}
                className="flex items-center gap-3 border-b border-neutral-800/60 bg-neutral-900/30 px-4 py-3 last:border-0 even:bg-neutral-900/50"
              >
                <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  {slot.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-100">
                    {slot.candidate.name}
                    <span className="ml-1.5 text-xs font-normal text-neutral-400">
                      {slot.candidate.club}
                    </span>
                  </div>
                  <div className="truncate text-xs text-neutral-400">
                    {slot.candidate.manager_name}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-lg font-bold text-emerald-400">
                  {slot.candidate.points.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
