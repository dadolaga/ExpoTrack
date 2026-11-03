"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { SaveStatus } from "@/components/feedback/SaveStatus";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLocalAutosave } from "@/features/use-local-autosave";
import { createLocalId } from "@/lib/offline/identity";

import { useProfileSession } from "./ProfileProvider";

import type { LocalRepository } from "@/lib/offline/repository";
import type { ProfileSummary } from "@/types/profiles";

export function PersonalProfileEditor({ repository, profile }: {
  repository: LocalRepository;
  profile?: ProfileSummary;
}) {
  const router = useRouter();
  const { refreshSession } = useProfileSession();
  const [id] = useState(() => profile?.id ?? `usr-${createLocalId()}`);
  const [confirmation, setConfirmation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const write = useCallback(async (input: {
    name: string;
    color: string;
  }) => {
    await repository.savePersonalProfile(id, input);
    await refreshSession();
  }, [
    repository, id, refreshSession,
  ]);
  const autosave = useLocalAutosave({
    name: profile?.name ?? "",
    color: profile?.color ?? "#0866E8",
  }, write, "/profiles?manage=1");

  async function remove() {
    if (confirmation === 1) {
      setConfirmation(2);

      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!await autosave.retry()) {
        throw new Error("Correggi il nome o riprova il salvataggio prima di eliminare il profilo.");
      }
      await repository.deletePersonalProfile(id);
      await refreshSession();
      router.replace("/profiles?manage=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Eliminazione non riuscita: riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h1>{profile === undefined ? "Aggiungi profilo" : "Modifica profilo"}</h1>
      <fieldset disabled={busy}>
        <TextField
          label="Nome profilo"
          required
          value={autosave.value.name}
          error={autosave.value.name.trim() === "" && autosave.status !== "idle" ? "Inserisci un nome." : undefined}
          onChange={(event) => {
            autosave.change({
              ...autosave.value,
              name: event.target.value,
            });
          }}
        />
        <label className="profile-color-field">
          Colore
          <input
            type="color"
            value={autosave.value.color}
            onChange={(event) => {
              autosave.change({
                ...autosave.value,
                color: event.target.value,
              });
            }}
          />
        </label>
      </fieldset>
      <SaveStatus
        status={autosave.status}
        onRetry={() => {
          void autosave.retry();
        }}
      />
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => {
          void (async () => {
            if (await autosave.retry()) {
              await refreshSession();
              router.replace("/profiles?manage=1");
            }
          })();
        }}
      >Torna ai profili
      </Button>
      {profile !== undefined && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setConfirmation(1);
          }}
        >Elimina profilo
        </Button>
      )}
      <ConfirmDialog
        open={confirmation > 0}
        title={confirmation === 1 ? `Eliminare ${autosave.value.name}?` : `Conferma definitiva: ${autosave.value.name}`}
        description={confirmation === 1
          ? "Il profilo e i suoi dati di visita per tutti gli eventi non saranno più accessibili dall’app. Questa è la prima di due conferme."
          : "Confermi l’eliminazione? I dati collegati e i file necessari alle operazioni pendenti saranno conservati fino alla risoluzione delle dipendenze di sincronizzazione."}
        confirmLabel={confirmation === 1 ? "Continua" : "Elimina definitivamente"}
        busy={busy}
        error={error}
        onConfirm={() => {
          void remove();
        }}
        onCancel={() => {
          setConfirmation(0);
          setError(null);
        }}
      />
    </Card>
  );
}
