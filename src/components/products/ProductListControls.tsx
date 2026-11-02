"use client";

import { useState } from "react";

import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { NavigationIcon } from "@/components/layout/NavigationIcon";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { defaultProductFilters, productFilterIssues } from "@/features/products/product-list";
import { standKey } from "@/features/stands/stand-list";

import type { ProductFilters, ProductListItem } from "@/features/products/product-list";
import type { Category } from "@/types/catalog";

const sorts: {
  value: ProductFilters["sort"];
  label: string;
  description: string;
}[] = [
  {
    value: "recent",
    label: "Ultimi aggiunti",
    description: "Più recenti prima",
  },
  {
    value: "rating",
    label: "Valutazione",
    description: "Da 10 a 1, non valutati in fondo",
  },
  {
    value: "name",
    label: "Nome prodotto",
    description: "A → Z",
  },
  {
    value: "stand",
    label: "Stand",
    description: "A → Z",
  },
  {
    value: "price",
    label: "Prezzo",
    description: "Dal più alto, prezzi assenti in fondo",
  },
  {
    value: "favorites",
    label: "Preferiti",
    description: "Prima i preferiti",
  },
];

export function ProductListControls({
  items, filters, categories, contextLabel, onChange,
}: {
  items: ProductListItem[];
  filters: ProductFilters;
  categories: Category[];
  contextLabel: string;
  onChange: (patch: Partial<ProductFilters>) => void;
}) {
  const [panel, setPanel] = useState<"filters" | "sort" | null>(null);
  const [draft, setDraft] = useState(filters);
  const issues = productFilterIssues(draft);
  const invalid = Object.values(issues).some((issue) => issue !== undefined);
  const names = new Map(items.map((item) => [standKey(item.standRef.source, item.standRef.standId), item.standName]));
  const stands = [...names]
    .sort((a, b) => a[1].localeCompare(b[1], "it"));
  const chips = [
    {
      label: "Tutti",
      count: items.length,
      active: filters.status === "all" && !filters.favorites,
      status: "all",
      favorites: false,
    },
    {
      label: "Preferiti",
      count: items.filter((item) => item.favorite).length,
      active: filters.favorites,
      status: "all",
      favorites: true,
    },
    {
      label: "Registrati",
      count: items.filter((item) => item.kind === "registered").length,
      active: filters.status === "registered",
      status: "registered",
      favorites: false,
    },
    {
      label: "Pianificati",
      count: items.filter((item) => item.kind === "planned").length,
      active: filters.status === "planned",
      status: "planned",
      favorites: false,
    },
  ] as const;

  function patch(changes: Partial<ProductFilters>) {
    setDraft((current) => ({
      ...current,
      ...changes,
    }));
  }

  function close() {
    setPanel(null);
  }

  return (
    <>
      <header className="product-list-header">
        <div><p className="stand-wordmark">Expo<span>Track</span></p><h1>Prodotti</h1><p className="text-caption text-text-muted">{contextLabel}</p></div>
        <button
          type="button"
          aria-label="Ordina prodotti"
          onClick={() => {
            setPanel("sort");
          }}
        ><span aria-hidden="true">↓↑</span>
        </button>
        <button
          type="button"
          aria-label="Filtri prodotti"
          onClick={() => {
            setDraft(filters);
            setPanel("filters");
          }}
        ><NavigationIcon name="filters" />
        </button>
      </header>
      <TextField
        label="Cerca prodotti"
        labelClassName="sr-only"
        type="search"
        placeholder="Cerca un prodotto…"
        value={filters.query}
        onChange={(event) => {
          onChange({
            query: event.target.value,
          });
        }}
      />
      <div
        className="product-filter-chips"
        aria-label="Filtri rapidi"
      >
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            aria-pressed={chip.active}
            onClick={() => {
              onChange({
                status: chip.status,
                favorites: chip.favorites,
              });
            }}
          >{chip.label} <span>{chip.count}</span>
          </button>
        ))}
      </div>
      <div className="product-filter-selects">
        <SelectField
          label="Categoria"
          compact
          value={filters.category}
          onChange={(event) => {
            onChange({
              category: event.target.value,
            });
          }}
        >
          <option value="">Categoria: tutte</option>{categories.map((category) => (
            <option
              key={category.id}
              value={category.id}
            >{category.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Stand"
          compact
          value={filters.stand}
          onChange={(event) => {
            onChange({
              stand: event.target.value,
            });
          }}
        >
          <option value="">Stand: tutti</option>{stands.map(([id, name]) => (
            <option
              key={id}
              value={id}
            >{name}
            </option>
          ))}
        </SelectField>
      </div>
      <Sheet
        open={panel === "sort"}
        title="Ordina per"
        onClose={close}
      >
        <fieldset className="product-sort-options"><legend className="sr-only">Ordinamento prodotti</legend>
          {sorts.map((sort) => (
            <label key={sort.value}><input
              type="radio"
              name="product-sort"
              checked={filters.sort === sort.value}
              onChange={() => {
                onChange({
                  sort: sort.value,
                });
                close();
              }}
            /><span><strong>{sort.label}</strong><small>{sort.description}</small></span>
            </label>
          ))}
        </fieldset>
      </Sheet>
      <Sheet
        open={panel === "filters"}
        title="Filtri prodotti"
        onClose={close}
      >
        <div className="product-filter-panel">
          <button
            type="button"
            className="product-text-action"
            onClick={() => {
              setDraft(defaultProductFilters());
            }}
          >Azzera filtri
          </button>
          <SelectField
            label="Stato prodotto"
            value={draft.status}
            onChange={(event) => {
              patch({
                status: event.target.value as ProductFilters["status"],
              });
            }}
          >
            <option value="all">Registrati e pianificati</option><option value="registered">Registrati</option><option value="planned">Pianificati</option>
          </SelectField>
          <label className="product-filter-favorite"><input
            type="checkbox"
            checked={draft.favorites}
            onChange={(event) => {
              patch({
                favorites: event.target.checked,
              });
            }}
          />Solo preferiti
          </label>
          <SelectField
            label="Categoria prodotto"
            value={draft.category}
            onChange={(event) => {
              patch({
                category: event.target.value,
              });
            }}
          >
            <option value="">Tutte le categorie</option>{categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >{category.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Stand del prodotto"
            value={draft.stand}
            onChange={(event) => {
              patch({
                stand: event.target.value,
              });
            }}
          >
            <option value="">Tutti gli stand</option>{stands.map(([id, name]) => (
              <option
                key={id}
                value={id}
              >{name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Valutazione minima"
            type="number"
            min={1}
            max={10}
            step={1}
            value={draft.minRating}
            error={issues.minRating}
            onChange={(event) => {
              patch({
                minRating: event.target.value,
              });
            }}
          />
          <div className="product-filter-selects">
            <TextField
              label="Prezzo minimo (€)"
              inputMode="decimal"
              value={draft.minPrice}
              error={issues.minPrice}
              onChange={(event) => {
                patch({
                  minPrice: event.target.value,
                });
              }}
            />
            <TextField
              label="Prezzo massimo (€)"
              inputMode="decimal"
              value={draft.maxPrice}
              error={issues.maxPrice}
              onChange={(event) => {
                patch({
                  maxPrice: event.target.value,
                });
              }}
            />
          </div>
          <SelectField
            label="Fotografie"
            value={draft.photos}
            onChange={(event) => {
              patch({
                photos: event.target.value as ProductFilters["photos"],
              });
            }}
          >
            <option value="all">Con e senza foto</option><option value="with">Con foto</option><option value="without">Senza foto</option>
          </SelectField>
          <Button
            disabled={invalid}
            onClick={() => {
              onChange(draft);
              close();
            }}
          >Applica filtri
          </Button>
        </div>
      </Sheet>
    </>
  );
}
