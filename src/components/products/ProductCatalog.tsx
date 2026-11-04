"use client";

import { Suspense } from "react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { Button } from "@/components/ui/Button";
import {
  defaultProductFilters, filterProductList, productFilterIssues, productHref,
} from "@/features/products/product-list";
import { useProductFilters, useProductList } from "@/features/products/use-product-list";
import Link from "@/lib/navigation";

import { ProductListControls } from "./ProductListControls";
import { ProductRow } from "./ProductRow";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { LocalContext } from "@/types/offline";

function ContextCatalog({
  repository, catalog, context, contextLabel,
}: {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  context: LocalContext;
  contextLabel: string;
}) {
  const list = useProductList(repository, catalog, context);
  const { filters, change, returnHref } = useProductFilters(context, list.status === "ready");
  const results = filterProductList(list.items, filters);
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(defaultProductFilters());
  const issues = productFilterIssues(filters);

  if (list.status === "loading") {
    return <p role="status">Caricamento prodotti…</p>;
  }
  if (list.status === "error") {
    return <div role="alert"><p>Impossibile leggere i prodotti sul dispositivo.</p><Button onClick={list.retry}>Riprova</Button></div>;
  }

  return (
    <section
      className="product-catalog"
      aria-label="Raccolta prodotti"
    >
      <ProductListControls
        items={list.items}
        filters={filters}
        categories={catalog.categories}
        contextLabel={contextLabel}
        onChange={change}
      />
      <div className="stand-result-count">
        <p role="status">{results.length} {results.length === 1 ? "prodotto trovato" : "prodotti trovati"}</p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              change(defaultProductFilters());
            }}
          >Azzera filtri
          </button>
        )}
      </div>
      {Object.values(issues).some((issue) => issue !== undefined) && <p role="alert">Correggi i limiti di prezzo o valutazione nei filtri.</p>}
      {results.length === 0 ? (
        <EmptyState
          title={list.items.length === 0 ? "Nessun prodotto" : "Nessun prodotto trovato"}
          description={list.items.length === 0 ? "Aggiungi un prodotto durante la visita per ritrovarlo qui." : "Modifica la ricerca o azzera i filtri."}
        />
      ) : (
        <ul
          className="product-rows"
          aria-label="Elenco prodotti"
        >
          {results.map((product) => (
            <ProductRow
              key={`${product.kind}:${product.id}`}
              product={product}
              href={productHref(product, returnHref)}
            />
          ))}
        </ul>
      )}
      <Link
        href={`/products/new?${new URLSearchParams({
          return: returnHref,
        })}`}
        className="product-list-add"
        aria-label="Aggiungi prodotto"
      >+
      </Link>
    </section>
  );
}

export function ProductCatalog() {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.context === null) {
    return null;
  }

  return (
    <Suspense fallback={<p role="status">Caricamento prodotti…</p>}><ContextCatalog
      key={JSON.stringify(state.session.context)}
      repository={state.repository}
      catalog={state.session.catalog}
      context={state.session.context}
      contextLabel={`${state.session.event?.name ?? ""} · Profilo: ${state.session.profile?.name ?? ""}`}
    />
    </Suspense>
  );
}
