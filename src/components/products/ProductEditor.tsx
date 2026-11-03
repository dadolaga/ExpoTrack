"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { SaveStatus } from "@/components/feedback/SaveStatus";
import { RatingSlider } from "@/components/forms/RatingSlider";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { NavigationIcon } from "@/components/layout/NavigationIcon";
import { PhotoImage } from "@/components/photos/PhotoImage";
import { ProductPhotos } from "@/components/photos/ProductPhotos";
import { ProductBudget } from "@/components/profiles/BudgetSettings";
import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { ProductQuestionnaire } from "@/components/questionnaires/ProductQuestionnaire";
import { SyncIndicator } from "@/components/sync/SyncStatus";
import { Button } from "@/components/ui/Button";
import { useProductPhotos } from "@/features/photos/use-product-photos";
import { useProductEditor, useProductLoader } from "@/features/products/use-product-editor";
import { standHref } from "@/features/stands/stand-list";
import { useStandList } from "@/features/stands/use-stand-list";
import { parsePrice, sameStand } from "@/lib/offline/product-input";

import { ProductDescription } from "./ProductDescription";
import { StandPicker } from "./StandPicker";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { LocalContext, ProductInput } from "@/types/offline";

type Scope = {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  context: LocalContext;
};

function Editor({
  repository, catalog, context, loaded, creating,
}: Scope & {
  loaded: Extract<ReturnType<typeof useProductLoader>["state"], {
    status: "ready";
  }>;
  creating: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { leave } = useProfileSession();
  const {
    autosave, record, refreshRecord, busy, confirm, actionError, duplicate, remove, openConfirm, cancel,
  } = useProductEditor(repository, context, loaded);
  const data = useStandList(repository, catalog, context);
  const input = autosave.value;
  const photos = useProductPhotos(repository, context, loaded.id, input, autosave.retry, refreshRecord);
  const locked = record?.lastValid !== undefined && record.lastValid !== null;
  const stand = data.items.find((item) => sameStand(input.standRef, {
    source: item.source,
    eventId: context.eventId,
    standId: item.id,
  }));
  const view = params.get("view");
  let title = creating ? "Nuovo prodotto" : "Modifica prodotto";
  let subtitle = stand === undefined ? "Scegli lo stand del prodotto" : `${stand.name} · ${stand.location}`;

  if (view === "stands") {
    title = "Seleziona stand";
    subtitle = `Nuovo prodotto · ${catalog.config.events.find((event) => event.id === context.eventId)?.name ?? ""}`;
  }
  if (view === "photos") {
    title = "Fotografie";
    subtitle = `${stand?.name ?? "Stand da selezionare"} · ${input.name.trim() === "" ? "Prodotto senza nome" : input.name}`;
  }
  if (view === "description" || view === "question") {
    title = view === "question" ? "Modifica risposta" : "Descrizione personale";
    subtitle = `${stand?.name ?? "Stand da selezionare"} · ${input.name.trim() === "" ? "Prodotto senza nome" : input.name}`;
  }

  function change(patch: Partial<ProductInput>) {
    autosave.change({
      ...input,
      ...patch,
    });
  }

  function show(viewName: string | null, replace = false, questionId?: string) {
    const url = new URL(window.location.href);

    if (viewName === null) {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", viewName);
    }
    if (questionId === undefined) {
      url.searchParams.delete("question");
    } else {
      url.searchParams.set("question", questionId);
    }
    void leave(() => {
      if (replace) {
        window.history.replaceState(null, "", url);
      } else {
        window.history.pushState(null, "", url);
      }
    });
  }

  function finish() {
    void leave(() => {
      router.replace(creating && input.standRef !== null ? standHref({
        id: input.standRef.standId,
        source: input.standRef.source,
      }) : loaded.returnHref);
    });
  }

  return (
    <section
      className="product-editor"
      aria-labelledby="product-title"
    >
      <header
        className="product-header"
        data-view={view ?? undefined}
      >
        <button
          type="button"
          disabled={busy || photos.busy}
          aria-label={view !== null ? "Torna al prodotto" : "Torna indietro"}
          onClick={() => {
            if (view !== null) {
              show(null, true);
            } else {
              autosave.back();
            }
          }}
        ><NavigationIcon name="back" />
        </button>
        <div>
          {view === null && <p className="stand-wordmark">Expo<span>Track</span></p>}
          <SyncIndicator />
          <h1 id="product-title">{title}</h1>
          <p className="product-context">{subtitle}</p>
        </div>
      </header>
      {view === "photos" && (
        <ProductPhotos
          workflow={photos}
          onBack={() => {
            show(null, true);
          }}
        />
      )}
      {view === "description" && (
        <ProductDescription
          value={input.description}
          status={autosave.status}
          onChange={(description) => {
            change({
              description,
            });
          }}
          onRetry={() => {
            void autosave.retry();
          }}
          onBack={() => {
            show(null, true);
          }}
        />
      )}
      {view === "question" && (
        <div className="product-fields question-detail">
          <ProductQuestionnaire
            catalog={catalog}
            profileId={context.profileId}
            categoryId={input.categoryId}
            inputs={input.questionnaireInputs ?? []}
            questionId={params.get("question") ?? ""}
            onChange={(questionnaireInputs) => {
              change({
                questionnaireInputs,
              });
            }}
          />
          <SaveStatus
            status={autosave.status}
            onRetry={() => {
              void autosave.retry();
            }}
          />
          <Button
            variant="secondary"
            onClick={() => {
              show(null, true);
            }}
          >Torna al prodotto
          </Button>
        </div>
      )}
      {view === "stands" && autosave.status === "error" && (
        <SaveStatus
          status={autosave.status}
          onRetry={() => {
            void autosave.retry();
          }}
        />
      )}
      {view === "stands" && !locked && (
        <StandPicker
          data={data}
          eventId={context.eventId}
          onSelect={(standRef) => {
            change({
              standRef,
            });
            show(null, true);
          }}
        />
      )}
      {view !== "photos" && view !== "description" && view !== "question" && (view !== "stands" || locked) && (
        <fieldset
          className="product-fields"
          disabled={busy || photos.busy}
          aria-label="Modifica prodotto"
        >
          <div className="product-stand-field">
            <span>Stand *</span>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                show("stands");
              }}
            >{stand?.name ?? "Seleziona stand"}<span aria-hidden="true">{locked ? "✓" : "›"}</span>
            </button>
          </div>
          {!locked && <p className="text-caption text-text-muted">Stand e categoria non saranno più modificabili alla prima registrazione valida.</p>}
          <TextField
            label="Nome prodotto"
            requiredIndicator="asterisk"
            required
            value={input.name}
            placeholder="Nome del prodotto"
            error={record?.issues.name}
            onChange={(event) => {
              change({
                name: event.target.value,
              });
            }}
          />
          <SelectField
            label="Categoria *"
            required
            value={input.categoryId ?? ""}
            disabled={locked}
            onChange={(event) => {
              change({
                categoryId: event.target.value === "" ? null : event.target.value,
              });
            }}
          >
            <option value="">Seleziona categoria</option>
            {catalog.categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >{category.name}
              </option>
            ))}
          </SelectField>
          {record?.issues.categoryId !== undefined && <p className="text-label text-danger">{record.issues.categoryId}</p>}
          {record?.issues.standRef !== undefined && <p className="text-label text-danger">{record.issues.standRef}</p>}
          <div className="product-price-rating">
            <TextField
              label="Prezzo (€)"
              inputMode="decimal"
              value={input.price ?? ""}
              placeholder="0,00"
              error={record?.issues.price}
              onChange={(event) => {
                change({
                  price: event.target.value,
                });
              }}
            />
            <RatingSlider
              label="Valutazione"
              value={input.rating ?? null}
              onChange={(rating) => {
                change({
                  rating,
                });
              }}
            />
          </div>
          <ProductBudget
            repository={repository}
            catalog={catalog}
            profileId={context.profileId}
            categoryId={input.categoryId}
            price={input.price ?? ""}
          />
          <label className="product-favorite">
            <span
              aria-hidden="true"
              className="product-heart"
            >♡
            </span><span>Aggiungi ai preferiti</span>
            <input
              type="checkbox"
              role="switch"
              checked={input.favorite ?? false}
              onChange={(event) => {
                change({
                  favorite: event.target.checked,
                });
              }}
            />
          </label>
          <button
            type="button"
            className="product-section-link"
            onClick={() => {
              show("description");
            }}
          >
            <span
              className="product-section-icon"
              aria-hidden="true"
            >▤
            </span>
            <span><strong>Descrizione personale</strong><span className="product-description-preview">{input.description.trim() === "" ? "Nessuna descrizione" : input.description}</span></span>
            <span aria-hidden="true">›</span>
          </button>
          <ProductQuestionnaire
            catalog={catalog}
            profileId={context.profileId}
            categoryId={input.categoryId}
            inputs={input.questionnaireInputs ?? []}
            onChange={(questionnaireInputs) => {
              change({
                questionnaireInputs,
              });
            }}
          />
          <button
            type="button"
            className="product-section-link"
            onClick={() => {
              show("photos");
            }}
          >
            <span
              className="product-section-icon"
              aria-hidden="true"
            >▧
            </span>
            <span><strong>Fotografie</strong><span className="product-description-preview">{photos.items.length === 0 ? "Scatta o aggiungi dalla galleria" : `${photos.items.length} fotografie`}</span></span>
            <span aria-hidden="true">›</span>
          </button>
          {photos.items.length > 0 && (
            <div
              className="product-photo-preview"
              aria-label="Anteprime fotografie"
            >
              {photos.items.slice(0, 3).map((photo) => (
                <PhotoImage
                  key={photo.id}
                  blob={photo.thumbnail}
                  alt={photo.filename}
                  width={160}
                  height={160}
                />
              ))}
            </div>
          )}
          <SaveStatus
            status={autosave.status}
            onRetry={() => {
              void autosave.retry();
            }}
          />
          <Button
            onClick={finish}
            disabled={!locked || input.name.trim() === "" || parsePrice(input.price ?? "") === undefined}
          >✓ Fine
          </Button>
          {locked && (
            <Button
              variant="secondary"
              onClick={duplicate}
            >Duplica prodotto
            </Button>
          )}
          {record !== undefined && (
            <Button
              variant="secondary"
              className="product-delete-action"
              onClick={openConfirm}
            >Elimina prodotto
            </Button>
          )}
          {actionError !== null && !confirm && (
            <p
              role="alert"
              className="text-danger"
            >{actionError}
            </p>
          )}
          {busy && <p role="status">Operazione in corso…</p>}
        </fieldset>
      )}
      <ConfirmDialog
        open={confirm}
        title="Eliminare il prodotto?"
        confirmLabel="Elimina prodotto"
        description="Il prodotto verrà rimosso dalla tua raccolta. L’operazione non può essere annullata."
        busy={busy}
        error={actionError}
        onConfirm={remove}
        onCancel={cancel}
      />
    </section>
  );
}

function ContextEditor({ productId, ...scope }: Scope & {
  productId?: string;
}) {
  const { state, retry } = useProductLoader(scope.repository, scope.catalog, scope.context, productId);

  if (state.status === "loading") {
    return <p role="status">Caricamento prodotto…</p>;
  }
  if (state.status === "error") {
    return <div role="alert"><p>Impossibile leggere il prodotto sul dispositivo.</p><Button onClick={retry}>Riprova</Button></div>;
  }
  if (state.status !== "ready") {
    return <div><h1>Prodotto non disponibile</h1><Link href="/products">Vai ai prodotti</Link></div>;
  }

  return (
    <Editor
      {...scope}
      loaded={state}
      creating={productId === undefined}
    />
  );
}

export function ProductEditor({ productId }: {
  productId?: string;
}) {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.context === null) {
    return null;
  }

  return (
    <Suspense fallback={<p role="status">Caricamento prodotto…</p>}><ContextEditor
      key={JSON.stringify([state.session.context, productId])}
      repository={state.repository}
      catalog={state.session.catalog}
      context={state.session.context}
      productId={productId}
    />
    </Suspense>
  );
}
