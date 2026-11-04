"use client";

import { useEffect } from "react";

import { useSearchParams } from "@/lib/navigation";

import { readStandFilters, standFiltersQuery } from "./stand-list";

import type { StandFilters } from "./stand-list";
import type { LocalContext } from "../../types/offline";

function historyData(): Record<string, unknown> {
  const state: unknown = window.history.state;

  return typeof state === "object" && state !== null ? state as Record<string, unknown> : {};
}

const scrollStoragePrefix = "expotrack:stand-scroll:";

export function resetStandListScroll() {
  try {
    sessionStorage.removeItem(scrollStoragePrefix);
  } catch {
    // History remains available when session storage is denied.
  }
}

export function useStandFilters(context: LocalContext, ready: boolean) {
  const params = useSearchParams();
  const filters = readStandFilters(new URLSearchParams(params.toString()), context);
  const scope = JSON.stringify([context.profileId, context.eventId]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const main = document.getElementById("main-content");

    if (main === null) {
      return;
    }
    let stored = historyData();
    const storageKey = `${scrollStoragePrefix}${window.location.search}`;

    try {
      const remembered: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");

      if (typeof remembered === "object" && remembered !== null) {
        stored = {
          ...stored,
          ...remembered,
        };
      }
    } catch {
      // Fall back to the history entry without blocking the list.
    }
    const top = stored.standsScope === scope && typeof stored.standsScroll === "number" ? stored.standsScroll : 0;
    let restoring = true;
    const frame = requestAnimationFrame(() => {
      main.scrollTop = top;
      restoring = false;
    });

    function rememberScroll() {
      if (window.location.pathname !== "/stands" || restoring) {
        return;
      }
      const scroll = {
        standsScope: scope,
        standsScroll: main?.scrollTop ?? 0,
      };

      window.history.replaceState({
        ...historyData(),
        ...scroll,
      }, "");
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(scroll));
      } catch {
        // A scroll preference must not prevent navigation or saving personal data.
      }
    }

    main.addEventListener("scroll", rememberScroll, {
      passive: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      main.removeEventListener("scroll", rememberScroll);
    };
  }, [ready, scope]);

  function changeFilters(changes: Partial<StandFilters>) {
    // Native history changes immediately; React's URL subscription may still be rendering the previous edit.
    const current = readStandFilters(new URLSearchParams(window.location.search), context);
    const next = {
      ...current,
      ...changes,
    };

    try {
      sessionStorage.removeItem(`${scrollStoragePrefix}?${standFiltersQuery(next, context)}`);
    } catch {
      // The explicit filter change still resets the current scroll.
    }
    window.history.replaceState({
      standsScope: scope,
      standsScroll: 0,
    }, "", `/stands?${standFiltersQuery(next, context)}`);
    document.getElementById("main-content")?.scrollTo({
      top: 0,
    });
  }

  return {
    filters,
    changeFilters,
  };
}
