"use client";

import { useClaimedTeam } from "./ClaimedTeamProvider";

export function ClaimTeamButton({ rosterId }: { rosterId: number }) {
  const { claimedRosterId, claim, unclaim } = useClaimedTeam();
  const isMine = claimedRosterId === rosterId;

  return (
    <button
      type="button"
      onClick={() => (isMine ? unclaim() : claim(rosterId))}
      className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
        isMine ? "text-accent" : "text-fg-muted hover:text-fg-secondary"
      }`}
    >
      {isMine ? "★ This is your team" : "☆ Claim this team as yours"}
    </button>
  );
}
