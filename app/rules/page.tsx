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
        <div className="overflow-x-auto rounded-lg border border-surface-border">
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
