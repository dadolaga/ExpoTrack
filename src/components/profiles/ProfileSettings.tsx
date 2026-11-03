"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SelectField } from "@/components/forms/SelectField";
import { ThemeSelector } from "@/components/forms/ThemeSelector";
import { Card } from "@/components/ui/Card";

import { useProfileSession } from "./ProfileProvider";

export function ProfileSettings() {
  const router = useRouter();
  const {
    state, selecting, selectionError, chooseEvent,
  } = useProfileSession();

  if (state.status !== "ready") {
    return null;
  }

  return (
    <>
      <Card>
        <h2>Gestione profili</h2>
        <Link
          href="/profiles?manage=1"
          className="profile-action-link"
        >Tutti i profili <span aria-hidden="true">›</span>
        </Link>
        <Link
          href="/profiles?edit=new"
          className="profile-action-link"
        >Aggiungi profilo <span aria-hidden="true">＋</span>
        </Link>
        <Link
          href="/profile/budgets"
          className="profile-action-link"
        >Budget per categoria <span aria-hidden="true">›</span>
        </Link>
      </Card>
      <Card>
        <h2>Impostazioni</h2>
        <SelectField
          label="Evento attivo"
          value={state.session.event?.id ?? ""}
          disabled={selecting}
          onChange={(event) => {
            const id = event.target.value;

            void chooseEvent(id).then((changed) => {
              if (changed) {
                router.replace("/");
              }
            });
          }}
        >
          {state.session.catalog.config.events.filter((event) => event.enabled).map((event) => (
            <option
              key={event.id}
              value={event.id}
            >{event.name}
            </option>
          ))}
        </SelectField>
        {selectionError !== null && <p role="alert">{selectionError}</p>}
        <ThemeSelector />
      </Card>
      <Card>
        <h2>Informazioni app</h2>
        <p>ExpoTrack · versione 0.1.0</p>
        <p className="text-label text-text-muted">Raccolta personale durante la visita in fiera.</p>
        <p className="text-caption text-text-muted">I dati sono salvati su questo dispositivo. La sincronizzazione con il server sarà disponibile in uno step successivo.</p>
      </Card>
    </>
  );
}
