"use client";

import { useEffect, useState } from "react";

import { useRemoteRevision } from "@/features/use-local-revision";
import { useSearchParams } from "@/lib/navigation";

import { productFiltersQuery, readProductFilters, resolveProductList } from "./product-list";

import type { ProductFilters, ProductListItem } from "./product-list";
import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { LocalContext } from "@/types/offline";

export function useProductList(repository: LocalRepository, catalog: CatalogSnapshot, context: LocalContext) {
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const remoteRevision = useRemoteRevision(repository);
  const { profileId, eventId } = context;

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const scope = {
          profileId,
          eventId,
        };
        const [
          products, visit, photos,
        ] = await Promise.all([
          repository.listProducts(scope), repository.getVisitData(scope), repository.listPhotos(scope),
        ]);
        const resolved = resolveProductList(catalog, scope, products, visit.personalStands, photos);
        const withThumbnails = await Promise.all(resolved.map(async (item) => {
          const asset = item.primaryPhotoId === undefined ? undefined
            : await repository.getPhotoAsset(scope, item.primaryPhotoId);

          return {
            ...item,
            thumbnail: asset?.thumbnail,
          };
        }));

        if (!disposed) {
          setItems(withThumbnails);
          setStatus("ready");
        }
      } catch {
        if (!disposed) {
          setStatus("error");
        }
      }
    }

    void load();

    return () => {
      disposed = true;
    };
  }, [
    repository, catalog, profileId, eventId, attempt, remoteRevision,
  ]);

  return {
    items,
    status,
    retry: () => {
      setStatus("loading");
      setAttempt((value) => value + 1);
    },
  };
}

export function useProductFilters(context: LocalContext, ready: boolean) {
  const params = useSearchParams();
  const query = params.toString();
  const filters = readProductFilters(new URLSearchParams(query), context);
  const scope = JSON.stringify([context.profileId, context.eventId]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const main = document.getElementById("main-content");
    const storageKey = `expotrack:product-scroll:${scope}:${query}`;
    let top = 0;

    try {
      top = Number(sessionStorage.getItem(storageKey) ?? 0);
    } catch { /* Scroll is optional. */ }
    const frame = requestAnimationFrame(() => {
      if (main !== null) {
        main.scrollTop = top;
      }
    });

    function remember() {
      if (window.location.pathname === "/products" && main !== null) {
        try {
          sessionStorage.setItem(storageKey, String(main.scrollTop));
        } catch { /* Keep the URL filters. */ }
      }
    }

    main?.addEventListener("scroll", remember, {
      passive: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      main?.removeEventListener("scroll", remember);
    };
  }, [
    ready, scope, query,
  ]);

  function change(changes: Partial<ProductFilters>) {
    const current = readProductFilters(new URLSearchParams(window.location.search), context);
    const next = productFiltersQuery({
      ...current,
      ...changes,
    }, context);

    try {
      sessionStorage.removeItem(`expotrack:product-scroll:${scope}:${next}`);
    } catch { /* Keep filtering usable. */ }
    window.history.replaceState(null, "", `/products?${next}`);
    document.getElementById("main-content")?.scrollTo({
      top: 0,
    });
  }

  return {
    filters,
    change,
    returnHref: `/products${query === "" ? "" : `?${query}`}`,
  };
}
