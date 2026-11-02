"use client";

import { useCallback, useEffect, useState } from "react";

import { useLocalAutosave } from "@/features/use-local-autosave";
import { createLocalId } from "@/lib/offline/identity";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { LocalContext, LocalProduct, ProductInput } from "@/types/offline";

type Loaded = {
  status: "ready";
  id: string;
  record: LocalProduct | undefined;
  initial: ProductInput;
  returnHref: string;
};
type LoadState = Loaded | {
  status: "loading" | "error" | "missing";
};

export function useProductLoader(
  repository: LocalRepository,
  catalog: CatalogSnapshot,
  context: LocalContext,
  productId?: string,
) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const { profileId, eventId } = context;

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const scope = JSON.stringify([profileId, eventId]);
        const sameScope = params.get("scope") === null || params.get("scope") === scope;
        const planned = sameScope ? catalog.plannedProducts.find((entry) => entry.id === params.get("planned")
          && entry.profileId === profileId && entry.standRef.eventId === eventId) : undefined;
        const id = productId ?? (planned === undefined
          ? (sameScope ? params.get("id") : null) ?? createLocalId() : `planned:${planned.id}`);
        const record = await repository.getProduct({
          profileId,
          eventId,
        }, id);
        const source = params.get("source");
        const initial: ProductInput = record?.input ?? {
          name: planned?.name ?? "",
          categoryId: planned?.categoryId ?? null,
          description: planned?.description ?? "",
          standRef: planned?.standRef ?? (sameScope && params.has("stand")
            && (source === "catalog" || source === "personal") ? {
              source,
              eventId,
              standId: params.get("stand") ?? "",
            } : null),
        };
        const requestedReturn = params.get("return") ?? "/products";
        const returnHref = /^\/stands\/(?:personal\/)?[^/?#]+(?:\?[^#]*)?$/u.test(requestedReturn)
          ? requestedReturn : "/products";

        if (productId === undefined) {
          params.set("id", id);
          params.set("scope", scope);
          if (record === undefined && initial.standRef === null && !params.has("view")) {
            params.set("view", "stands");
          }
          if (!sameScope) {
            for (const key of [
              "stand", "source", "planned", "view",
            ]) {
              params.delete(key);
            }
          }
          window.history.replaceState(null, "", url);
        }
        if (!disposed) {
          setState(productId !== undefined && record === undefined ? {
            status: "missing",
          }
            : {
              status: "ready",
              id,
              record,
              initial,
              returnHref,
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
    repository, catalog, profileId, eventId, productId, attempt,
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

export function useProductEditor(repository: LocalRepository, context: LocalContext, loaded: Loaded) {
  const [record, setRecord] = useState(loaded.record);
  const { profileId, eventId } = context;
  const write = useCallback(async (input: ProductInput) => {
    const saved = await repository.saveProduct({
      profileId,
      eventId,
    }, loaded.id, input);

    setRecord(saved);
  }, [
    repository, profileId, eventId, loaded.id,
  ]);
  const autosave = useLocalAutosave(loaded.initial, write, loaded.returnHref);

  return {
    autosave,
    record,
  };
}
