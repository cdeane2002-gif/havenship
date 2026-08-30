import { LEAGUE_ID } from "@/lib/sleeper";
import {
  biggestWinMargins,
  careerWinLoss,
  favouritePlayers,
  getAllSeasonsData,
  longestWinStreaks,
  topSeasonPoints,
  topSingleWeekScores,
  worstSingleWeekXI,
} from "@/lib/records";
import { rankColorClass } from "@/lib/theme";
import { PlayerLink } from "@/components/PlayerLink";

export default async function RecordsPage() {
  const seasons = await getAllSeasonsData(LEAGUE_ID);

  const seasonPoints = topSeasonPoints(seasons, 10);
  const streaks = longestWinStreaks(seasons, 5);
  const career = careerWinLoss(seasons);
  const singleWeekHighs = topSingleWeekScores(seasons, 5);
  const singleWeekLows = worstSingleWeekXI(seasons, 1);
  const winMargins = biggestWinMargins(seasons, 3);
  const favourites = favouritePlayers(seasons, 2);

  const seasonLabels = seasons.map((s) => s.season).join(", ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 border-b-2 border-page-records pb-3">
        <p className="text-sm font-medium text-page-records">All-Time</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">Records</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          Across {seasons.length} season{seasons.length === 1 ? "" : "s"} of league history (
          {seasonLabels}).
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Most Points in a Season</h2>
        {seasonPoints.length === 0 ? (
          <EmptyNote text="No completed games yet — check back once a season is underway." />
        ) : (
          <RankedList
            items={seasonPoints.map((e, i) => ({
              key: `${e.season}-${e.managerName}-${i}`,
              rank: i + 1,
              primary: e.managerName,
              secondary: e.season,
              value: e.points.toFixed(2),
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Highest Single-Week Score</h2>
        {singleWeekHighs.length === 0 ? (
          <EmptyNote text="No gameweeks captured yet — check back once the first one is complete." />
        ) : (
          <RankedList
            items={singleWeekHighs.map((e, i) => ({
              key: `${e.season}-${e.week}-${e.managerName}-${i}`,
              rank: i + 1,
              primary: e.managerName,
              secondary: `GW${e.week}, ${e.season}`,
              value: e.points.toFixed(2),
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Biggest Win Margin</h2>
        {winMargins.length === 0 ? (
          <EmptyNote text="No gameweeks captured yet — check back once the first one is complete." />
        ) : (
          <RankedList
            items={winMargins.map((e, i) => ({
              key: `${e.season}-${e.week}-${e.winnerName}-${i}`,
              rank: i + 1,
              primary: `${e.winnerName} beat ${e.loserName}`,
              secondary: `GW${e.week}, ${e.season} · ${e.winnerPoints.toFixed(2)}-${e.loserPoints.toFixed(2)}`,
              value: `+${e.margin.toFixed(2)}`,
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Longest Win Streak</h2>
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
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Worst Starting XI</h2>
        {singleWeekLows.length === 0 ? (
          <EmptyNote text="No gameweeks captured yet — check back once the first one is complete." />
        ) : (
          <RankedList
            items={singleWeekLows.map((e, i) => ({
              key: `${e.season}-${e.week}-${e.managerName}-${i}`,
              rank: i + 1,
              primary: e.managerName,
              secondary: `GW${e.week}, ${e.season}`,
              value: e.points.toFixed(2),
            }))}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-fg-primary">Favourite Player</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          Each manager&apos;s highest cumulative points-scorer over the last two seasons.
        </p>
        {favourites.length === 0 ? (
          <EmptyNote text="No gameweeks captured yet — check back once the first one is complete." />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {favourites.map((f) => (
              <div
                key={f.userId}
                className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-fg-muted">{f.managerName}</p>
                  <PlayerLink
                    playerId={f.playerId}
                    name={f.playerName}
                    className="font-medium text-fg-primary"
                  />
                </div>
                <span className="shrink-0 font-mono tabular-nums font-semibold text-fg-primary">
                  {f.points.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Career Record (per Manager)</h2>
        {career.length === 0 ? (
          <EmptyNote text="No completed games yet — check back once a season is underway." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-row text-left text-xs uppercase tracking-wide text-fg-muted">
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
                      className="border-b border-surface-border/60 last:border-0 even:bg-surface-row/40 hover:bg-surface-row/60"
                    >
                      <td className="px-3 py-3 font-medium text-fg-primary">{c.managerName}</td>
                      <td className="px-3 py-3 text-center font-mono tabular-nums text-fg-secondary">
                        {c.wins}-{c.losses}-{c.ties}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-secondary">
                        {pct === "—" ? pct : `${pct}%`}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-fg-secondary">
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
    <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
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
    <ol className="overflow-hidden rounded-lg border border-surface-border">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-center gap-3 border-b border-surface-border/60 bg-surface-card px-3 py-2.5 text-sm last:border-0 even:bg-surface-row/30 hover:bg-surface-row/50"
        >
          <span className={`w-5 shrink-0 font-mono font-semibold ${rankColorClass(item.rank)}`}>
            {item.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-fg-primary">{item.primary}</div>
            <div className="text-xs text-fg-muted">{item.secondary}</div>
          </div>
          <span className="shrink-0 font-mono tabular-nums font-semibold text-fg-primary">
            {item.value}
          </span>
        </li>
      ))}
    </ol>
  );
}
