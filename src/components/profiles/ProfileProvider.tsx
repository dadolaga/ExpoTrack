"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";

import { initializeServerCatalog } from "@/lib/offline/catalog-bootstrap";
import { openLocalRepository } from "@/lib/offline/repository";

import type { LocalRepository } from "@/lib/offline/repository";
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
  chooseEvent: (id: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
  retry: () => void;
  registerBeforeLeave: (
    handler: () => Promise<boolean>,
    onPopstate: (event: PopStateEvent) => void,
  ) => () => void;
  leave: (action: () => void) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: {
  children: ReactNode;
}) {
  const [state, setState] = useState<ProfileState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const repositoryRef = useRef<LocalRepository | null>(null);
  const selectingRef = useRef(false);
  const contextVersion = useRef(0);
  const guards = useRef(new Map<() => Promise<boolean>, (event: PopStateEvent) => void>());
  const leaving = useRef(false);
  const registerBeforeLeave = useCallback((
    handler: () => Promise<boolean>,
    onPopstate: (event: PopStateEvent) => void,
  ) => {
    guards.current.set(handler, onPopstate);

    return () => {
      guards.current.delete(handler);
    };
  }, []);

  // Install before the parent App Router's effect. A late page listener can be
  // removed by the router's synchronous traversal before it receives popstate.
  useEffect(() => {
    function popstate(event: PopStateEvent) {
      for (const guard of guards.current.values()) {
        guard(event);
        if (event.cancelBubble) {
          break;
        }
      }
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
      if ((await Promise.all([...guards.current.keys()].map((guard) => guard()))).every(Boolean)) {
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
        repository = await openLocalRepository();

        if (!isActive()) {
          repository.close();

          return;
        }
        const session = await initializeServerCatalog(repository);

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
            message: "Questo dispositivo non dispone di un catalogo utilizzabile. Al primo accesso serve la connessione al server: torna online, consenti l’archiviazione nel browser e riprova.",
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
  }, [attempt]);

  async function chooseContext(id: string, event = false): Promise<boolean> {
    const repository = repositoryRef.current;

    if (repository === null || selectingRef.current) {
      return false;
    }
    selectingRef.current = true;
    contextVersion.current += 1;
    setSelecting(true);
    setSelectionError(null);

    try {
      if (!(await Promise.all([...guards.current.keys()].map((guard) => guard()))).every(Boolean)) {
        return false;
      }
      const session = await (event ? repository.selectEvent(id) : repository.selectProfile(id));

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
        setSelectionError("Impossibile ricordare la scelta sul dispositivo. La scelta precedente resta attiva: riprova.");
      }

      return false;
    } finally {
      if (repositoryRef.current === repository) {
        selectingRef.current = false;
        setSelecting(false);
      }
    }
  }

  const refreshSession = useCallback(async () => {
    const repository = repositoryRef.current;

    if (repository === null) {
      return;
    }
    const version = contextVersion.current;
    const session = await repository.getProfileSession();

    if (session !== null && repositoryRef.current === repository
      && !selectingRef.current && version === contextVersion.current) {
      setState({
        status: "ready",
        session,
        repository,
      });
    }
  }, []);

  function retry() {
    setState({
      status: "loading",
    });
    setAttempt((current) => current + 1);
  }

  return (
    <ProfileContext.Provider
      value={{
        state,
        selecting,
        selectionError,
        chooseProfile: (id) => chooseContext(id),
        chooseEvent: (id) => chooseContext(id, true),
        refreshSession,
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
