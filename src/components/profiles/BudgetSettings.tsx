"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SaveStatus } from "@/components/feedback/SaveStatus";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLocalAutosave } from "@/features/use-local-autosave";
import { useRemoteRevision } from "@/features/use-local-revision";
import { parsePrice } from "@/lib/offline/product-input";
import { effectiveBudget } from "@/lib/offline/profile-settings";

import { useProfileSession } from "./ProfileProvider";

import type { LocalRepository } from "@/lib/offline/repository";
import type { CatalogSnapshot, Category } from "@/types/catalog";
import type { BudgetOverride } from "@/types/offline";

const money = (value: number) => new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
}).format(value);

function useBudgets(repository: LocalRepository) {
  const remoteRevision = useRemoteRevision(repository);
  const [overrides, setOverrides] = useState<BudgetOverride[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    void repository.listBudgetOverrides().then((entries) => {
      if (active) {
        setOverrides(entries);
        setError(false);
      }
    }).catch(() => {
      if (active) {
        setError(true);
      }
    });

    return () => {
      active = false;
    };
  }, [
    repository, attempt, remoteRevision,
  ]);

  return {
    overrides,
    error,
    retry: () => {
      setAttempt((value) => value + 1);
    },
  };
}

function BudgetRow({
  repository, catalog, profileId, category, overrides,
}: {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  profileId: string;
  category: Category;
  overrides: BudgetOverride[];
}) {
  const existing = overrides.find((entry) => entry.profileId === profileId
    && entry.categoryId === category.id && !entry.removed);
  let initial: string | null | undefined;

  if (existing !== undefined) {
    initial = existing.amount === null ? null : String(existing.amount);
  }
  const write = useCallback(async (amount: string | null | undefined) => {
    await repository.setBudget(profileId, category.id, amount);
  }, [
    repository, profileId, category.id,
  ]);
  const autosave = useLocalAutosave<string | null | undefined>(initial, write, "/profile");
  const reset = autosave.reset;

  useEffect(() => repository.subscribe((kind) => {
    if (kind === "remote") {
      void repository.listBudgetOverrides().then((entries) => {
        const override = entries.find((entry) => entry.profileId === profileId
          && entry.categoryId === category.id && !entry.removed);
        let value: string | null | undefined;

        if (override !== undefined) {
          value = override.amount === null ? null : String(override.amount);
        }
        reset(value);
      }).catch(() => undefined);
    }
  }), [
    repository, profileId, category.id, reset,
  ]);
  const seed = effectiveBudget(catalog, [], profileId, category.id);
  const inherited = autosave.value === undefined;
  const amount = inherited ? seed.amount : parsePrice(autosave.value ?? "") ?? null;
  let originLabel = "Personale";
  let displayedAmount = autosave.value ?? "";

  if (inherited) {
    originLabel = seed.origin === "json" ? "Configurato · JSON" : "Nessun budget configurato";
    displayedAmount = seed.amount === null ? "" : String(seed.amount);
  }
  const invalid = typeof autosave.value === "string" && (autosave.value.trim() === ""
    || parsePrice(autosave.value) === undefined);

  return (
    <Card>
      <h2>{category.name}</h2>
      <p className="text-caption text-text-muted">
        {originLabel}
        {amount !== null && ` · ${money(amount)}`}
      </p>
      <TextField
        label={`Budget per ${category.name} (EUR)`}
        inputMode="decimal"
        placeholder="Nessun budget"
        value={displayedAmount}
        error={invalid ? "Inserisci un importo non negativo con massimo due decimali, oppure scegli Nessun budget." : undefined}
        onChange={(event) => {
          autosave.change(event.target.value);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            autosave.change(null);
          }}
        >Nessun budget
        </Button>
        {!inherited && (
          <Button
            variant="secondary"
            onClick={() => {
              autosave.change(undefined);
            }}
          >Rimuovi override
          </Button>
        )}
      </div>
      <SaveStatus
        status={autosave.status}
        onRetry={() => {
          void autosave.retry();
        }}
      />
    </Card>
  );
}

function BudgetList({ repository, catalog, profileId }: {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  profileId: string;
}) {
  const data = useBudgets(repository);

  if (data.error) {
    return <Card><p role="alert">Impossibile leggere i budget.</p><Button onClick={data.retry}>Riprova</Button></Card>;
  }
  if (data.overrides === null) {
    return <p role="status">Caricamento budget…</p>;
  }

  const overrides = data.overrides;

  return catalog.categories.map((category) => (
    <BudgetRow
      key={`${profileId}:${category.id}`}
      repository={repository}
      catalog={catalog}
      profileId={profileId}
      category={category}
      overrides={overrides}
    />
  ));
}

export function BudgetSettings() {
  const router = useRouter();
  const { state, leave } = useProfileSession();

  if (state.status !== "ready" || state.session.profile === null) {
    return null;
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          void leave(() => {
            router.push("/profile");
          });
        }}
      >‹ Torna a Profilo
      </Button>
      <h1>Budget per categoria</h1>
      <p className="text-label text-text-muted">Budget di {state.session.profile.name}, condivisi fra eventi. Rimuovere un override ripristina il valore configurato; Nessun budget lo esclude.</p>
      <BudgetList
        key={state.session.profile.id}
        repository={state.repository}
        catalog={state.session.catalog}
        profileId={state.session.profile.id}
      />
    </>
  );
}

export function ProductBudget({
  repository, catalog, profileId, categoryId, price,
}: {
  repository: LocalRepository;
  catalog: CatalogSnapshot;
  profileId: string;
  categoryId: string | null;
  price: string;
}) {
  const data = useBudgets(repository);
  const budget = effectiveBudget(catalog, data.overrides ?? [], profileId, categoryId);
  const parsed = parsePrice(price);
  const difference = budget.amount === null || parsed === null || parsed === undefined
    ? null : Math.round((budget.amount - parsed) * 100) / 100;

  if (data.error) {
    return (
      <div role="alert">
        <p>Budget non disponibile.</p>
        <Button
          variant="secondary"
          onClick={data.retry}
        >Riprova
        </Button>
      </div>
    );
  }
  if (categoryId === null || data.overrides === null || budget.amount === null) {
    return null;
  }

  return (
    <aside
      className="product-budget"
      aria-label="Budget categoria"
    >
      <p>Budget categoria: <strong>{money(budget.amount)}</strong> · {budget.origin === "json" ? "Configurato" : "Personale"}</p>
      {difference !== null && <p>{difference < 0 ? `Oltre il budget di ${money(-difference)}` : `Differenza rispetto al budget: ${money(difference)}`}</p>}
    </aside>
  );
}
