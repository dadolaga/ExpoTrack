"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { recoverAsNew } from "@/lib/sync/recovery";

import { useSyncEngine } from "./SyncProvider";
import { syncLabel, useSyncStatus } from "./SyncStatus";

import type { OutboxOperation } from "@/types/offline";

const entityLabels: Record<OutboxOperation["entityType"], string> = {
  profile: "Profilo",
  budget: "Budget",
  product: "Prodotto",
  "personal-stand": "Stand personale",
  "stand-preferences": "Preferenze e note stand",
  photo: "Foto",
};

function operationLabel(operation: OutboxOperation) {
  const data = operation.payload;
  let name = "";

  if ("name" in data) {
    name = data.name;
  } else if ("filename" in data) {
    name = data.filename;
  }

  return `${entityLabels[operation.entityType]}${name === "" ? "" : ` · ${name}`}`;
}

export function SyncPage() {
  const router = useRouter();
  const {
    state, chooseProfile, chooseEvent, refreshSession,
  } = useProfileSession();
  const engine = useSyncEngine();
  const status = useSyncStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== "ready") {
    return null;
  }
  const { repository, session } = state;
  const { summary } = status;
  const active = (operation: OutboxOperation) => operation.profileId === session.profile?.id
    && (operation.eventId === undefined || operation.eventId === session.event?.id);
  const pending = summary.pending.filter(active);
  const recoveries = summary.recoveries.filter((entry) => active(entry.operation));
  const total = summary.pending.length + summary.recoveries.length;
  const photos = summary.pending.filter((entry) => entry.entityType === "photo").length
    + summary.recoveries.filter((entry) => entry.operation.entityType === "photo").length;
  const others = total - pending.length - recoveries.length;
  let networkLabel = "Verifica connessione";

  if (status.phase === "offline") {
    networkLabel = "Offline";
  } else if (status.reachable === true) {
    networkLabel = "Server raggiunto";
  }
  const unavailable = [...new Set(summary.recoveries.map((entry) => entry.operation.profileId))]
    .filter((id) => !session.catalog.profiles.some((profile) => profile.id === id && profile.enabled));

  function recoveryLabel(id: string, action: string) {
    if (busy === id) {
      return "Recupero…";
    }

    return action === "delete" ? "Riprova eliminazione" : "Recupera come nuovo elemento";
  }

  async function recoverRemovedProfile(profileId: string) {
    setBusy(profileId);
    setError(null);
    try {
      for (const entry of summary.recoveries.filter((item) => item.operation.profileId === profileId)) {
        if ((await repository.sync.recovery(entry.operationId))?.resolved === true) {
          continue;
        }
        if (entry.operation.action === "delete") {
          await repository.sync.resolveRecovery(entry.operation);
        } else {
          await recoverAsNew(repository, entry.operationId);
        }
      }
      await refreshSession();
      void engine?.run();
      router.push("/profiles");
    } catch {
      setError("Recupero non completato. Le copie già create e gli originali sono conservati: riprova.");
    } finally {
      setBusy(null);
    }
  }

  async function recover(id: string, deletion: boolean) {
    setBusy(id);
    setError(null);
    try {
      if (deletion) {
        await repository.sync.retryOperation(id);
      } else {
        const result = await recoverAsNew(repository, id);

        await refreshSession();
        if (await chooseProfile(result.profileId)) {
          if (result.eventId !== undefined) {
            await chooseEvent(result.eventId);
          }
          router.push(result.href);
        }
      }
      void engine?.run();
    } catch {
      setError("Recupero non completato. Dati e allegati restano conservati: riprova.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-section">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2>{syncLabel(status)}</h2>
          <span className="sync-network">{networkLabel}</span>
        </div>
        <p className="text-label text-text-muted">Le modifiche vengono salvate prima sul dispositivo. L’invio riprende automaticamente con l’app aperta, su Wi-Fi e rete mobile.</p>
        {status.message !== null && <p role="status">{status.message}</p>}
        {status.progress !== null && <p role="status">{status.progress}</p>}
      </Card>
      <div className="sync-counters">
        <Card><strong className="sync-stat">{total}</strong><span>Operazioni da confermare</span></Card>
        <Card><strong className="sync-stat">{photos}</strong><span>Di cui foto</span></Card>
      </div>
      <p className="text-caption text-text-muted">Totali di tutti i profili ed eventi su questo dispositivo. Ogni operazione è contata una sola volta; le foto sono già incluse nel totale.</p>
      <Button
        disabled={status.phase === "syncing" || engine === null}
        onClick={() => {
          void engine?.run();
        }}
      >{status.phase === "syncing" ? "Sincronizzazione in corso…" : "Sincronizza ora"}
      </Button>
      <Card>
        <h2>Ultima sincronizzazione</h2>
        <p>{summary.lastSyncedAt === null ? "Nessuna sincronizzazione completata" : new Intl.DateTimeFormat("it-IT", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(summary.lastSyncedAt))}
        </p>
        {summary.localPhotos > 0 && (
          <p>{summary.localPhotos} foto locali: completa nome, categoria e stand dei prodotti per inviarle.</p>
        )}
        {summary.missingPhotos > 0 && (
          <p>{summary.missingPhotos} foto non disponibili sul dispositivo.
            Serve il download prima di poterle aprire senza rete.
          </p>
        )}
      </Card>
      <section aria-labelledby="pending-title">
        <h2 id="pending-title">Operazioni del contesto attivo</h2>
        {pending.length === 0 && recoveries.length === 0 && (
          <p>Nessuna operazione in attesa per questo profilo ed evento.</p>
        )}
        <ul className="flex flex-col gap-3">
          {pending.map((operation) => (
            <li key={operation.operationId}>
              <Card><h3>{operationLabel(operation)}</h3><p>{operation.action === "delete" ? "Eliminazione in attesa" : "In attesa di conferma server"}</p></Card>
            </li>
          ))}
          {recoveries.map((entry) => (
            <li key={entry.operationId}>
              <Card>
                <h3>{operationLabel(entry.operation)}</h3>
                <p className="text-danger">Modifica non accettata. Il record originale potrebbe essere stato eliminato o modificato in modo incompatibile.</p>
                <p className="text-label">Dati e allegati conservati sul dispositivo.</p>
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    void recover(entry.operationId, entry.operation.action === "delete");
                  }}
                >{recoveryLabel(entry.operationId, entry.operation.action)}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
        {error !== null && <p role="alert">{error}</p>}
      </section>
      {others > 0 && <Card><p>{others} operazioni riguardano altri profili o eventi.</p><Link href="/profiles">Cambia profilo</Link><Link href="/profile">Cambia evento</Link></Card>}
      {unavailable.map((profileId) => (
        <Card key={profileId}>
          <h2>Dati di un profilo non più disponibile</h2>
          <p>Puoi conservarli in un nuovo profilo personale, senza riattivare quello eliminato.</p>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => {
              void recoverRemovedProfile(profileId);
            }}
          >Recupera i dati in un nuovo profilo
          </Button>
        </Card>
      ))}
      <Link href="/profile">Torna al profilo</Link>
    </div>
  );
}
