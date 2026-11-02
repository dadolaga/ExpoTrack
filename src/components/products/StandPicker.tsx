"use client";

import { useState } from "react";

import { TextField } from "@/components/forms/TextField";
import { StandInterestButton } from "@/components/stands/StandRow";
import { Button } from "@/components/ui/Button";
import { defaultStandFilters, filterStandList, standKey } from "@/features/stands/stand-list";
import { sameStand } from "@/lib/offline/product-input";

import type { StandListItem } from "@/features/stands/stand-list";
import type { useStandList } from "@/features/stands/use-stand-list";
import type { StandReference } from "@/types/catalog";

type StandData = ReturnType<typeof useStandList>;

export function StandPicker({ data, eventId, onSelect }: {
  data: StandData;
  eventId: string;
  onSelect: (stand: StandReference) => void;
}) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const items = filterStandList(data.items, {
    ...defaultStandFilters(),
    query,
    interest: all ? "all" : "interested",
    sort: "name",
  });
  const recent: StandListItem[] = [];

  for (const product of [...data.products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const stand = data.items.find((item) => sameStand(product.standRef, {
      source: item.source,
      eventId,
      standId: item.id,
    }));

    if (stand !== undefined && !recent.includes(stand)) {
      recent.push(stand);
    }
  }

  function rows(stands: StandListItem[]) {
    return (
      <ul className="product-stand-rows">
        {stands.map((stand) => (
          <li key={standKey(stand.source, stand.id)}>
            <span
              aria-hidden="true"
              className="stand-avatar"
            >{stand.name.slice(0, 2).toLocaleUpperCase("it-IT")}
            </span>
            <button
              type="button"
              className="product-stand-select"
              onClick={() => {
                onSelect({
                  source: stand.source,
                  eventId,
                  standId: stand.id,
                });
              }}
            >
              <strong>{stand.name}</strong><small>{stand.location}</small>
            </button>
            <StandInterestButton
              name={stand.name}
              interested={stand.interested}
              saving={data.saving.includes(standKey(stand.source, stand.id))}
              onInterestChange={(interested) => {
                void data.changeInterest(stand.id, interested, stand.source);
              }}
            />
            <span aria-hidden="true">›</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="stand-detail">
      <TextField
        label="Cerca uno stand"
        type="search"
        value={query}
        placeholder="Cerca uno stand…"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <p className="text-caption text-text-muted">{all ? "Ricerca in tutti gli stand dell’evento" : "Ricerca nei tuoi stand di interesse"}</p>
      {data.status === "loading" && <p role="status">Caricamento stand…</p>}
      {data.status === "error" && <div role="alert">Impossibile leggere gli stand. <Button onClick={data.retryLoad}>Riprova</Button></div>}
      {!all && query.trim() === "" && (
        <section><h2>Stand recenti</h2>{recent.length === 0
          ? <p className="text-label text-text-muted">Nessuno stand ancora usato per i prodotti.</p> : rows(recent.slice(0, 5))}
        </section>
      )}
      <section>
        <div className="stand-section-heading"><h2>{all ? "Tutti gli stand" : "I tuoi stand di interesse"} ({items.length})</h2>
          <button
            type="button"
            className="product-text-action"
            onClick={() => {
              setAll(!all);
            }}
          >{all ? "Solo interessi" : "Mostra tutti"}
          </button>
        </div>
        {data.status === "ready" && items.length === 0 ? <p>Nessuno stand trovato.</p> : rows(items)}
      </section>
      {data.failed !== null && (
        <div role="alert">
          <p>Interesse non salvato.</p>
          <Button
            onClick={() => {
              if (data.failed !== null) {
                void data.changeInterest(data.failed.standId, data.failed.interested, data.failed.source);
              }
            }}
          >Riprova
          </Button>
        </div>
      )}
      {!all && (
        <button
          type="button"
          className="product-section-link"
          onClick={() => {
            setAll(true);
          }}
        >
          <span className="product-section-icon">⌕</span><span><strong>Non trovi lo stand?</strong><small>Mostra tutti gli stand della fiera</small></span><span>›</span>
        </button>
      )}
    </div>
  );
}
