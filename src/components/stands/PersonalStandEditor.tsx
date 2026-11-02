"use client";

import Link from "next/link";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { SaveStatus } from "@/components/feedback/SaveStatus";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { Button } from "@/components/ui/Button";
import { usePersonalStand, usePersonalStandEditor } from "@/features/stands/use-personal-stand";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { LocalContext, LocalPersonalStand, PersonalStandInput } from "@/types/offline";

type EditorContext = {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  context: LocalContext;
};

function Editor({
  repository, catalog, context, id, record,
}: EditorContext & {
  id: string;
  record: LocalPersonalStand | undefined;
}) {
  const {
    autosave, hasStand, confirm, deleting, deleteError, openConfirm, cancel, remove,
  } = usePersonalStandEditor(repository, context, id, record);
  const { profileId, eventId } = context;
  const input = autosave.value;
  const invalidName = input.name.trim().length === 0;

  function change(patch: Partial<PersonalStandInput>) {
    autosave.change({
      ...input,
      ...patch,
    });
  }

  return (
    <section
      className="stand-detail"
      aria-labelledby="personal-stand-title"
    >
      <h1 id="personal-stand-title">{record === undefined ? "Nuovo stand personale" : "Modifica stand personale"}</h1>
      <p className="text-label text-text-muted">{catalog.profiles.find((profile) => profile.id === profileId)?.name} · {catalog.config.events.find((event) => event.id === eventId)?.name}</p>
      <TextField
        label="Nome stand"
        required
        value={input.name}
        disabled={deleting}
        error={invalidName && autosave.status !== "idle" ? "Inserisci il nome dello stand." : undefined}
        onChange={(event) => {
          change({
            name: event.target.value,
          });
        }}
      />
      <label className="flex flex-col gap-2 text-label font-medium">
        Descrizione (facoltativa)
        <textarea
          rows={4}
          value={input.description}
          disabled={deleting}
          className="w-full min-w-0 resize-y rounded-input border border-text-muted bg-surface p-3 text-body text-text"
          onChange={(event) => {
            change({
              description: event.target.value,
            });
          }}
        />
      </label>
      <fieldset
        className="stand-detail-card"
        disabled={deleting}
      >
        <legend>Categorie (facoltative)</legend>
        {catalog.categories.map((category) => (
          <label
            className="personal-category"
            key={category.id}
          >
            <input
              type="checkbox"
              checked={input.categoryIds.includes(category.id)}
              onChange={(event) => {
                change({
                  categoryIds: event.target.checked ? [...input.categoryIds, category.id]
                    : input.categoryIds.filter((entry) => entry !== category.id),
                });
              }}
            />
            {category.name}
          </label>
        ))}
      </fieldset>
      <SelectField
        label="Padiglione (facoltativo)"
        value={input.hall ?? ""}
        disabled={deleting}
        onChange={(event) => {
          change({
            hall: event.target.value === "" ? null : event.target.value,
          });
        }}
      >
        <option value="">Non indicato</option>
        {catalog.pavilions.filter((pavilion) => pavilion.eventId === eventId).map((pavilion) => (
          <option
            key={pavilion.id}
            value={pavilion.id}
          >{pavilion.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Posizione / numero stand (facoltativo)"
        value={input.booth}
        disabled={deleting}
        onChange={(event) => {
          change({
            booth: event.target.value,
          });
        }}
      />
      <SaveStatus
        status={autosave.status}
        onRetry={() => {
          void autosave.retry();
        }}
      />
      {invalidName && <p className="text-label text-text-muted">Il nome è necessario per includere lo stand nella lista.</p>}
      <Button
        variant="secondary"
        disabled={deleting || invalidName}
        onClick={autosave.back}
      >Torna al dettaglio stand
      </Button>
      {hasStand && (
        <Button
          variant="secondary"
          disabled={deleting}
          onClick={openConfirm}
        >Elimina stand
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        title="Eliminare lo stand personale?"
        description="Verranno eliminate anche le note, la checklist e le preferenze dello stand. L’eliminazione è bloccata se ci sono prodotti collegati."
        busy={deleting}
        error={deleteError}
        onConfirm={() => {
          void remove();
        }}
        onCancel={cancel}
      />
    </section>
  );
}

function ContextEditor({ standId, ...scope }: EditorContext & {
  standId?: string;
}) {
  const { state, retry } = usePersonalStand(scope.repository, scope.context, standId);

  if (state.status === "loading") {
    return <p role="status">Caricamento dello stand…</p>;
  }
  if (state.status === "error") {
    return <div role="alert"><p>Impossibile leggere lo stand sul dispositivo.</p><Button onClick={retry}>Riprova</Button></div>;
  }
  if (state.status === "missing") {
    return <div><h1>Stand non disponibile</h1><Link href="/stands">Vai agli stand</Link></div>;
  }

  return (
    <Editor
      {...scope}
      id={state.id}
      record={state.record}
    />
  );
}

export function PersonalStandEditor({ standId }: {
  standId?: string;
}) {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.context === null) {
    return null;
  }

  return (
    <ContextEditor
      key={JSON.stringify([state.session.context, standId])}
      repository={state.repository}
      catalog={state.session.catalog}
      context={state.session.context}
      standId={standId}
    />
  );
}
