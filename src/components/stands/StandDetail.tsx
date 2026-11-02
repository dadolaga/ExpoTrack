"use client";

import Link from "next/link";

import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { Button } from "@/components/ui/Button";
import { standHref } from "@/features/stands/stand-list";
import { useStandDetail } from "@/features/stands/use-stand-detail";

import { StandChecklist } from "./StandChecklist";
import { StandInterestButton } from "./StandRow";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot, StandReference } from "@/types/catalog";
import type { LocalContext, VisitStatus } from "@/types/offline";

function ContextStandDetail({
  repository, catalog, context, standId, source,
}: {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  context: LocalContext;
  standId: string;
  source: StandReference["source"];
}) {
  const state = useStandDetail(repository, catalog, context, standId, source);
  const stand = state.detail;

  if (state.loadError) {
    return <div role="alert"><p>Impossibile leggere lo stand sul dispositivo.</p><Button onClick={state.retryLoad}>Riprova</Button></div>;
  }
  if (state.loading) {
    return <p role="status">Caricamento dello stand…</p>;
  }
  if (stand === null) {
    return <div><h1>Stand non disponibile</h1><p>Questo stand non è nel catalogo dell’evento attivo.</p><Link href="/stands">Vai agli stand</Link></div>;
  }
  let saveMessage = "";

  if (state.saving) {
    saveMessage = "Salvataggio sul dispositivo…";
  } else if (state.saved) {
    saveMessage = "Salvato sul dispositivo";
  }

  return (
    <div className="stand-detail">
      <div className="stand-detail-hero">
        <span
          className="stand-avatar"
          aria-hidden="true"
        >{stand.name.slice(0, 2).toLocaleUpperCase("it-IT")}
        </span>
        <div className="min-w-0">
          <h1>{stand.name}</h1>
          <p>{stand.categoryNames.join(" · ")}</p>
          <p>{stand.location}</p>
        </div>
        <StandInterestButton
          name={stand.name}
          interested={stand.interested}
          saving={state.saving}
          onInterestChange={(interested) => {
            void state.save({
              interested,
            });
          }}
        />
        <label className="stand-detail-priority">
          <select
            aria-label="Priorità dello stand"
            disabled={state.saving}
            value={stand.priority ?? ""}
            onChange={(event) => {
              void state.save({
                priority: event.target.value === "" ? null : Number(event.target.value),
              });
            }}
          >
            <option value="">—</option>
            {Array.from({
              length: 10,
            }, (_, index) => 10 - index).map((value) => (
              <option
                key={value}
                value={value}
              >{value}/10
              </option>
            ))}
          </select>
          <span>Priorità</span>
        </label>
      </div>
      <label className="stand-detail-card stand-visit-control">
        <span>Stato della visita</span>
        <select
          aria-label="Stato della visita"
          data-status={stand.visitStatus}
          disabled={state.saving}
          value={stand.visitStatus}
          onChange={(event) => {
            void state.save({
              visitStatus: event.target.value as VisitStatus,
            });
          }}
        >
          <option value="to_visit">Da visitare</option>
          <option value="visited">Visitato</option>
          <option value="to_revisit">Da rivedere</option>
        </select>
      </label>
      {state.failed !== null && (
        <div
          role="alert"
          className="stand-detail-card"
        >
          <p>Modifica non salvata. Il valore precedente è ancora attivo.</p>
          <Button
            variant="secondary"
            onClick={() => {
              if (state.failed !== null) {
                void state.save(state.failed);
              }
            }}
          >Riprova salvataggio
          </Button>
        </div>
      )}
      {source === "personal" && <Link href={`${standHref(stand)}/edit?from=detail`}>Modifica stand</Link>}
      {stand.description.length > 0 && <p className="stand-detail-card">{stand.description}</p>}
      <StandChecklist
        items={stand.checklist}
        completed={stand.completed}
        saving={state.saving}
        onSave={state.save}
      />
      <section
        className="stand-detail-card"
        aria-labelledby="stand-notes-title"
      >
        <h2 id="stand-notes-title">Note personali</h2>
        <p className="stand-notes-preview">{stand.notes.length === 0 ? "Nessuna nota sullo stand." : stand.notes}</p>
        <Link href={`${standHref(stand)}/notes?from=detail`}>
          Apri note stand
        </Link>
      </section>
      <section
        className="stand-detail-card"
        aria-labelledby="planned-title"
      >
        <div className="stand-section-heading"><h2 id="planned-title">Prodotti da vedere</h2><span className="stand-count">{stand.planned.length}</span></div>
        {stand.planned.length === 0 ? <p className="text-label text-text-muted">Nessun prodotto pianificato per questo stand.</p> : (
          <ul className="stand-planned-products">
            {stand.planned.map((product) => (
              <li key={product.id}>
                <span
                  aria-hidden="true"
                  className="stand-product-fallback"
                >◇
                </span>
                <h3>
                  <Link
                    href={`/products/new?${new URLSearchParams({
                      planned: product.id,
                      return: standHref(stand),
                    })}`}
                  >{product.name}
                  </Link>
                </h3>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section
        className="stand-detail-card"
        aria-labelledby="registered-title"
      >
        <div className="stand-section-heading"><h2 id="registered-title">Prodotti registrati</h2><span className="stand-count">{stand.registered.length}</span></div>
        {stand.registered.length === 0 ? <p className="text-label text-text-muted">Nessun prodotto registrato per questo stand.</p> : (
          <ul className="stand-registered-products">
            {stand.registered.map((product) => (
              <li key={product.id}>
                <span
                  aria-hidden="true"
                  className="stand-product-fallback"
                >◇
                </span>
                <div>
                  <h3>
                    <Link
                      href={`/products/${encodeURIComponent(product.id)}?${new URLSearchParams({
                        return: standHref(stand),
                      })}`}
                    >{product.name}
                    </Link>
                  </h3>
                  <p>{catalog.categories.find((entry) => entry.id === product.categoryId)?.name}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link
        className="product-add-link"
        href={`/products/new?${new URLSearchParams({
          stand: stand.id,
          source: stand.source,
          return: standHref(stand),
        })}`}
      >+ Aggiungi prodotto
      </Link>
      <p
        role="status"
        className="text-caption text-text-muted"
      >{saveMessage}
      </p>
    </div>
  );
}

export function StandDetail({ standId, source = "catalog" }: {
  standId: string;
  source?: StandReference["source"];
}) {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.context === null) {
    return null;
  }

  return (
    <ContextStandDetail
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
