"use client";

import { useRouter } from "next/navigation";

export function SeasonSelect({
  seasons,
  selectedSeason,
}: {
  seasons: string[];
  selectedSeason: string;
}) {
  const router = useRouter();

  if (seasons.length < 2) {
    return <p className="text-sm font-medium text-page-results">{selectedSeason} Season</p>;
  }

  return (
    <select
      value={selectedSeason}
      onChange={(e) => router.push(`/results?season=${e.target.value}`)}
      aria-label="Select season"
      className="rounded border border-surface-border bg-surface-row px-2 py-1 text-sm font-medium text-page-results"
    >
      {seasons.map((s) => (
        <option key={s} value={s}>
          {s} Season
        </option>
      ))}
    </select>
  );
}
