"use client";

import { useRouter } from "next/navigation";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";

import { openLocalRepository } from "@/lib/offline/repository";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { ProfileSession } from "@/types/profiles";
import type { ReactNode } from "react";

type ProfileState
  = | {
    status: "loading";
  }
  | {
    status: "error";
    message: string;
  }
  | {
    status: "ready";
    session: ProfileSession;
    repository: LocalRepository;
  };

type ProfileContextValue = {
  state: ProfileState;
  selecting: boolean;
  selectionError: string | null;
  chooseProfile: (id: string) => Promise<boolean>;
  retry: () => void;
  registerBeforeLeave: (
    handler: () => Promise<boolean>,
    onPopstate: (event: PopStateEvent) => void,
  ) => () => void;
  leave: (action: () => void) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ catalog, children }: {
  catalog: CatalogSnapshot | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<ProfileState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const repositoryRef = useRef<LocalRepository | null>(null);
  const selectingRef = useRef(false);
  const beforeLeave = useRef<(() => Promise<boolean>) | null>(null);
  const popstateGuard = useRef<((event: PopStateEvent) => void) | null>(null);
  const leaving = useRef(false);
  const registerBeforeLeave = useCallback((
    handler: () => Promise<boolean>,
    onPopstate: (event: PopStateEvent) => void,
  ) => {
    beforeLeave.current = handler;
    popstateGuard.current = onPopstate;

    return () => {
      if (beforeLeave.current === handler) {
        beforeLeave.current = null;
        popstateGuard.current = null;
      }
    };
  }, []);

  // Install before the parent App Router's effect. A late page listener can be
  // removed by the router's synchronous traversal before it receives popstate.
  useEffect(() => {
    function popstate(event: PopStateEvent) {
      popstateGuard.current?.(event);
    }

    window.addEventListener("popstate", popstate, true);

    return () => {
      window.removeEventListener("popstate", popstate, true);
    };
  }, []);
  const leave = useCallback(async (action: () => void) => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    try {
      if (beforeLeave.current === null || await beforeLeave.current()) {
        action();
      }
    } finally {
      leaving.current = false;
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let repository: LocalRepository | null = null;

    function isActive() {
      return !disposed;
    }

    async function initialize() {
      try {
        if (catalog === null) {
          throw new Error("Catalogo non disponibile.");
        }
        repository = await openLocalRepository();

        if (!isActive()) {
          repository.close();

          return;
        }
        const session = await repository.initializeProfileSession(catalog);

        if (isActive()) {
          repositoryRef.current = repository;
          selectingRef.current = false;
          setSelecting(false);
          setSelectionError(null);
          setState({
            status: "ready",
            session,
            repository,
          });
        }
      } catch {
        repository?.close();

        if (isActive()) {
          setState({
            status: "error",
            message: catalog === null
              ? "Il catalogo dei profili non è disponibile. Riprova tra poco."
              : "Non è stato possibile preparare i profili sul dispositivo. Consenti l’archiviazione nel browser e riprova.",
          });
        }
      }
    }

    void initialize();

    return () => {
      disposed = true;
      repository?.close();

      if (repositoryRef.current === repository) {
        repositoryRef.current = null;
      }
    };
  }, [catalog, attempt]);

  async function chooseProfile(id: string): Promise<boolean> {
    const repository = repositoryRef.current;

    if (repository === null || selectingRef.current) {
      return false;
    }
    if (beforeLeave.current !== null && !await beforeLeave.current()) {
      return false;
    }
    selectingRef.current = true;
    setSelecting(true);
    setSelectionError(null);

    try {
      const session = await repository.selectProfile(id);

      if (repositoryRef.current !== repository) {
        return false;
      }
      setState({
        status: "ready",
        session,
        repository,
      });

      return true;
    } catch {
      if (repositoryRef.current === repository) {
        setSelectionError("Impossibile ricordare il profilo sul dispositivo. La scelta precedente resta attiva: riprova.");
      }

      return false;
    } finally {
      if (repositoryRef.current === repository) {
        selectingRef.current = false;
        setSelecting(false);
      }
    }
  }

  function retry() {
    setState({
      status: "loading",
    });
    setAttempt((current) => current + 1);

    if (catalog === null) {
      router.refresh();
    }
  }

  return (
    <ProfileContext.Provider
      value={{
        state,
        selecting,
        selectionError,
        chooseProfile,
        retry,
        registerBeforeLeave,
        leave,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileSession() {
  const value = useContext(ProfileContext);

  if (value === null) {
    throw new Error("Il componente richiede ProfileProvider.");
  }

  return value;
}
