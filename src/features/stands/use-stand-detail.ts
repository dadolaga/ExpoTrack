"use client";

import { useEffect, useRef, useState } from "react";

import { resolveStandDetail } from "./stand-list";

import type { LocalRepository } from "../../lib/offline/repository";
import type { CatalogSnapshot } from "../../types/catalog";
import type {
  LocalContext, LocalStandPreferences, ProductData, StandPreferencesPatch,
} from "../../types/offline";

export function useStandDetail(
  repository: LocalRepository,
  catalog: CatalogSnapshot,
  context: LocalContext,
  standId: string,
) {
  const [data, setData] = useState<{
    preferences: LocalStandPreferences[];
    products: ProductData[];
  } | null>(null);
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
        const [preferences, products] = await Promise.all([
          repository.listStandPreferences({
            profileId,
            eventId,
          }),
          repository.listRegisteredProducts({
            profileId,
            eventId,
          }),
        ]);

        if (!disposed) {
          setData({
            preferences,
            products,
          });
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
      }, standId, changes);

      if (active.current) {
        setData((previous) => previous === null ? null : {
          ...previous,
          preferences: [...previous.preferences.filter((entry) => entry.standRef.standId !== standId), record],
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
    detail: data === null ? null : resolveStandDetail(catalog, context, standId, data.preferences, data.products),
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
