import { Fragment } from "react";
import { LEAGUE_ID, getLeague } from "@/lib/sleeper";
import {
  CATEGORY_ORDER,
  LEAGUE_SETTING_LABELS,
  POSITION_LABELS,
  POSITION_ORDER,
  buildScoringMatrix,
  summarizeRosterPositions,
} from "@/lib/scoring-labels";

function formatPoints(value: number | undefined) {
  if (value === undefined) return "—";
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
}

export default async function RulesPage() {
  const league = await getLeague(LEAGUE_ID);

  if (!league) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-fg-secondary">
        Couldn&apos;t reach the Sleeper API for this league. Try again shortly.
      </div>
    );
  }

  const rosterSlots = summarizeRosterPositions(league.roster_positions);
  const starters = rosterSlots.filter((s) => s.slot !== "BN");
  const bench = rosterSlots.find((s) => s.slot === "BN");
  const totalStarters = starters.reduce((sum, s) => sum + s.count, 0);

  const { rows: scoringRows } = buildScoringMatrix(league.scoring_settings);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <header className="mb-8 border-b-2 border-page-rules pb-3">
        <p className="text-sm font-medium text-page-rules">{league.name}</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">
          Rules &amp; Scoring
        </h1>
        <p className="mt-1 text-sm text-fg-secondary">
          Pulled straight from the league&apos;s live settings on Sleeper.
        </p>
      </header>

      {/* Roster format */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Roster Format</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          {totalStarters} starters, {bench?.count ?? 0} bench spots — {league.roster_positions.length} total.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {starters.map((slot) => (
            <div
              key={slot.slot}
              className="rounded-lg border border-surface-border bg-surface-card px-3 py-2.5"
            >
              <div className="text-lg font-bold text-page-rules">{slot.count}×</div>
              <div className="text-sm text-fg-secondary">{slot.label}</div>
            </div>
          ))}
          {bench && (
            <div className="rounded-lg border border-surface-border bg-surface-card px-3 py-2.5">
              <div className="text-lg font-bold text-fg-muted">{bench.count}×</div>
              <div className="text-sm text-fg-secondary">{bench.label}</div>
            </div>
          )}
        </div>
      </section>

      {/* House rules — custom to this league, not part of Sleeper's own settings/scoring */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-fg-primary">House Rules</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          On top of Sleeper&apos;s own scoring below — tracked by hand, not enforced by Sleeper.
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border border-surface-border bg-surface-card p-4">
            <p className="font-semibold text-fg-primary">Bonus &amp; Penalty Points</p>
            <ul className="mt-2 space-y-1.5 text-sm text-fg-secondary">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono font-semibold text-win">+100</span>
                <span>A player who scores a goal <em>and</em> receives a red card in the same match.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono font-semibold text-loss">−100</span>
                <span>A player who scores a hat-trick, but their team still loses the fantasy matchup that week.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-surface-border bg-surface-card p-4">
            <p className="font-semibold text-fg-primary">Time Machine Chip</p>
            <p className="mt-2 text-sm text-fg-secondary">
              Each manager may retroactively swap one of their own already-played starters for
              a different player&apos;s actual score that same gameweek — twice per season: once
              any time before GW19, and once any time after. See each team&apos;s profile page
              for who&apos;s used theirs.
            </p>
          </div>

          <div className="rounded-lg border border-surface-border bg-surface-card p-4">
            <p className="font-semibold text-fg-primary">Buy-In &amp; Stakes</p>
            <p className="mt-2 text-sm text-fg-secondary">
              Every manager pays a <strong className="text-fg-primary">€20 buy-in</strong>,
              paid out in full to the playoff champion.
            </p>
            <p className="mt-2 text-sm text-fg-secondary">
              Last place takes on the{" "}
              <strong className="text-fg-primary">&quot;Not-So-Fun Run&quot;</strong>: a 5km
              run, stopping at every 1km marker to eat a Big Mac and drink a 500ml can of beer
              before continuing.
            </p>
          </div>
        </div>
      </section>

      {/* League settings */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">League Settings</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {LEAGUE_SETTING_LABELS.map(({ key, label, format }) => {
            const value = league.settings[key];
            if (value === undefined) return null;
            return (
              <div key={key}>
                <dt className="text-xs uppercase tracking-wide text-fg-muted">{label}</dt>
                <dd className="text-sm font-medium text-fg-primary">{format(value)}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* Scoring matrix */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-fg-primary">Scoring</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          Points awarded per stat, by position. Blank means that stat isn&apos;t scored for that
          position.
        </p>
        <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-surface-border [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-row text-left text-xs uppercase tracking-wide text-fg-muted">
                <th className="px-3 py-2 font-medium">Stat</th>
                {POSITION_ORDER.map((pos) => (
                  <th key={pos} className="px-3 py-2 text-right font-medium">
                    {POSITION_LABELS[pos]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((category) => {
                const rowsInCategory = scoringRows.filter((r) => r.category === category);
                if (rowsInCategory.length === 0) return null;
                return (
                  <Fragment key={category}>
                    <tr className="bg-surface-row/70">
                      <td
                        colSpan={POSITION_ORDER.length + 1}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-secondary"
                      >
                        {category}
                      </td>
                    </tr>
                    {rowsInCategory.map((row) => (
                      <tr
                        key={row.stat}
                        className="border-b border-surface-border/60 last:border-0 even:bg-surface-row/40"
                      >
                        <td className="px-3 py-2 text-fg-primary">{row.label}</td>
                        {POSITION_ORDER.map((pos) => {
                          const value = row.valuesByPosition[pos];
                          const isNegative = typeof value === "number" && value < 0;
                          const isPositive = typeof value === "number" && value > 0;
                          return (
                            <td
                              key={pos}
                              className={`px-3 py-2 text-right font-mono tabular-nums ${
                                isNegative
                                  ? "text-loss"
                                  : isPositive
                                    ? "text-win"
                                    : "text-fg-muted"
                              }`}
                            >
                              {formatPoints(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
