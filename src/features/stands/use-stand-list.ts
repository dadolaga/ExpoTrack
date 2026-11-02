"use client";

import { useEffect, useRef, useState } from "react";

import { resolveStandList, standKey } from "./stand-list";

import type { LocalRepository } from "../../lib/offline/repository";
import type { CatalogSnapshot, StandReference } from "../../types/catalog";
import type { LocalContext, VisitData } from "../../types/offline";

type LoadState = {
  status: "loading";
} | {
  status: "error";
} | {
  status: "ready";
  data: VisitData;
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
    source: StandReference["source"];
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
        const data = await repository.getVisitData({
          profileId,
          eventId,
        });

        if (!disposed) {
          setState({
            status: "ready",
            data,
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

  async function changeInterest(standId: string, interested: boolean, source: StandReference["source"]) {
    const key = standKey(source, standId);

    if (pending.current.has(key)) {
      return;
    }
    pending.current.add(key);
    setSaving([...pending.current]);
    setFailed(null);
    setSaved(false);

    try {
      const record = await repository.setStandInterest({
        profileId,
        eventId,
      }, standId, interested, source);

      if (active.current) {
        setState((previous) => previous.status !== "ready" ? previous : {
          status: "ready",
          data: {
            ...previous.data,
            preferences: [
              ...previous.data.preferences.filter((entry) =>
                standKey(entry.standRef.source, entry.standRef.standId) !== key), record,
            ],
          },
        });
        setSaved(true);
      }
    } catch {
      if (active.current) {
        setFailed({
          standId,
          interested,
          source,
        });
      }
    } finally {
      pending.current.delete(key);
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
    items: state.status === "ready" ? resolveStandList(catalog, context, state.data.preferences, state.data.personalStands) : [],
    products: state.status === "ready" ? state.data.products : [],
    saving,
    failed,
    saved,
    changeInterest,
    retryLoad,
  };
}
