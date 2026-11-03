"use client";

import {
  createContext, useContext, useEffect, useState,
} from "react";

import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { SyncEngine } from "@/lib/sync/engine";

import type { ReactNode } from "react";

const SyncContext = createContext<SyncEngine | null>(null);

export function SyncProvider({ children }: {
  children: ReactNode;
}) {
  const { state, refreshSession } = useProfileSession();
  const repository = state.status === "ready" ? state.repository : null;
  const [engine, setEngine] = useState<SyncEngine | null>(null);

  useEffect(() => {
    if (repository === null) {
      return;
    }
    const next = new SyncEngine(repository);
    const stop = next.start();
    const unsubscribe = repository.subscribe((kind) => {
      if (kind === "remote") {
        void refreshSession().catch(() => undefined);
      }
    });

    // Publish after subscribing so consumers see the initialized engine.
    queueMicrotask(() => {
      setEngine(next);
    });

    return () => {
      stop();
      unsubscribe();
    };
  }, [repository, refreshSession]);

  return <SyncContext.Provider value={repository === null ? null : engine}>{children}</SyncContext.Provider>;
}

export function useSyncEngine() {
  return useContext(SyncContext);
}
