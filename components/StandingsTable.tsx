"use client";

import { Fragment, useState } from "react";
import { StandingsRow } from "./StandingsRow";

export interface StandingsTableRow {
  rosterId: number;
  name: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  form: ("W" | "L" | "T")[];
}

type SortKey = "rank" | "pf" | "pa" | "diff" | "avg";
type SortDirection = "asc" | "desc";

function sortValue(row: StandingsTableRow, key: SortKey): number {
  switch (key) {
    case "pf":
      return row.pointsFor;
    case "pa":
      return row.pointsAgainst;
    case "diff":
      return row.pointsFor - row.pointsAgainst;
    case "avg": {
      const played = row.wins + row.losses + row.ties;
      return played > 0 ? row.pointsFor / played : 0;
    }
    default:
      return 0; // "rank" sorts by the incoming (already standings-ordered) index instead
  }
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === activeKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 font-medium transition-colors ${
        align === "right" ? "ml-auto" : ""
      } ${active ? "text-page-standings" : "text-fg-muted hover:text-fg-secondary"}`}
    >
      {label}
      <span aria-hidden className={active ? "opacity-100" : "opacity-0"}>
        {direction === "asc" ? "▲" : "▼"}
      </span>
    </button>
  );
}

export function StandingsTable({
  rows,
  playoffCutoff,
}: {
  rows: StandingsTableRow[];
  playoffCutoff: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // "#" always shows each team's real standings position — computed once from the incoming
  // (already rank-ordered) list — regardless of which column the table is currently sorted
  // by for display. The playoff cutoff divider only makes sense against that real order, so
  // it's hidden whenever a different sort is active rather than drawn somewhere misleading.
  const withRank = rows.map((row, i) => ({ ...row, rank: i + 1 }));

  const displayRows =
    sortKey === "rank"
      ? withRank
      : [...withRank].sort((a, b) => {
          const diff = sortValue(a, sortKey) - sortValue(b, sortKey);
          return sortDir === "asc" ? diff : -diff;
        });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc"); // stats default to highest-first, rank to 1st-first
    }
  }

  return (
    <>
      <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-surface-border [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-row text-left text-xs uppercase tracking-wide text-fg-muted">
              <th className="px-3 py-2 font-medium">
                <SortableHeader
                  label="#"
                  sortKey="rank"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={handleSort}
                  align="left"
                />
              </th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 text-center font-medium">W-L-D</th>
              <th className="px-3 py-2 text-right font-medium">
                <SortableHeader label="PF" sortKey="pf" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <SortableHeader label="PA" sortKey="pa" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <SortableHeader label="Diff" sortKey="diff" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <SortableHeader label="Avg" sortKey="avg" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-2 text-right font-medium">Form</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <Fragment key={row.rosterId}>
                <StandingsRow
                  rosterId={row.rosterId}
                  rank={row.rank}
                  name={row.name}
                  avatarUrl={row.avatarUrl}
                  wins={row.wins}
                  losses={row.losses}
                  ties={row.ties}
                  pointsFor={row.pointsFor}
                  pointsAgainst={row.pointsAgainst}
                  form={row.form}
                />
                {sortKey === "rank" && row.rank === playoffCutoff && row.rank < rows.length && (
                  <tr aria-hidden>
                    <td colSpan={8} className="border-b-2 border-dashed border-page-standings/60 p-0">
                      <span className="sr-only">Playoff cutoff</span>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {sortKey === "rank" && playoffCutoff > 0 && playoffCutoff < rows.length && (
        <p className="mt-2 text-xs text-fg-muted">
          Dashed line marks the playoff cutoff — top {playoffCutoff} qualify.
        </p>
      )}
    </>
  );
}
