"use client";

import { useEffect, useRef, useState } from "react";

import { resolveStandDetail, standKey } from "./stand-list";

import type { LocalRepository } from "../../lib/offline/repository";
import type { CatalogSnapshot, StandReference } from "../../types/catalog";
import type {
  LocalContext, VisitData, StandPreferencesPatch,
} from "../../types/offline";

export function useStandDetail(
  repository: LocalRepository,
  catalog: CatalogSnapshot,
  context: LocalContext,
  standId: string,
  source: StandReference["source"] = "catalog",
) {
  const [data, setData] = useState<VisitData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<StandPreferencesPatch | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const active = useRef(false);
  const { profileId, eventId } = context;

  useEffect(() => {
    let disposed = false;

    active.current = true;

    async function load() {
      try {
        const loaded = await repository.getVisitData({
          profileId,
          eventId,
        });

        if (!disposed) {
          setData(loaded);
          setLoadError(false);
        }
      } catch {
        if (!disposed) {
          setLoadError(true);
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

  async function save(changes: StandPreferencesPatch): Promise<boolean> {
    if (pending.current) {
      return false;
    }
    pending.current = true;
    setSaving(true);
    setFailed(null);
    setSaved(false);

    try {
      const record = await repository.saveStandPreferences({
        profileId,
        eventId,
      }, standId, changes, source);

      if (active.current) {
        setData((previous) => previous === null ? null : {
          ...previous,
          preferences: [
            ...previous.preferences.filter((entry) => {
              return standKey(entry.standRef.source, entry.standRef.standId) !== standKey(source, standId);
            }), record,
          ],
        });
        setSaved(true);
      }

      return true;
    } catch {
      if (active.current) {
        setFailed(changes);
      }

      return false;
    } finally {
      pending.current = false;
      if (active.current) {
        setSaving(false);
      }
    }
  }

  return {
    loading: data === null,
    loadError,
    detail: data === null ? null : resolveStandDetail(
      catalog,
      context,
      standId,
      data.preferences,
      data.products,
      data.personalStands,
      source,
    ),
    saving,
    saved,
    failed,
    save,
    retryLoad: () => {
      setLoadError(false);
      setAttempt((value) => value + 1);
    },
  };
}
