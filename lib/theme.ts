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

/** Background color for a single result dot in a "form" strip (last N results). */
export function formDotColorClass(result: "W" | "L" | "T"): string {
  if (result === "W") return "bg-win";
  if (result === "L") return "bg-loss";
  return "bg-draw";
}

/** Last `count` results from a roster's metadata.record string (chronological, oldest to
 * newest — matches how Sleeper appends to it week over week), most recent last. */
export function recentForm(record: string | undefined, count = 5): ("W" | "L" | "T")[] {
  if (!record) return [];
  const chars = record.split("").filter((c): c is "W" | "L" | "T" => c === "W" || c === "L" || c === "T");
  return chars.slice(-count);
}
