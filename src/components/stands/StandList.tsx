import { EmptyState } from "@/components/feedback/EmptyState";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { NavigationIcon } from "@/components/layout/NavigationIcon";
import {
  countStandVisits, defaultStandFilters, filterStandList, standKey,
} from "@/features/stands/stand-list";
import Link from "@/lib/navigation";

import { StandRow } from "./StandRow";

import type { StandFilters, StandListItem } from "@/features/stands/stand-list";
import type { Category, Pavilion, StandReference } from "@/types/catalog";

type StandListProps = {
  items: StandListItem[];
  categories: Category[];
  pavilions: Pavilion[];
  filters: StandFilters;
  saving: string[];
  onFiltersChange: (changes: Partial<StandFilters>) => void;
  onInterestChange: (standId: string, interested: boolean, source: StandReference["source"]) => void;
};

const statusFilters = [
  {
    value: "",
    label: "Tutti",
  },
  {
    value: "to_visit",
    label: "Da visitare",
  },
  {
    value: "visited",
    label: "Visitati",
  },
  {
    value: "to_revisit",
    label: "Da rivedere",
  },
] as const;

export function StandList({
  items, categories, pavilions, filters, saving, onFiltersChange, onInterestChange,
}: StandListProps) {
  const results = filterStandList(items, filters);
  const statusItems = filterStandList(items, {
    ...filters,
    status: "",
  });
  const counts = countStandVisits(statusItems);
  const hasFilters = filters.query !== "" || filters.status !== "" || filters.category !== ""
    || filters.pavilion !== "" || filters.priority !== "" || filters.interest === "excluded" || filters.sort !== "priority";

  function patch(changes: Partial<StandFilters>) {
    onFiltersChange(changes);
  }

  return (
    <div className="stand-list">
      <Link
        className="stand-new-link"
        href="/stands/new?from=list"
      >+ Nuovo stand
      </Link>
      <div className="stand-list-heading">
        <h1 id="stands-title">Stand</h1>
        <div
          className="stand-view-switch"
          role="group"
          aria-label="Vista stand"
        >
          <button
            type="button"
            aria-pressed={filters.interest === "interested"}
            onClick={() => {
              patch({
                interest: "interested",
              });
            }}
          >
            I miei interessi
          </button>
          <button
            type="button"
            aria-label="Mostra tutti gli stand"
            aria-pressed={filters.interest === "all"}
            onClick={() => {
              patch({
                interest: "all",
              });
            }}
          >
            Tutti gli stand
          </button>
        </div>
      </div>
      <div className="stand-search">
        <TextField
          id="stand-search"
          label="Cerca stand"
          labelClassName="sr-only"
          type="search"
          placeholder="Cerca uno stand…"
          value={filters.query}
          onChange={(event) => {
            patch({
              query: event.target.value,
            });
          }}
        />
        <span className="stand-search-icon"><NavigationIcon name="search" /></span>
        {filters.query !== "" && (
          <button
            type="button"
            className="stand-search-clear"
            aria-label="Cancella ricerca"
            onClick={() => {
              patch({
                query: "",
              });
            }}
          >
            <NavigationIcon name="close" />
          </button>
        )}
      </div>
      <div
        className="stand-status-filters"
        role="group"
        aria-label="Stato visita"
      >
        {statusFilters.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            aria-pressed={filters.status === value}
            onClick={() => {
              patch({
                status: value,
              });
            }}
          >
            {label}({value === "" ? statusItems.length : counts[value]})
          </button>
        ))}
      </div>
      <div
        className="stand-filter-bar"
        id="stand-filters"
      >
        <SelectField
          compact
          label="Categoria"
          value={filters.category}
          onChange={(event) => {
            patch({
              category: event.target.value,
            });
          }}
        >
          <option value="">Categoria</option>
          {categories.map((entry) => (
            <option
              key={entry.id}
              value={entry.id}
            >{entry.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          compact
          label="Padiglione"
          value={filters.pavilion}
          onChange={(event) => {
            patch({
              pavilion: event.target.value,
            });
          }}
        >
          <option value="">Padiglione</option>
          <option value="missing">Non disponibile</option>
          {pavilions.map((entry) => (
            <option
              key={entry.id}
              value={entry.id}
            >{entry.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          compact
          label="Priorità"
          value={filters.priority}
          onChange={(event) => {
            patch({
              priority: event.target.value,
            });
          }}
        >
          <option value="">Priorità</option>
          <option value="none">Non impostata</option>
          {Array.from({
            length: 10,
          }, (_, index) => 10 - index).map((value) => (
            <option
              key={value}
              value={value}
            >{value}/10
            </option>
          ))}
        </SelectField>
        <details className="stand-more-filters">
          <summary id="stand-more-filters"><NavigationIcon name="filters" /><span>Filtri</span></summary>
          <div className="stand-filter-panel">
            <SelectField
              label="Interesse personale"
              value={filters.interest}
              onChange={(event) => {
                patch({
                  interest: event.target.value as StandFilters["interest"],
                });
              }}
            >
              <option value="interested">Di mio interesse</option>
              <option value="all">Tutti</option>
              <option value="excluded">Non di mio interesse</option>
            </SelectField>
            <SelectField
              label="Ordina per"
              value={filters.sort}
              onChange={(event) => {
                patch({
                  sort: event.target.value as StandFilters["sort"],
                });
              }}
            >
              <option value="priority">Priorità decrescente</option>
              <option value="name">Nome</option>
            </SelectField>
          </div>
        </details>
      </div>
      <div className={`stand-result-count ${hasFilters ? "" : "sr-only"}`}>
        <p role="status">{results.length} {results.length === 1 ? "stand trovato" : "stand trovati"}</p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              onFiltersChange(defaultStandFilters());
            }}
          >Azzera filtri
          </button>
        )}
      </div>
      {results.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "Nessuno stand disponibile" : "Nessuno stand trovato"}
          description={items.length === 0 ? "Il catalogo dell’evento non contiene stand." : "Modifica la ricerca o i filtri, oppure scegli Tutti gli stand per consultare il catalogo completo."}
        />
      ) : (
        <ul
          aria-label="Elenco stand"
          className="stand-rows"
        >
          {results.map((stand) => (
            <StandRow
              key={standKey(stand.source, stand.id)}
              stand={stand}
              saving={saving.includes(standKey(stand.source, stand.id))}
              onInterestChange={(interested) => {
                onInterestChange(stand.id, interested, stand.source);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
