"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "havenship:claimed-roster-id";

// Per-device "which team is mine" state, stored only in localStorage — never sent to the
// server, never shared between viewers. localStorage's own "storage" event only fires in
// OTHER tabs, not the one that made the change, so claim/unclaim also notify this small
// listener set directly to keep same-tab UI in sync.
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getServerSnapshot(): number | null {
  return null;
}

interface ClaimedTeamContextValue {
  claimedRosterId: number | null;
  claim: (rosterId: number) => void;
  unclaim: () => void;
}

const ClaimedTeamContext = createContext<ClaimedTeamContextValue | null>(null);

export function ClaimedTeamProvider({ children }: { children: ReactNode }) {
  const claimedRosterId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function claim(rosterId: number) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(rosterId));
    } catch {
      // Storage unavailable (private browsing, blocked site data) — nothing persists, so the
      // notify below is a no-op in effect (getSnapshot still returns the old value).
    }
    notify();
  }

  function unclaim() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
    notify();
  }

  return (
    <ClaimedTeamContext.Provider value={{ claimedRosterId, claim, unclaim }}>
      {children}
    </ClaimedTeamContext.Provider>
  );
}

export function useClaimedTeam(): ClaimedTeamContextValue {
  const ctx = useContext(ClaimedTeamContext);
  if (!ctx) throw new Error("useClaimedTeam must be used within a ClaimedTeamProvider");
  return ctx;
}
