"use client";

import {
  createContext, useContext, useEffect, useState,
} from "react";

import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { Card } from "@/components/ui/Card";

import type { ReactNode } from "react";

const PwaContext = createContext({
  status: "Preparazione della shell offline…",
  updating: false,
});

export function PwaProvider({ children }: {
  children: ReactNode;
}) {
  const [status, setStatus] = useState("Preparazione della shell offline…");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      queueMicrotask(() => {
        setStatus("La shell offline è disponibile nella versione di produzione.");
      });

      return;
    }
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      queueMicrotask(() => {
        setStatus("Per preparare l’app senza rete serve HTTPS su questo dispositivo.");
      });

      return;
    }
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let worker: ServiceWorker | null = null;

    function inspect() {
      if (disposed || registration === undefined) {
        return;
      }
      setUpdating(registration.waiting !== null && registration.active !== null);
      if (registration.active !== null) {
        setStatus("Shell disponibile sul dispositivo.");
      }
    }

    function watch() {
      worker = registration?.installing ?? null;
      worker?.addEventListener("statechange", changed);
      inspect();
    }

    function changed() {
      inspect();
      if (worker?.state === "redundant" && registration?.active === null) {
        setStatus("Preparazione offline non riuscita. Mantieni la rete e riapri l’app per riprovare.");
      }
    }

    navigator.serviceWorker.addEventListener("controllerchange", inspect);
    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).then((result) => {
      if (disposed) {
        return;
      }
      registration = result;
      registration.addEventListener("updatefound", watch);
      watch();
      void registration.update().catch(() => undefined);
    }).catch(() => {
      if (!disposed) {
        setStatus("Preparazione offline non riuscita. Mantieni la rete e riapri l’app per riprovare.");
      }
    });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", inspect);
      registration?.removeEventListener("updatefound", watch);
      worker?.removeEventListener("statechange", changed);
    };
  }, []);

  return (
    <PwaContext.Provider
      value={{
        status,
        updating,
      }}
    >{children}
    </PwaContext.Provider>
  );
}

export function OfflineStatus() {
  const { state } = useProfileSession();
  const { status, updating } = useContext(PwaContext);

  return (
    <Card>
      <h2>Uso senza rete</h2>
      <p role="status">{status}</p>
      <p>{state.status === "ready" ? "Catalogo disponibile sul dispositivo. I dati e le foto salvati qui restano consultabili senza rete." : "Al primo accesso prepara il catalogo con la connessione attiva."}</p>
      {updating && (
        <p>
          Nuova versione pronta. Attendi il salvataggio delle modifiche, poi chiudi tutte le schede di ExpoTrack
          e riapri l’app per applicarla.
        </p>
      )}
    </Card>
  );
}
