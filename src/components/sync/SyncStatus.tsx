"use client";

import { useSyncExternalStore } from "react";

import Link from "@/lib/navigation";
import { emptySummary } from "@/lib/sync/engine";

import { useSyncEngine } from "./SyncProvider";

import type { SyncStatus as Status } from "@/types/sync";

const initial: Status = {
  phase: "idle",
  reachable: null,
  message: null,
  progress: null,
  summary: emptySummary,
};
const noopSubscribe = () => () => undefined;
const initialSnapshot = () => initial;

export function useSyncStatus() {
  const engine = useSyncEngine();

  return useSyncExternalStore(engine?.subscribe ?? noopSubscribe, engine?.snapshot ?? initialSnapshot, initialSnapshot);
}

export function syncLabel(status: Status) {
  const count = status.summary.pending.length + status.summary.recoveries.length;

  if (status.phase === "syncing") {
    return "Sincronizzazione…";
  }
  if (status.phase === "offline") {
    return "Offline · dati locali";
  }
  if (status.phase === "error") {
    return "Sincronizzazione da riprovare";
  }
  if (count > 0) {
    return "Modifiche da inviare";
  }
  if (status.summary.localPhotos > 0) {
    return "Foto locali · completa il prodotto";
  }
  if (status.summary.missingPhotos > 0) {
    return "Foto da scaricare";
  }

  return status.summary.lastSyncedAt === null ? "Dati locali" : "Sincronizzato";
}

export function SyncIndicator() {
  const status = useSyncStatus();
  const count = status.summary.pending.length + status.summary.recoveries.length;

  return (
    <Link
      href="/sync"
      className="sync-indicator"
      aria-label={`Apri sincronizzazione: ${syncLabel(status)}, ${count} operazioni da confermare`}
    >
      <span aria-hidden="true">↻</span>
      <span className="sync-indicator-label">{syncLabel(status)}</span>
      {count > 0 && <span className="sync-count">{count}</span>}
    </Link>
  );
}
