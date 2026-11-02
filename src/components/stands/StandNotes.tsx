"use client";

import Link from "next/link";

import { SaveStatus } from "@/components/feedback/SaveStatus";
import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { Button } from "@/components/ui/Button";
import { useStandDetail } from "@/features/stands/use-stand-detail";
import { useStandNotes } from "@/features/stands/use-stand-notes";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot, StandReference } from "@/types/catalog";
import type { LocalContext } from "@/types/offline";

type NotesContext = {
  repository: LocalRepository;
  context: LocalContext;
  standId: string;
  source: StandReference["source"];
};

function NotesEditor({ name, initialValue, ...scope }: NotesContext & {
  name: string;
  initialValue: string;
}) {
  const notes = useStandNotes(scope.repository, scope.context, scope.standId, initialValue, scope.source);

  return (
    <section className="stand-detail">
      <div><h1>Note stand</h1><p className="text-text-muted">{name}</p></div>
      <label
        htmlFor="stand-notes"
        className="text-label font-medium"
      >Note personali sullo stand
      </label>
      <textarea
        id="stand-notes"
        rows={12}
        value={notes.text}
        aria-describedby="stand-notes-hint"
        className="w-full min-w-0 resize-y rounded-input border border-text-muted bg-surface p-page text-body text-text"
        onChange={(event) => {
          notes.change(event.target.value);
        }}
      />
      <p
        id="stand-notes-hint"
        className="text-caption text-text-muted"
      >Appunti facoltativi, personali per questo profilo ed evento.
      </p>
      <SaveStatus
        status={notes.status}
        onRetry={() => {
          void notes.retry();
        }}
      />
      <Button
        variant="secondary"
        onClick={notes.back}
      >Torna al dettaglio stand
      </Button>
    </section>
  );
}

function ContextStandNotes({ catalog, ...scope }: NotesContext & {
  catalog: CatalogSnapshot;
}) {
  const state = useStandDetail(scope.repository, catalog, scope.context, scope.standId, scope.source);

  if (state.loadError) {
    return <div role="alert"><p>Impossibile leggere le note sul dispositivo.</p><Button onClick={state.retryLoad}>Riprova</Button></div>;
  }
  if (state.loading) {
    return <p role="status">Caricamento delle note…</p>;
  }
  if (state.detail === null) {
    return <div><h1>Stand non disponibile</h1><p>Questo stand non è nel catalogo dell’evento attivo.</p><Link href="/stands">Vai agli stand</Link></div>;
  }

  return (
    <NotesEditor
      {...scope}
      name={state.detail.name}
      initialValue={state.detail.notes}
    />
  );
}

export function StandNotes({ standId, source = "catalog" }: {
  standId: string;
  source?: StandReference["source"];
}) {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.context === null) {
    return null;
  }

  return (
    <ContextStandNotes
      key={JSON.stringify([
        state.session.context, source, standId,
      ])}
      repository={state.repository}
      catalog={state.session.catalog}
      context={state.session.context}
      standId={standId}
      source={source}
    />
  );
}
