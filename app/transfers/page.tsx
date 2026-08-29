import {
  LEAGUE_ID,
  getLeague,
  getRosters,
  getSeasonState,
  getTransactions,
  getUsers,
  teamNameForUser,
} from "@/lib/sleeper";
import { buildPlayerDictionaryWithFallback } from "@/lib/player-dictionary";
import type { SleeperTransaction } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  waiver: "Waiver",
  free_agent: "Free Agent",
  trade: "Trade",
};

function playerLabel(playerId: string, dict: Map<string, { name: string; position: string; club: string }>) {
  const info = dict.get(playerId);
  return info ? `${info.name} (${info.position}, ${info.club})` : `Player #${playerId}`;
}

export default async function TransfersPage() {
  const league = await getLeague(LEAGUE_ID);

  if (!league) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-neutral-300">
        Couldn&apos;t reach the Sleeper API for this league. Try again shortly.
      </div>
    );
  }

  const state = await getSeasonState();
  const currentWeek = state?.week ?? 1;

  const [rosters, users, ...weeklyTransactions] = await Promise.all([
    getRosters(LEAGUE_ID),
    getUsers(LEAGUE_ID),
    ...Array.from({ length: currentWeek }, (_, i) => getTransactions(LEAGUE_ID, i + 1)),
  ]);

  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));
  const managerNameForRoster = (rosterId: number) => {
    const roster = rostersById.get(rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : null;
    return user ? teamNameForUser(user) : `Roster ${rosterId}`;
  };

  const allTransactions = weeklyTransactions
    .flat()
    .filter((t): t is SleeperTransaction => t.status === "complete")
    .sort((a, b) => b.created - a.created);

  const referencedPlayerIds = Array.from(
    new Set(
      allTransactions.flatMap((tx) => [
        ...(tx.adds ? Object.keys(tx.adds) : []),
        ...(tx.drops ? Object.keys(tx.drops) : []),
      ])
    )
  );
  const playerDict = await buildPlayerDictionaryWithFallback(LEAGUE_ID, referencedPlayerIds);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-400">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Transfers</h1>
      </header>

      {allTransactions.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-300">
          No transfer activity yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {allTransactions.map((tx) => {
            const rosterId = tx.roster_ids[0];
            const managerName = managerNameForRoster(rosterId);
            const adds = tx.adds ? Object.keys(tx.adds) : [];
            const drops = tx.drops ? Object.keys(tx.drops) : [];
            const date = new Date(tx.created).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            });

            return (
              <li
                key={tx.transaction_id}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-neutral-400">
                  <span className="font-semibold text-neutral-300">{managerName}</span>
                  <span>
                    {TYPE_LABELS[tx.type] ?? tx.type} · {date}
                  </span>
                </div>
                <div className="space-y-0.5 text-sm">
                  {adds.map((playerId) => (
                    <p key={`add-${playerId}`} className="text-emerald-400">
                      + {playerLabel(playerId, playerDict)}
                    </p>
                  ))}
                  {drops.map((playerId) => (
                    <p key={`drop-${playerId}`} className="text-rose-400">
                      − {playerLabel(playerId, playerDict)}
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
