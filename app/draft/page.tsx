import {
  LEAGUE_ID,
  avatarUrlForUser,
  getDraft,
  getDraftPicks,
  getLeague,
  getUsers,
  teamNameForUser,
} from "@/lib/sleeper";
import type { SleeperDraftPick, SleeperUser } from "@/lib/types";
import { DraftGradesFileSchema } from "@/lib/ai/schemas";
import draftGradesRaw from "@/data/draft-grades.json";

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-amber-500/15 text-amber-300",
  D: "bg-sky-500/15 text-sky-300",
  M: "bg-emerald-500/15 text-emerald-300",
  F: "bg-rose-500/15 text-rose-300",
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-500/20 text-emerald-300",
  A: "bg-emerald-500/20 text-emerald-300",
  "A-": "bg-emerald-500/20 text-emerald-300",
  "B+": "bg-teal-500/20 text-teal-300",
  B: "bg-teal-500/20 text-teal-300",
  "B-": "bg-teal-500/20 text-teal-300",
  "C+": "bg-amber-500/20 text-amber-300",
  C: "bg-amber-500/20 text-amber-300",
  "C-": "bg-amber-500/20 text-amber-300",
  "D+": "bg-orange-500/20 text-orange-300",
  D: "bg-orange-500/20 text-orange-300",
  "D-": "bg-orange-500/20 text-orange-300",
  F: "bg-rose-500/20 text-rose-300",
};

function PickCell({ pick, isOnTheClock }: { pick: SleeperDraftPick | undefined; isOnTheClock: boolean }) {
  if (!pick) {
    return (
      <div
        className={`flex h-16 w-32 shrink-0 flex-col items-center justify-center rounded border text-xs ${
          isOnTheClock
            ? "border-page-draft/50 bg-page-draft/10 text-page-draft"
            : "border-dashed border-surface-border text-fg-muted"
        }`}
      >
        {isOnTheClock ? "On the clock" : "—"}
      </div>
    );
  }

  const posColor = POSITION_COLORS[pick.metadata.position] ?? "bg-surface-row text-fg-secondary";

  return (
    <div className="flex h-16 w-32 shrink-0 flex-col justify-between rounded border border-surface-border bg-surface-card px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className={`rounded px-1 text-[10px] font-semibold ${posColor}`}>
          {pick.metadata.position}
        </span>
        <span className="font-mono text-[10px] text-fg-secondary">#{pick.pick_no}</span>
      </div>
      <div className="truncate text-xs font-medium leading-tight text-fg-primary">
        {pick.metadata.first_name} {pick.metadata.last_name}
      </div>
      <div className="text-[10px] text-fg-secondary">{pick.metadata.team_abbr}</div>
    </div>
  );
}

