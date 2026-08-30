import Link from "next/link";
import { LEAGUE_ID } from "@/lib/sleeper";
import { getPlayerHistory } from "@/lib/player-profile";
import { buildPlayerDictionaryWithFallback } from "@/lib/player-dictionary";
import { getUpcomingFixturesForClub } from "@/lib/fixtures";
import { playerImageUrl } from "@/lib/player-image";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: playerId } = await params;

  const history = await getPlayerHistory(playerId);
  const mostRecent = history[history.length - 1] as (typeof history)[number] | undefined;

  // Fallback identity (draft-pick dictionary, then Sleeper's public dictionary) covers a
  // player who's never started in a captured gameweek — e.g. a bench player.
  const dict = await buildPlayerDictionaryWithFallback(LEAGUE_ID, [playerId]);
  const fallbackInfo = dict.get(playerId);

  const name = mostRecent?.name ?? fallbackInfo?.name ?? `Player #${playerId}`;
  const position = mostRecent?.position ?? fallbackInfo?.position ?? "?";
  const club = mostRecent?.club ?? fallbackInfo?.club ?? "?";

  const overallPoints = history.reduce((sum, h) => sum + h.points, 0);
  const fixtures = club !== "?" ? await getUpcomingFixturesForClub(club, 5) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <Link href="/results" className="mb-4 inline-block text-sm text-fg-secondary hover:text-fg-primary">
        ← Back
      </Link>

      <header className="mb-6 flex items-center gap-4 border-b border-surface-border pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={playerImageUrl(playerId)}
          alt=""
          className="h-16 w-16 shrink-0 rounded-full border border-surface-border bg-surface-row object-cover"
        />
        <div>
          <h1 className="text-xl font-bold text-fg-primary sm:text-2xl">{name}</h1>
          <p className="text-sm text-fg-secondary">
            {position} · {club}
          </p>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Overall Points</p>
          <p className="mt-1 font-mono text-2xl font-bold text-fg-primary">
            {overallPoints.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Gameweeks Started</p>
          <p className="mt-1 font-mono text-2xl font-bold text-fg-primary">{history.length}</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Upcoming Fixtures</h2>
        {fixtures.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
            No upcoming fixtures found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border">
            {fixtures.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-surface-border/60 bg-surface-card px-4 py-2.5 text-sm last:border-0 even:bg-surface-row/30"
              >
                <span className="text-fg-primary">
                  {f.isHome ? (
                    <>
                      <strong>{f.homeTeam}</strong> vs {f.awayTeam}
                    </>
                  ) : (
                    <>
                      {f.homeTeam} vs <strong>{f.awayTeam}</strong>
                    </>
                  )}
                </span>
                <span className="text-fg-muted">
                  GW{f.gameweek} ·{" "}
                  {new Date(f.kickoffTime).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Score History</h2>
        {history.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
            Never started in a captured gameweek.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border">
            {[...history].reverse().map((h) => (
              <div
                key={`${h.season}-${h.week}`}
                className="flex items-center justify-between border-b border-surface-border/60 bg-surface-card px-4 py-2.5 text-sm last:border-0 even:bg-surface-row/30"
              >
                <div>
                  <span className="text-fg-primary">GW{h.week}</span>
                  <span className="ml-1.5 text-xs text-fg-muted">{h.season}</span>
                </div>
                <span className="text-xs text-fg-secondary">{h.managerName}</span>
                <span className="font-mono font-semibold tabular-nums text-fg-primary">
                  {h.points.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
