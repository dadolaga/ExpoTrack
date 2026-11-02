"use client";

import { useCallback } from "react";

import { useLocalAutosave } from "@/features/use-local-autosave";

import { standHref } from "./stand-list";

import type { LocalRepository } from "@/lib/offline/repository";
import type { StandReference } from "@/types/catalog";
import type { LocalContext } from "@/types/offline";

export function useStandNotes(
  repository: LocalRepository,
  context: LocalContext,
  standId: string,
  initialValue: string,
  source: StandReference["source"] = "catalog",
) {
  const { profileId, eventId } = context;
  const write = useCallback((notes: string) => {
    return repository.saveStandPreferences({
      profileId,
      eventId,
    }, standId, {
      notes,
    }, source);
  }, [
    repository, profileId, eventId, standId, source,
  ]);
  const state = useLocalAutosave(initialValue, write, standHref({
    id: standId,
    source,
  }));

  return {
    ...state,
    text: state.value,
  };
}