export default async function DraftPage() {
  const league = await getLeague(LEAGUE_ID);
  if (!league?.draft_id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-fg-secondary">
        No draft found for this league yet.
      </div>
    );
  }

  const [draft, picks, users] = await Promise.all([
    getDraft(league.draft_id),
    getDraftPicks(league.draft_id),
    getUsers(LEAGUE_ID),
  ]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-fg-secondary">
        Couldn&apos;t load draft details. Try again shortly.
      </div>
    );
  }

  const usersById = new Map<string, SleeperUser>(users.map((u) => [u.user_id, u]));
  const slotToUserId = new Map<number, string>();
  if (draft.draft_order) {
    for (const [userId, slot] of Object.entries(draft.draft_order)) {
      slotToUserId.set(slot, userId);
    }
  }

  const rounds = draft.settings.rounds;
  const teams = draft.settings.teams;
  const slots = Array.from({ length: teams }, (_, i) => i + 1);

  const picksByRoundSlot = new Map<string, SleeperDraftPick>();
  for (const pick of picks) {
    picksByRoundSlot.set(`${pick.round}-${pick.draft_slot}`, pick);
  }

  const currentPickNo = draft.status === "drafting" ? picks.length + 1 : null;
  const currentRound = currentPickNo ? Math.ceil(currentPickNo / teams) : null;
  const positionInRound = currentPickNo ? ((currentPickNo - 1) % teams) + 1 : null;
  // Snake draft: even rounds go right-to-left.
  const currentSlot =
    currentRound && positionInRound
      ? currentRound % 2 === 1
        ? positionInRound
        : teams - positionInRound + 1
      : null;

  const draftGrades = DraftGradesFileSchema.parse(draftGradesRaw);
  const isPlaceholderGrades = draftGrades.grades.every((g) => g.best_pick.player_name === "TBD");
  const gradesByRosterId = new Map(draftGrades.grades.map((g) => [g.roster_id, g]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="mb-6 border-b-2 border-page-draft pb-3">
        <p className="text-sm font-medium text-page-draft">{league.season} Season</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg-primary sm:text-3xl">Draft</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          {draft.type === "snake" ? "Snake draft" : draft.type} · {rounds} rounds · {teams} teams
          {draft.status === "drafting" && currentPickNo ? ` · pick ${currentPickNo} of ${rounds * teams}` : ""}
        </p>
      </header>

      <h2 className="mb-3 text-lg font-semibold text-fg-primary">Board</h2>
      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <div className="inline-block min-w-full">
          {/* Header row: team names per slot */}
          <div className="flex border-b border-surface-border bg-surface-row">
            <div className="flex h-12 w-10 shrink-0 items-center justify-center text-xs font-medium text-fg-muted">
              Rd
            </div>
            {slots.map((slot) => {
              const userId = slotToUserId.get(slot);
              const user = userId ? usersById.get(userId) : null;
              const name = user ? teamNameForUser(user) : `Slot ${slot}`;
              const avatarUrl = user ? avatarUrlForUser(user) : null;
              return (
                <div
                  key={slot}
                  className="flex h-12 w-32 shrink-0 flex-col items-center justify-center gap-0.5 px-1"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full border border-surface-border bg-surface-row"
                    />
                  ) : null}
                  <span className="max-w-full truncate text-[10px] font-medium text-fg-secondary">
                    {name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rounds */}
          {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
            <div key={round} className="flex border-b border-surface-border/60 last:border-0">
              <div className="flex w-10 shrink-0 items-center justify-center font-mono text-xs text-fg-muted">
                {round}
              </div>
              {slots.map((slot) => {
                const pick = picksByRoundSlot.get(`${round}-${slot}`);
                const isOnTheClock = round === currentRound && slot === currentSlot;
                return (
                  <div key={slot} className="p-0.5">
                    <PickCell pick={pick} isOnTheClock={isOnTheClock} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-1 mt-10 text-lg font-semibold text-fg-primary">Grades</h2>
      {isPlaceholderGrades ? (
        <p className="mb-4 text-sm text-amber-300">
          Real grades haven&apos;t been generated yet — showing placeholders. Run{" "}
          <code className="rounded bg-surface-row px-1 py-0.5 text-xs">
            npm run grades:generate
          </code>{" "}
          to fill this in.
        </p>
      ) : (
        <p className="mb-4 text-sm text-fg-secondary">
          Generated {new Date(draftGrades.generated_at).toLocaleDateString()}.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slots.map((slot) => {
          const userId = slotToUserId.get(slot);
          const user = userId ? usersById.get(userId) : null;
          if (!user) return null;
          // Find this user's roster_id via draft picks (owner's picks all share one roster_id).
          const ownerPick = picks.find((p) => p.picked_by === userId);
          const rosterId = ownerPick?.roster_id;
          const grade = rosterId ? gradesByRosterId.get(rosterId) : undefined;
          if (!grade) return null;

          return (
            <div
              key={slot}
              className="rounded-lg border border-surface-border bg-surface-card p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-fg-primary">{grade.manager_name}</span>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-sm font-bold ${
                    GRADE_COLORS[grade.grade] ?? "bg-surface-row text-fg-secondary"
                  }`}
                >
                  {grade.grade}
                </span>
              </div>
              <p className="mb-3 text-sm text-fg-secondary">{grade.summary}</p>
              <div className="space-y-1 text-xs">
                <p>
                  <span className="font-semibold text-win">Best pick: </span>
                  <span className="text-fg-secondary">{grade.best_pick.player_name}</span>
                  <span className="text-fg-muted"> — {grade.best_pick.reason}</span>
                </p>
                <p>
                  <span className="font-semibold text-loss">Worst pick: </span>
                  <span className="text-fg-secondary">{grade.worst_pick.player_name}</span>
                  <span className="text-fg-muted"> — {grade.worst_pick.reason}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
