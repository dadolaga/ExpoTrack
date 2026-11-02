"use client";

import { useRouter } from "next/navigation";
import {
  useCallback, useEffect, useRef, useState,
} from "react";

import { useProfileSession } from "@/components/profiles/ProfileProvider";

import type { SaveState } from "@/components/feedback/SaveStatus";
import type { LocalRepository } from "@/lib/offline/repository";
import type { LocalContext } from "@/types/offline";

// Navigation API types are not yet included in this project's DOM declarations.
type HistoryNavigation = EventTarget & {
  traverseTo: (key: string) => unknown;
};
type HistoryNavigateEvent = Event & {
  navigationType: string;
  canIntercept: boolean;
  destination: {
    key: string;
  };
};

export function useStandNotes(
  repository: LocalRepository,
  context: LocalContext,
  standId: string,
  initialValue: string,
) {
  const router = useRouter();
  const { registerBeforeLeave, leave } = useProfileSession();
  const [text, setText] = useState(initialValue);
  const [status, setStatus] = useState<SaveState>("idle");
  const latest = useRef(initialValue);
  const committed = useRef(initialValue);
  const pending = useRef<Promise<boolean> | null>(null);
  const active = useRef(true);
  const { profileId, eventId } = context;
  const flush = useCallback((): Promise<boolean> => {
    if (pending.current !== null) {
      return pending.current;
    }
    if (latest.current === committed.current) {
      return Promise.resolve(true);
    }

    async function save() {
      setStatus("saving");
      try {
        // Input remains editable. After each commit, persist the most recent text.
        while (latest.current !== committed.current) {
          const notes = latest.current;

          await repository.saveStandPreferences({
            profileId,
            eventId,
          }, standId, {
            notes,
          });
          committed.current = notes;
        }
        if (active.current) {
          setStatus("saved");
        }

        return true;
      } catch {
        if (active.current) {
          setStatus("error");
        }

        return false;
      } finally {
        pending.current = null;
      }
    }

    pending.current = save();

    return pending.current;
  }, [
    repository, profileId, eventId, standId,
  ]);

  useEffect(() => {
    active.current = true;
    const navigation = (window as Window & {
      navigation?: HistoryNavigation;
    }).navigation;
    const sourceUrl = window.location.href;
    const sourceState: unknown = window.history.state;

    function isDirty() {
      return pending.current !== null || latest.current !== committed.current;
    }

    function beforeUnload(event: BeforeUnloadEvent) {
      if (isDirty()) {
        event.preventDefault();
      }
    }

    function navigate(event: Event) {
      const traversal = event as HistoryNavigateEvent;

      if (traversal.navigationType === "traverse" && traversal.canIntercept
        && traversal.cancelable && isDirty()) {
        traversal.preventDefault();
        void leave(() => {
          navigation?.traverseTo(traversal.destination.key);
        });
      }
    }

    function popstate(event: PopStateEvent) {
      if (!isDirty()) {
        return;
      }
      // Older browsers: keep the editor mounted while the write finishes.
      const destination = window.location.href;

      event.stopImmediatePropagation();
      window.history.replaceState({
        ...(typeof sourceState === "object" && sourceState !== null ? sourceState : {}),
        notesBackFallback: true,
      }, "", sourceUrl);
      void leave(() => {
        router.replace(destination);
      });
    }

    window.addEventListener("beforeunload", beforeUnload);
    navigation?.addEventListener("navigate", navigate);
    const unregister = registerBeforeLeave(flush, popstate);

    return () => {
      active.current = false;
      unregister();
      window.removeEventListener("beforeunload", beforeUnload);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, [
    flush, registerBeforeLeave, leave, router,
  ]);

  function change(value: string) {
    latest.current = value;
    setText(value);
    if (value === committed.current && pending.current === null) {
      setStatus("idle");
    }
    void flush();
  }

  function back() {
    void leave(() => {
      const historyState = window.history.state as {
        notesBackFallback?: boolean;
      } | null;

      if (new URLSearchParams(window.location.search).get("from") === "detail"
        && window.history.length > 1 && historyState?.notesBackFallback !== true) {
        router.back();
      } else {
        router.replace(`/stands/${encodeURIComponent(standId)}`);
      }
    });
  }

  return {
    text,
    status,
    change,
    retry: flush,
    back,
  };
}
