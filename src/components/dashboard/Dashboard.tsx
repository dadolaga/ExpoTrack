"use client";

import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { NavigationIcon } from "@/components/layout/NavigationIcon";
import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { StandRow } from "@/components/stands/StandRow";
import { Button } from "@/components/ui/Button";
import {
  defaultStandFilters, selectDashboard, standFiltersQuery, standKey,
} from "@/features/stands/stand-list";
import { useStandList } from "@/features/stands/use-stand-list";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot } from "@/types/catalog";
import type { LocalContext } from "@/types/offline";

const metrics = [
  {
    key: "to_visit",
    label: "Da visitare",
    icon: "stands",
  },
  {
    key: "visited",
    label: "Visitati",
    icon: "check",
  },
  {
    key: "to_revisit",
    label: "Da rivedere",
    icon: "revisit",
  },
  {
    key: "products",
    label: "Prodotti registrati",
    icon: "products",
  },
] as const;

function ContextDashboard({ repository, catalog, context }: {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  context: LocalContext;
}) {
  const data = useStandList(repository, catalog, context);

  if (data.status === "loading") {
    return <p role="status">Caricamento della visita…</p>;
  }
  if (data.status === "error") {
    return <div role="alert"><p>Impossibile leggere la visita sul dispositivo.</p><Button onClick={data.retryLoad}>Riprova</Button></div>;
  }
  const summary = selectDashboard(data.items, data.products, context);
  const allHref = `/stands?${standFiltersQuery(defaultStandFilters(), context)}`;

  return (
    <div className="dashboard">
      <section
        className="dashboard-overview"
        aria-labelledby="visit-title"
      >
        <h1 id="visit-title">La tua visita</h1>
        <p>Panoramica del tuo progresso all’evento</p>
        <div className="dashboard-metrics">
          {metrics.map((metric) => {
            const count = metric.key === "products" ? summary.products : summary.counts[metric.key];
            const href = metric.key === "products" ? "/products"
              : `/stands?${standFiltersQuery({
                ...defaultStandFilters(),
                status: metric.key,
              }, context)}`;

            return (
              <Link
                key={metric.key}
                href={href}
                data-metric={metric.key}
                className="dashboard-metric"
                aria-label={`${metric.label}: ${count}. Apri la lista`}
              >
                <span className="dashboard-metric-icon"><NavigationIcon name={metric.icon} /></span>
                <span><strong>{count}</strong><span>{metric.label}</span></span>
                <span className="stand-row-chevron"><NavigationIcon name="back" /></span>
              </Link>
            );
          })}
        </div>
      </section>
      <section
        className="dashboard-priorities"
        aria-labelledby="priority-title"
      >
        <div className="stand-section-heading">
          <h2 id="priority-title">I tuoi stand prioritari</h2>
          <Link href={allHref}>Vedi tutti ›</Link>
        </div>
        {summary.priorities.length === 0 ? (
          <EmptyState
            title="Nessuno stand prioritario"
            description="Assegna una priorità agli stand di interesse da visitare o da rivedere."
          />
        ) : (
          <ul className="stand-rows">
            {summary.priorities.map((stand) => (
              <StandRow
                key={standKey(stand.source, stand.id)}
                stand={stand}
                origin="dashboard"
              />
            ))}
          </ul>
        )}
      </section>
      <Link
        href="/products/new"
        className="product-add-link"
      >+ Aggiungi prodotto
      </Link>
      <Link
        href="/stands"
        className="dashboard-explore"
      ><NavigationIcon name="stands" /><span>Esplora stand<small>Cerca e filtra</small></span>
      </Link>
    </div>
  );
}

export function Dashboard() {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.context === null) {
    return null;
  }

  return (
    <ContextDashboard
      key={JSON.stringify(state.session.context)}
      repository={state.repository}
      catalog={state.session.catalog}
      context={state.session.context}
    />
  );
}
