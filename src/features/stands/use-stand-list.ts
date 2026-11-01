"use client";

import { useEffect, useRef, useState } from "react";

import { resolveStandList } from "./stand-list";

import type { LocalRepository } from "../../lib/offline/repository";
import type { CatalogSnapshot } from "../../types/catalog";
import type { LocalContext, LocalStandPreferences } from "../../types/offline";

type LoadState = {
  status: "loading";
} | {
  status: "error";
} | {
  status: "ready";
  preferences: LocalStandPreferences[];
};

export function useStandList(repository: LocalRepository, catalog: CatalogSnapshot, context: LocalContext) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState<string[]>([]);
  const [failed, setFailed] = useState<{
    standId: string;
    interested: boolean;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef(new Set<string>());
  const active = useRef(false);
  const { profileId, eventId } = context;

  useEffect(() => {
    let disposed = false;

    active.current = true;

    async function load() {
      try {
        const preferences = await repository.listStandPreferences({
          profileId,
          eventId,
        });

        if (!disposed) {
          setState({
            status: "ready",
            preferences,
          });
        }
      } catch {
        if (!disposed) {
          setState({
            status: "error",
          });
        }
      }
    }

    void load();

    return () => {
      disposed = true;
      active.current = false;
    };
  }, [
    repository, profileId, eventId, attempt,
  ]);

  async function changeInterest(standId: string, interested: boolean) {
    if (pending.current.has(standId)) {
      return;
    }
    pending.current.add(standId);
    setSaving([...pending.current]);
    setFailed(null);
    setSaved(false);

    try {
      const record = await repository.setStandInterest({
        profileId,
        eventId,
      }, standId, interested);

      if (active.current) {
        setState((previous) => previous.status !== "ready" ? previous : {
          status: "ready",
          preferences: [...previous.preferences.filter((entry) => entry.standRef.standId !== standId), record],
        });
        setSaved(true);
      }
    } catch {
      if (active.current) {
        setFailed({
          standId,
          interested,
        });
      }
    } finally {
      pending.current.delete(standId);
      if (active.current) {
        setSaving([...pending.current]);
      }
    }
  }

  function retryLoad() {
    setState({
      status: "loading",
    });
    setAttempt((value) => value + 1);
  }

  return {
    status: state.status,
    items: state.status === "ready" ? resolveStandList(catalog, context, state.preferences) : [],
    saving,
    failed,
    saved,
    changeInterest,
    retryLoad,
  };
}
