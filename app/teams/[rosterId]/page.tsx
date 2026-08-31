import Image from "next/image";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import {
  LEAGUE_ID,
  avatarUrlForUser,
  getRosters,
  getUsers,
  rosterPointsAgainst,
  rosterPointsFor,
  rosterRecord,
  rosterStreak,
  teamNameForUser,
} from "@/lib/sleeper";
import {
  getArchenemy,
  getClosestWin,
  getFavouriteOpponent,
  getHero,
  getLeastFavouriteOpponent,
  getTeamMatchHistory,
} from "@/lib/team-profile";
import { buildPlayerDictionaryWithFallback } from "@/lib/player-dictionary";
import { PlayerLink } from "@/components/PlayerLink";
import { ClaimTeamButton } from "@/components/ClaimTeamButton";
import { rankColorClass } from "@/lib/theme";

function resultBadge(result: "W" | "L" | "T" | null) {
  if (!result) return null;
  const color = result === "W" ? "bg-win/15 text-win" : result === "L" ? "bg-loss/15 text-loss" : "bg-draw/15 text-draw";
  return (
    <span className={`inline-block w-5 shrink-0 rounded text-center text-[11px] font-bold ${color}`}>
      {result}
    </span>
  );
}

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ rosterId: string }>;
}) {
  const { rosterId: rosterIdParam } = await params;
  const rosterId = Number(rosterIdParam);

  const [rosters, users] = await Promise.all([getRosters(LEAGUE_ID), getUsers(LEAGUE_ID)]);
  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const roster = rosters.find((r) => r.roster_id === rosterId);

  if (!roster) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-fg-secondary">
        No team found for that roster.
      </div>
    );
  }

  const user = roster.owner_id ? usersById.get(roster.owner_id) ?? null : null;
  const name = user ? teamNameForUser(user) : `Roster ${roster.roster_id}`;
  const avatarUrl = user ? avatarUrlForUser(user) : null;
  const { wins, losses, ties } = rosterRecord(roster);
  const pointsFor = rosterPointsFor(roster);
  const pointsAgainst = rosterPointsAgainst(roster);
  const streak = rosterStreak(roster);

  const standingsRank =
    [...rosters]
      .sort((a, b) => {
        const aRec = rosterRecord(a);
        const bRec = rosterRecord(b);
        if (bRec.wins !== aRec.wins) return bRec.wins - aRec.wins;
        if (rosterPointsFor(b) !== rosterPointsFor(a)) return rosterPointsFor(b) - rosterPointsFor(a);
        return a.roster_id - b.roster_id;
      })
      .findIndex((r) => r.roster_id === roster.roster_id) + 1;

  const history = getTeamMatchHistory(rosterId);
  const playerIds = roster.players ?? [];
  const dict = await buildPlayerDictionaryWithFallback(LEAGUE_ID, playerIds);

  const favouriteOpponent = getFavouriteOpponent(rosterId);
  const leastFavouriteOpponent = getLeastFavouriteOpponent(rosterId);
  const archenemy = getArchenemy(rosterId);
  const hero = getHero(rosterId);
  const nearly = getClosestWin(rosterId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <BackButton fallbackHref="/" label="← Back to Standings" />

      <header className="mb-6 flex items-center gap-4 border-b border-surface-border pb-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full border border-surface-border bg-surface-row"
            unoptimized
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-full border border-surface-border bg-surface-row" />
        )}
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${rankColorClass(standingsRank)}`}>
            #{standingsRank} in standings
          </p>
          <h1 className="text-xl font-bold text-fg-primary sm:text-2xl">{name}</h1>
          <ClaimTeamButton rosterId={rosterId} />
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-surface-border bg-surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Record</p>
          <p className="mt-1 font-mono text-lg font-bold text-fg-primary">
            {wins}-{losses}-{ties}
          </p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Streak</p>
          <p className="mt-1 font-mono text-lg font-bold text-fg-primary">{streak ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Points For</p>
          <p className="mt-1 font-mono text-lg font-bold text-fg-primary">{pointsFor.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Points Against</p>
          <p className="mt-1 font-mono text-lg font-bold text-fg-primary">{pointsAgainst.toFixed(2)}</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Showcase</h2>
        {!hero && !nearly ? (
          <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
            No captured matches yet — highlights build up as gameweeks are played.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-surface-border bg-surface-card p-3">
              <p className="text-xs uppercase tracking-wide text-fg-muted">Hero</p>
              {hero ? (
                <>
                  <PlayerLink
                    playerId={hero.playerId}
                    name={hero.playerName}
                    className="mt-1 font-semibold text-fg-primary"
                  />
                  <p className="text-xs text-fg-muted">
                    {hero.points.toFixed(2)} pts · GW{hero.week}, {hero.season}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg-muted">—</p>
              )}
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-card p-3">
              <p className="text-xs uppercase tracking-wide text-fg-muted">Nearly</p>
              {nearly ? (
                <>
                  <Link
                    href={`/teams/${nearly.opponentRosterId}`}
                    className="mt-1 block truncate font-semibold text-fg-primary hover:underline"
                  >
                    vs {nearly.opponentName}
                  </Link>
                  <p className="text-xs text-fg-muted">
                    Won by {nearly.margin.toFixed(2)} ({nearly.points.toFixed(2)}–
                    {nearly.opponentPoints.toFixed(2)}) · GW{nearly.week}, {nearly.season}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg-muted">—</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Rivalries</h2>
        {!favouriteOpponent && !leastFavouriteOpponent && !archenemy ? (
          <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
            No captured matches yet — rivalries build up as gameweeks are played.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-surface-border bg-surface-card p-3">
              <p className="text-xs uppercase tracking-wide text-fg-muted">Favourite Opponent</p>
              {favouriteOpponent ? (
                <>
                  <Link
                    href={`/teams/${favouriteOpponent.opponentRosterId}`}
                    className="mt-1 block truncate font-semibold text-win hover:underline"
                  >
                    {favouriteOpponent.opponentName}
                  </Link>
                  <p className="text-xs text-fg-muted">
                    {favouriteOpponent.wins}-{favouriteOpponent.losses}-{favouriteOpponent.ties}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg-muted">—</p>
              )}
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-card p-3">
              <p className="text-xs uppercase tracking-wide text-fg-muted">Least Favourite Opponent</p>
              {leastFavouriteOpponent ? (
                <>
                  <Link
                    href={`/teams/${leastFavouriteOpponent.opponentRosterId}`}
                    className="mt-1 block truncate font-semibold text-loss hover:underline"
                  >
                    {leastFavouriteOpponent.opponentName}
                  </Link>
                  <p className="text-xs text-fg-muted">
                    {leastFavouriteOpponent.wins}-{leastFavouriteOpponent.losses}-
                    {leastFavouriteOpponent.ties}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg-muted">—</p>
              )}
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-card p-3">
              <p className="text-xs uppercase tracking-wide text-fg-muted">Archenemy</p>
              {archenemy ? (
                <>
                  <PlayerLink
                    playerId={archenemy.playerId}
                    name={archenemy.playerName}
                    className="mt-1 font-semibold text-fg-primary"
                  />
                  <p className="text-xs text-fg-muted">{archenemy.points.toFixed(2)} pts against you</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg-muted">—</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Current Roster</h2>
        {playerIds.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
            No roster data available.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1 overflow-hidden rounded-lg border border-surface-border sm:grid-cols-2">
            {playerIds.map((id) => {
              const info = dict.get(id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between border-b border-surface-border/60 bg-surface-card px-4 py-2.5 text-sm even:sm:border-l last:border-0"
                >
                  <PlayerLink playerId={id} name={info?.name ?? `Player #${id}`} className="text-fg-primary" />
                  <span className="shrink-0 text-xs text-fg-muted">
                    {info ? `${info.position} · ${info.club}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-fg-primary">Match History</h2>
        {history.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
            No captured matches yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border">
            {[...history].reverse().map((h) => (
              <div
                key={`${h.season}-${h.week}`}
                className="flex items-center justify-between gap-2 border-b border-surface-border/60 bg-surface-card px-4 py-2.5 text-sm last:border-0 even:bg-surface-row/30"
              >
                <a
                  href={`/results?season=${h.season}&week=${h.week}`}
                  className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
                >
                  <span className="shrink-0 text-fg-primary">GW{h.week}</span>
                  {resultBadge(h.result)}
                  <span className="truncate text-fg-secondary">
                    {h.isBye ? "Bye week" : `vs ${h.opponentName}`}
                  </span>
                </a>
                <span className="shrink-0 font-mono tabular-nums text-fg-primary">
                  {h.points.toFixed(2)}
                  {!h.isBye && h.opponentPoints !== null ? (
                    <span className="text-fg-muted"> – {h.opponentPoints.toFixed(2)}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
