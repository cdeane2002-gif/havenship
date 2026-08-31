import { Fragment } from "react";
import Link from "next/link";
import {
  LEAGUE_ID,
  avatarUrlForUser,
  getLeague,
  getRosters,
  getSeasonState,
  getUsers,
  rosterPointsAgainst,
  rosterPointsFor,
  rosterRecord,
  teamNameForUser,
} from "@/lib/sleeper";
import { getPlayoffBracket, SleeperAuthError } from "@/lib/sleeper-graphql";
import { resolveBracket, type ResolvedBracketMatch } from "@/lib/playoff-bracket";
import { getAvailableWeeks, getGameweekData } from "@/lib/gameweek";
import { getLiveGameweekData } from "@/lib/gameweek-live";
import { getRoundFixtures } from "@/lib/next-fixture";
import { buildWeeklyHeadlines } from "@/lib/headlines";
import { recentForm } from "@/lib/theme";
import { StandingsRow } from "@/components/StandingsRow";
import { FeaturedWeekStrip } from "@/components/FeaturedWeekStrip";
import type { GameweekFile } from "@/lib/gameweek-schemas";
import type { SleeperRoster, SleeperUser } from "@/lib/types";

// Unlike Results/Best XI (forced dynamic automatically by reading searchParams), this page has
// no dynamic API of its own — Next.js was statically prerendering it at build time and only
// revalidating every 5 minutes via ISR, so the live matchup strip / playoff bracket could sit
// on a stale snapshot from whenever the last build or regeneration happened, independent of
// the auth token being correctly configured. Force real per-request rendering instead, same as
// next dev already does — traffic is tiny (~12 users), so hitting Sleeper fresh every load costs nothing.
export const dynamic = "force-dynamic";

interface StandingsRowData {
  roster: SleeperRoster;
  user: SleeperUser | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

function buildStandings(rosters: SleeperRoster[], users: SleeperUser[]): StandingsRowData[] {
  const usersById = new Map(users.map((u) => [u.user_id, u]));

  const rows: StandingsRowData[] = rosters.map((roster) => {
    const { wins, losses, ties } = rosterRecord(roster);
    return {
      roster,
      user: roster.owner_id ? usersById.get(roster.owner_id) ?? null : null,
      wins,
      losses,
      ties,
      pointsFor: rosterPointsFor(roster),
      pointsAgainst: rosterPointsAgainst(roster),
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.roster.roster_id - b.roster.roster_id;
  });

  return rows;
}

export default async function StandingsPage() {
  const [league, rosters, users] = await Promise.all([
    getLeague(LEAGUE_ID),
    getRosters(LEAGUE_ID),
    getUsers(LEAGUE_ID),
  ]);

  if (!league) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-fg-secondary">
        Couldn&apos;t reach the Sleeper API for this league. Try again shortly.
      </div>
    );
  }

  const rows = buildStandings(rosters, users);
  const seasonHasStarted = rows.some((r) => r.wins > 0 || r.losses > 0 || r.ties > 0);
  const isDrafting = league.status === "drafting";
  const currentPickNo = league.metadata?.current_pick_no;
  const totalPicks = league.total_rosters * 17; // 17 rounds, confirmed via draft settings

  // Bracket seeding exists from league creation (based on current standings while the
  // regular season is underway), not just once playoffs start. Fails gracefully — a missing/
  // expired auth token shouldn't take down the whole Standings page.
  let bracket: ResolvedBracketMatch[] = [];
  try {
    const managerNameForRoster = (rosterId: number) => {
      const row = rows.find((r) => r.roster.roster_id === rosterId);
      return row ? (row.user ? teamNameForUser(row.user) : `Roster ${rosterId}`) : `Roster ${rosterId}`;
    };
    const rawBracket = await getPlayoffBracket(LEAGUE_ID);
    bracket = resolveBracket(rawBracket, managerNameForRoster);
  } catch (err) {
    if (!(err instanceof SleeperAuthError)) throw err;
    console.error(err.message);
  }

  // Featured gameweek strip: the currently in-progress week if there is one, otherwise the
  // most recently captured one — same "live if current, else latest committed" rule Results
  // uses, so the homepage and Results page never disagree about what "this week" means.
  const state = await getSeasonState();
  const currentWeek = state?.week ?? null;
  const capturedWeeks = getAvailableWeeks(league.season);
  const availableWeeks = Array.from(
    new Set(currentWeek ? [...capturedWeeks, currentWeek] : capturedWeeks)
  ).sort((a, b) => a - b);
  const featuredWeek = availableWeeks.length > 0 ? availableWeeks[availableWeeks.length - 1] : null;
  const isLiveWeek = featuredWeek !== null && featuredWeek === currentWeek;

