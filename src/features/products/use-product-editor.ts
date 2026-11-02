"use client";

import { useRouter } from "next/navigation";
import {
  useCallback, useEffect, useRef, useState,
} from "react";

import { useLocalAutosave } from "@/features/use-local-autosave";
import { createLocalId } from "@/lib/offline/identity";
import { isProductDeleted } from "@/lib/offline/product-input";

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
        // Read the URL segment once: the installed router retains its percent encoding in params.
        const existingId = productId === undefined ? undefined
          : decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf("/") + 1));
        let id = existingId ?? (planned === undefined
          ? (sameScope ? params.get("id") : null) ?? createLocalId() : `planned:${planned.id}`);
        let record = await repository.getProduct({
          profileId,
          eventId,
        }, id);

        // A new registration after deletion gets a fresh identity shared by concurrent openings.
        while (planned !== undefined && isProductDeleted(record) && record !== undefined) {
          id = `${id}:after:${record.latestOperationId ?? record.updatedAt}`;
          record = await repository.getProduct({
            profileId,
            eventId,
          }, id);
        }
        const source = params.get("source");
        const initial: ProductInput = record?.input ?? {
          name: planned?.name ?? "",
          categoryId: planned?.categoryId ?? null,
          description: planned?.description ?? "",
          plannedProductId: planned?.id ?? null,
          standRef: planned?.standRef ?? (sameScope && params.has("stand")
            && (source === "catalog" || source === "personal") ? {
              source,
              eventId,
              standId: params.get("stand") ?? "",
            } : null),
        };
        const requestedReturn = params.get("return") ?? "/products";
        const returnHref = /^(?:\/products|\/stands\/(?:personal\/)?[^/?#]+)(?:\?[^#]*)?$/u.test(requestedReturn)
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
          setState((productId !== undefined && record === undefined) || isProductDeleted(record) ? {
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
  const router = useRouter();
  const [record, setRecord] = useState(loaded.record);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pending = useRef(false);
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

  async function act(action: "duplicate" | "delete") {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setBusy(true);
    setActionError(null);
    try {
      if (!await autosave.retry()) {
        throw new Error("Completa il salvataggio sul dispositivo e riprova.");
      }
      if (action === "duplicate") {
        const copy = await repository.duplicateProduct(context, loaded.id);
        const query = new URLSearchParams({
          return: loaded.returnHref,
        });

        router.replace(`/products/${encodeURIComponent(copy.id)}?${query}`);
      } else {
        await repository.deleteProduct(context, loaded.id);
        router.replace(loaded.returnHref);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Operazione non riuscita. Riprova.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return {
    autosave,
    record,
    busy,
    confirm,
    actionError,
    duplicate: () => {
      void act("duplicate");
    },
    remove: () => {
      void act("delete");
    },
    openConfirm: () => {
      setActionError(null);
      setConfirm(true);
    },
    cancel: () => {
      setConfirm(false);
      setActionError(null);
    },
  };
}
