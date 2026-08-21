import { LEAGUE_ID, avatarUrlForUser, getLeague, getUsers } from "@/lib/sleeper";
import { PowerRankingsFileSchema } from "@/lib/ai/schemas";
import powerRankingsRaw from "@/data/power-rankings.json";

export default async function PowerRankingsPage() {
  const league = await getLeague(LEAGUE_ID);
  const users = await getUsers(LEAGUE_ID);
  const rankings = PowerRankingsFileSchema.parse(powerRankingsRaw);

  const isPlaceholder = rankings.rankings.every((r) => r.blurb.startsWith("Placeholder data"));
  const sorted = [...rankings.rankings].sort((a, b) => a.rank - b.rank);

  // Best-effort avatar lookup by matching manager_name to a user's team name/display name.
  const usersByName = new Map(
    users.map((u) => [u.metadata?.team_name?.trim() || u.display_name, u])
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-400">
          {league?.season ?? rankings.season} Season
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Power Rankings</h1>
        <p className="mt-1 text-sm text-neutral-300">
          {rankings.basis === "preseason_draft"
            ? "Preseason — based on draft value, since no gameweeks have been played yet."
            : "Based on recent form and results."}
        </p>
        {isPlaceholder ? (
          <p className="mt-2 text-sm text-amber-300">
            Real rankings haven&apos;t been generated yet — showing placeholders. Run{" "}
            <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">
              npm run rankings:generate
            </code>{" "}
            to fill this in.
          </p>
        ) : (
          <p className="mt-2 text-xs text-neutral-400">
            Generated {new Date(rankings.generated_at).toLocaleDateString()}
          </p>
        )}
      </header>

      <ol className="space-y-3">
        {sorted.map((entry) => {
          const user = usersByName.get(entry.manager_name);
          const avatarUrl = user ? avatarUrlForUser(user) : null;
          return (
            <li
              key={entry.roster_id}
              className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-300">
                  {entry.rank}
                </span>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full bg-neutral-800"
                  />
                ) : null}
                <span className="font-medium text-neutral-200">{entry.manager_name}</span>
                {entry.movement_note ? (
                  <span className="ml-auto shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">
                    {entry.movement_note}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-neutral-300">{entry.blurb}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