  let featuredGameweek: GameweekFile | null = null;
  if (featuredWeek !== null) {
    featuredGameweek = isLiveWeek
      ? (await getLiveGameweekData(LEAGUE_ID, league.season, featuredWeek)) ??
        getGameweekData(league.season, featuredWeek)
      : getGameweekData(league.season, featuredWeek);
  }
  const headlines = featuredGameweek ? buildWeeklyHeadlines(featuredGameweek) : [];
  const nextWeek = featuredWeek !== null ? featuredWeek + 1 : null;
  const nextFixtures = nextWeek !== null ? await getRoundFixtures(nextWeek) : [];

  const playoffCutoff = league.settings.playoff_teams;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <header className="mb-6 border-b-2 border-page-standings pb-3">
        <p className="text-sm font-medium text-page-standings">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">
          {league.name}
        </h1>
      </header>

      {featuredGameweek && featuredGameweek.matchups.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-fg-primary">GW{featuredWeek}</h2>
              {isLiveWeek && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-page-results">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-page-results" />
                  LIVE
                </span>
              )}
            </div>
            <a
              href={`/results?week=${featuredWeek}`}
              className="text-sm text-fg-secondary hover:text-fg-primary"
            >
              Full results →
            </a>
          </div>

          <FeaturedWeekStrip
            matchups={featuredGameweek.matchups}
            nextWeek={nextWeek}
            nextFixtures={nextFixtures}
          />

          {headlines.length > 0 && (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {headlines.map((h) => (
                <div
                  key={h.label}
                  className="rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-xs"
                >
                  <span className="font-semibold uppercase tracking-wide text-fg-muted">
                    {h.label}:{" "}
                  </span>
                  {h.href ? (
                    <Link href={h.href} className="text-fg-secondary hover:underline">
                      {h.text}
                    </Link>
                  ) : (
                    <span className="text-fg-secondary">{h.text}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {isDrafting && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Draft is underway
          {currentPickNo ? ` — pick ${currentPickNo} of ${totalPicks}` : ""}. Standings will
          fill in once the season kicks off.
        </div>
      )}

      {!isDrafting && !seasonHasStarted && (
        <div className="mb-6 rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-fg-secondary">
          No games played yet this season. Every team starts level.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-row text-left text-xs uppercase tracking-wide text-fg-muted">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 text-center font-medium">W-L-D</th>
              <th className="px-3 py-2 text-right font-medium">PF</th>
              <th className="px-3 py-2 text-right font-medium">PA</th>
              <th className="px-3 py-2 text-right font-medium">Diff</th>
              <th className="px-3 py-2 text-right font-medium">Avg</th>
              <th className="px-3 py-2 text-right font-medium">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rank = i + 1;
              const name = row.user ? teamNameForUser(row.user) : `Roster ${row.roster.roster_id}`;
              const avatarUrl = row.user ? avatarUrlForUser(row.user) : null;
              return (
                <Fragment key={row.roster.roster_id}>
                  <StandingsRow
                    rosterId={row.roster.roster_id}
                    rank={rank}
                    name={name}
                    avatarUrl={avatarUrl}
                    wins={row.wins}
                    losses={row.losses}
                    ties={row.ties}
                    pointsFor={row.pointsFor}
                    pointsAgainst={row.pointsAgainst}
                    form={recentForm(row.roster.metadata?.record)}
                  />
                  {rank === playoffCutoff && rank < rows.length && (
                    <tr aria-hidden>
                      <td colSpan={8} className="border-b-2 border-dashed border-page-standings/60 p-0">
                        <span className="sr-only">Playoff cutoff</span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {playoffCutoff > 0 && playoffCutoff < rows.length && (
        <p className="mt-2 text-xs text-fg-muted">
          Dashed line marks the playoff cutoff — top {playoffCutoff} qualify.
        </p>
      )}

      {bracket.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-semibold text-fg-primary">Current Playoff Bracket</h2>
          <p className="mb-3 text-sm text-fg-secondary">
            Seeded from current standings — updates as the regular season plays out.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {bracket.map((match) => (
              <div
                key={match.matchNumber}
                className="rounded-lg border border-surface-border bg-surface-card p-3"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-page-standings">
                  {match.roundLabel}
                </p>
                <div className="space-y-1 text-sm">
                  <div
                    className={`truncate ${
                      match.winnerLabel === match.team1Label
                        ? "font-semibold text-win"
                        : "text-fg-primary"
                    }`}
                  >
                    {match.team1Label}
                  </div>
                  <div
                    className={`truncate ${
                      match.winnerLabel === match.team2Label
                        ? "font-semibold text-win"
                        : "text-fg-primary"
                    }`}
                  >
                    {match.team2Label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
