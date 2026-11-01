"use client";

import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { Button } from "@/components/ui/Button";
import { useStandFilters } from "@/features/stands/use-stand-filters";
import { useStandList } from "@/features/stands/use-stand-list";

import { StandList } from "./StandList";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { LocalContext } from "@/types/offline";

function ContextStandCatalog({ repository, catalog, context }: {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  context: LocalContext;
}) {
  const list = useStandList(repository, catalog, context);
  const { filters, changeFilters } = useStandFilters(context, list.status === "ready");

  if (list.status === "loading") {
    return <p role="status">Caricamento degli stand…</p>;
  }
  if (list.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">Impossibile leggere gli interessi sul dispositivo.</p>
        <Button onClick={list.retryLoad}>Riprova</Button>
      </div>
    );
  }
  let saveMessage = "";

  if (list.saving.length > 0) {
    saveMessage = "Salvataggio sul dispositivo…";
  } else if (list.saved && list.failed === null) {
    saveMessage = "Interesse salvato sul dispositivo.";
  }

  return (
    <div className="flex flex-col gap-4">
      {list.failed !== null && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 text-danger"
        >
          <p>Interesse non salvato. Il valore precedente è ancora attivo.</p>
          <Button
            variant="secondary"
            onClick={() => {
              if (list.failed !== null) {
                void list.changeInterest(list.failed.standId, list.failed.interested);
              }
            }}
          >
            Riprova salvataggio
          </Button>
        </div>
      )}
      <StandList
        items={list.items}
        categories={catalog.categories}
        pavilions={catalog.pavilions.filter((entry) => entry.eventId === context.eventId)}
        filters={filters}
        saving={list.saving}
        onFiltersChange={changeFilters}
        onInterestChange={(standId, interested) => {
          void list.changeInterest(standId, interested);
        }}
      />
      <p
        role="status"
        className="sr-only"
      >{saveMessage}
      </p>
    </div>
  );
}

export function StandCatalog() {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.context === null) {
    return null;
  }

  return (
    <ContextStandCatalog
      key={JSON.stringify([state.session.context.profileId, state.session.context.eventId])}
      repository={state.repository}
      catalog={state.session.catalog}
      context={state.session.context}
    />
  );
}
