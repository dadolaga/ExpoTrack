"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { readStandFilters, standFiltersQuery } from "./stand-list";

import type { StandFilters } from "./stand-list";
import type { LocalContext } from "../../types/offline";

function historyData(): Record<string, unknown> {
  const state: unknown = window.history.state;

  return typeof state === "object" && state !== null ? state as Record<string, unknown> : {};
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
    const stored = historyData();
    const top = stored.standsScope === scope && typeof stored.standsScroll === "number" ? stored.standsScroll : 0;
    const frame = requestAnimationFrame(() => {
      main.scrollTop = top;
    });

    function rememberScroll() {
      window.history.replaceState({
        ...historyData(),
        standsScope: scope,
        standsScroll: main?.scrollTop ?? 0,
      }, "");
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
