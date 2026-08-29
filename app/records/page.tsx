import { LEAGUE_ID } from "@/lib/sleeper";
import {
  biggestWinMargins,
  careerWinLoss,
  getAllSeasonsData,
  longestWinStreaks,
  topSeasonPoints,
  topSingleWeekScores,
  worstSingleWeekXI,
} from "@/lib/records";

export default async function RecordsPage() {
  const seasons = await getAllSeasonsData(LEAGUE_ID);

  const seasonPoints = topSeasonPoints(seasons, 10);
  const streaks = longestWinStreaks(seasons, 10);
  const career = careerWinLoss(seasons);
  const singleWeekHighs = topSingleWeekScores(seasons, 10);
  const singleWeekLows = worstSingleWeekXI(seasons, 10);
  const winMargins = biggestWinMargins(seasons, 10);

  const seasonLabels = seasons.map((s) => s.season).join(", ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-400">All-Time</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Records</h1>
        <p className="mt-1 text-sm text-neutral-300">
          Across {seasons.length} season{seasons.length === 1 ? "" : "s"} of league history (
          {seasonLabels}).
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Most Points in a Season</h2>
        {seasonPoints.length === 0 ? (
          <EmptyNote text="No completed games yet — check back once a season is underway." />
        ) : (
          <RankedList
            items={seasonPoints.map((e, i) => ({
              key: `${e.season}-${e.managerName}-${i}`,
              rank: i + 1,
              primary: e.managerName,
              secondary: e.season,
              value: e.points.toFixed(1),
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Highest Single-Week Score</h2>
        {singleWeekHighs.length === 0 ? (
          <EmptyNote text="No gameweeks captured yet — check back once the first one is complete." />
        ) : (
          <RankedList
            items={singleWeekHighs.map((e, i) => ({
              key: `${e.season}-${e.week}-${e.managerName}-${i}`,
              rank: i + 1,
              primary: e.managerName,
              secondary: `GW${e.week}, ${e.season}`,
              value: e.points.toFixed(1),
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Biggest Win Margin</h2>
        {winMargins.length === 0 ? (
          <EmptyNote text="No gameweeks captured yet — check back once the first one is complete." />
        ) : (
          <RankedList
            items={winMargins.map((e, i) => ({
              key: `${e.season}-${e.week}-${e.winnerName}-${i}`,
              rank: i + 1,
              primary: `${e.winnerName} beat ${e.loserName}`,
              secondary: `GW${e.week}, ${e.season} · ${e.winnerPoints.toFixed(1)}-${e.loserPoints.toFixed(1)}`,
              value: `+${e.margin.toFixed(1)}`,
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Longest Win Streak</h2>
        {streaks.length === 0 ? (
          <EmptyNote text="No completed games yet — check back once a season is underway." />
        ) : (
          <RankedList
            items={streaks.map((e, i) => ({
              key: `${e.season}-${e.managerName}-${i}`,
              rank: i + 1,
              primary: e.managerName,
              secondary: e.season,
              value: `${e.length}${e.length === 1 ? " win" : " wins"}`,
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Worst Starting XI</h2>
        {singleWeekLows.length === 0 ? (
          <EmptyNote text="No gameweeks captured yet — check back once the first one is complete." />
        ) : (
          <RankedList
            items={singleWeekLows.map((e, i) => ({
              key: `${e.season}-${e.week}-${e.managerName}-${i}`,
              rank: i + 1,
              primary: e.managerName,
              secondary: `GW${e.week}, ${e.season}`,
              value: e.points.toFixed(1),
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Career Record (per Manager)</h2>
        {career.length === 0 ? (
          <EmptyNote text="No completed games yet — check back once a season is underway." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
                  <th className="px-3 py-2 font-medium">Manager</th>
                  <th className="px-3 py-2 text-center font-medium">W-L-D</th>
                  <th className="px-3 py-2 text-right font-medium">Win %</th>
                  <th className="px-3 py-2 text-right font-medium">Seasons</th>
                </tr>
              </thead>
              <tbody>
                {career.map((c) => {
                  const games = c.wins + c.losses + c.ties;
                  const pct = games > 0 ? ((c.wins / games) * 100).toFixed(0) : "—";
                  return (
                    <tr
                      key={c.userId}
                      className="border-b border-neutral-800/60 last:border-0 even:bg-neutral-900/30"
                    >
                      <td className="px-3 py-3 font-medium text-neutral-200">{c.managerName}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-300">
                        {c.wins}-{c.losses}-{c.ties}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-neutral-300">
                        {pct === "—" ? pct : `${pct}%`}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-neutral-300">
                        {c.seasonsPlayed}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-400">
      {text}
    </div>
  );
}

function RankedList({
  items,
}: {
  items: { key: string; rank: number; primary: string; secondary: string; value: string }[];
}) {
  return (
    <ol className="overflow-hidden rounded-lg border border-neutral-800">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-center gap-3 border-b border-neutral-800/60 bg-neutral-900/30 px-3 py-2.5 text-sm last:border-0 even:bg-neutral-900/50"
        >
          <span className="w-5 shrink-0 text-neutral-400">{item.rank}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-neutral-200">{item.primary}</div>
            <div className="text-xs text-neutral-400">{item.secondary}</div>
          </div>
          <span className="shrink-0 tabular-nums font-semibold text-emerald-400">
            {item.value}
          </span>
        </li>
      ))}
    </ol>
  );
}
