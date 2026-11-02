"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useLocalAutosave } from "@/features/use-local-autosave";
import { createLocalId } from "@/lib/offline/identity";

import { standHref } from "./stand-list";

import type { LocalRepository } from "@/lib/offline/repository";
import type { LocalContext, LocalPersonalStand, PersonalStandInput } from "@/types/offline";

type EditorState = {
  status: "loading";
} | {
  status: "error";
} | {
  status: "missing";
} | {
  status: "ready";
  id: string;
  record: LocalPersonalStand | undefined;
};

export function usePersonalStand(repository: LocalRepository, context: LocalContext, standId?: string) {
  const [state, setState] = useState<EditorState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const { profileId, eventId } = context;

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const id = standId ?? new URLSearchParams(window.location.search).get("id") ?? createLocalId();

        if (standId === undefined) {
          const url = new URL(window.location.href);

          url.searchParams.set("id", id);
          window.history.replaceState(window.history.state, "", url);
        }
        const record = await repository.getPersonalStand({
          profileId,
          eventId,
        }, id);

        if (!disposed) {
          setState((standId !== undefined && record === undefined)
            || typeof record?.lastValid?.deletedAt === "string" ? {
              status: "missing",
            } : {
              status: "ready",
              id,
              record,
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
    };
  }, [
    repository, profileId, eventId, standId, attempt,
  ]);

  return {
    state,
    retry: () => {
      setState({
        status: "loading",
      });
      setAttempt((value) => value + 1);
    },
  };
}

export function usePersonalStandEditor(
  repository: LocalRepository,
  context: LocalContext,
  id: string,
  record: LocalPersonalStand | undefined,
) {
  const router = useRouter();
  const [hasStand, setHasStand] = useState(record?.lastValid !== undefined && record.lastValid !== null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { profileId, eventId } = context;
  const write = useCallback(async (input: PersonalStandInput) => {
    const saved = await repository.savePersonalStand({
      profileId,
      eventId,
    }, id, input);

    setHasStand(saved.lastValid !== null);
  }, [
    repository, profileId, eventId, id,
  ]);
  const detailHref = standHref({
    id,
    source: "personal",
  });
  const autosave = useLocalAutosave(record?.input ?? {
    name: "",
    description: "",
    categoryIds: [],
    hall: null,
    booth: "",
  }, write, hasStand ? detailHref : "/stands");

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      if (!await autosave.retry()) {
        setDeleteError("Completa il salvataggio prima di eliminare lo stand.");

        return;
      }
      await repository.deletePersonalStand(context, id);
      router.replace("/stands");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Stand non eliminato. Riprova.");
    } finally {
      setDeleting(false);
    }
  }

  return {
    autosave,
    hasStand,
    confirm,
    deleting,
    deleteError,
    remove,
    openConfirm: () => {
      setConfirm(true);
    },
    cancel: () => {
      setConfirm(false);
      setDeleteError(null);
    },
  };
}
