import Link from "next/link";
import { playerImageUrl } from "@/lib/player-image";

export function PlayerLink({
  playerId,
  name,
  className,
}: {
  playerId: string;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={`/players/${playerId}`}
      className={`inline-flex min-w-0 items-center gap-1.5 hover:underline ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={playerImageUrl(playerId)}
        alt=""
        className="h-5 w-5 shrink-0 rounded-full border border-surface-border bg-surface-row object-cover"
      />
      <span className="truncate">{name}</span>
    </Link>
  );
}
