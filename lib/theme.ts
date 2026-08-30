// Shared helpers for the site's color system (see app/globals.css --color-* tokens).

/** Gold/silver/bronze for ranks 1-3, muted for everything else — used anywhere a ranked list
 * or standings position is shown. Only the rank itself is colored; PF/PA/record stay
 * achromatic so the color still means something. */
export function rankColorClass(rank: number): string {
  if (rank === 1) return "text-gold";
  if (rank === 2) return "text-silver";
  if (rank === 3) return "text-bronze";
  return "text-fg-muted";
}
