import { readRequest } from "./database";
import { createLocalId } from "./identity";
import { LocalInputError, parsePrice } from "./product-input";

import type { CatalogSnapshot } from "../../types/catalog";
import type { BudgetOverride, LocalPersonalProfile, OutboxOperation } from "../../types/offline";

type Settings = {
  key: "profile-settings";
  profiles: LocalPersonalProfile[];
  budgets: BudgetOverride[];
};

export async function readSettings(transaction: IDBTransaction): Promise<Settings> {
  return await readRequest<Settings | undefined>(transaction.objectStore("app_meta")
    .get("profile-settings")) ?? {
    key: "profile-settings",
    profiles: [],
    budgets: [],
  };
}

export async function withPersonalProfiles(transaction: IDBTransaction, catalog: CatalogSnapshot) {
  const settings = await readSettings(transaction);

  if (settings.profiles.some((profile) => catalog.profiles.some((seed) => seed.id === profile.id))) {
    throw new LocalInputError("Collisione fra un profilo configurato e uno personale: nessuna fusione eseguita.");
  }

  return {
    ...catalog,
    profiles: [...catalog.profiles, ...settings.profiles],
  };
}

export function profileDependencies(catalog: CatalogSnapshot, profileId: string): string[] {
  const profile = catalog.profiles.find((entry) => entry.id === profileId);

  return profile !== undefined && "latestOperationId" in profile
    && typeof profile.latestOperationId === "string" ? [profile.latestOperationId] : [];
}

export function effectiveBudget(
  catalog: CatalogSnapshot,
  overrides: BudgetOverride[],
  profileId: string,
  categoryId: string | null,
) {
  const override = overrides.find((entry) => entry.profileId === profileId
    && entry.categoryId === categoryId && !entry.removed);

  if (override !== undefined) {
    return {
      amount: override.amount,
      origin: "personal" as const,
    };
  }
  const seed = catalog.profiles.find((profile) => profile.id === profileId)
    ?.budgets.find((entry) => entry.categoryId === categoryId);

  return {
    amount: seed?.amount ?? null,
    origin: seed === undefined ? null : "json" as const,
  };
}

export async function writePersonalProfile(
  transaction: IDBTransaction,
  catalog: CatalogSnapshot,
  id: string,
  input: {
    name: string;
    color: string;
  } | null,
): Promise<void> {
  if (catalog.profiles.some((profile) => profile.id === id && profile.origin === "json")) {
    throw new LocalInputError("I profili configurati sono in sola lettura.");
  }
  const settings = await readSettings(transaction);
  const previous = settings.profiles.find((profile) => profile.id === id);

  if (previous?.deletedAt !== undefined && previous.deletedAt !== null) {
    throw new LocalInputError("Il profilo è stato eliminato.");
  }
  if (input === null && previous === undefined) {
    throw new LocalInputError("Profilo personale non disponibile.");
  }
  if (input !== null && (input.name.trim() === "" || !/^#[\da-f]{6}$/iu.test(input.color))) {
    throw new LocalInputError("Inserisci un nome e un colore valido (#RRGGBB).");
  }
  if (input !== null && previous?.name === input.name.trim() && previous.color === input.color) {
    return;
  }
  const operationId = createLocalId();
  const record: LocalPersonalProfile = {
    id,
    origin: "personal",
    name: input?.name.trim() ?? previous?.name ?? "",
    color: input?.color ?? previous?.color ?? "#0866E8",
    icon: "user-round",
    enabled: input !== null,
    budgets: [],
    deletedAt: input === null ? new Date().toISOString() : null,
    localSequence: (previous?.localSequence ?? 0) + 1,
    serverRevision: previous?.serverRevision ?? null,
    latestOperationId: operationId,
  };
  const operations = input === null
    ? await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll()) : [];
  const previousDependencies = previous === undefined ? [] : [previous.latestOperationId];
  const dependencies = input === null
    ? [
      ...new Set([
        ...previousDependencies, ...operations.filter((entry) => entry.profileId === id)
          .map((entry) => entry.operationId),
      ]),
    ] : previousDependencies;
  const mutation = previous === undefined ? "create" : "update";

  transaction.objectStore("app_meta").put({
    ...settings,
    profiles: [...settings.profiles.filter((profile) => profile.id !== id), record],
  } satisfies Settings);
  transaction.objectStore("outbox").add({
    operationId,
    profileId: id,
    entityType: "profile",
    entityId: id,
    action: input === null ? "delete" : mutation,
    localSequence: record.localSequence,
    baseRevision: record.serverRevision,
    dependsOn: dependencies,
    status: "pending",
    queuedAt: new Date().toISOString(),
    payload: record,
  } satisfies OutboxOperation);
  // Keep linked records and pending payloads intact until server acknowledgement/cleanup.
}

export async function writeBudget(
  transaction: IDBTransaction,
  catalog: CatalogSnapshot,
  profileId: string,
  categoryId: string,
  amount: string | null | undefined,
): Promise<void> {
  if (!catalog.profiles.some((profile) => profile.id === profileId && profile.enabled)
    || !catalog.categories.some((category) => category.id === categoryId)) {
    throw new LocalInputError("Profilo o categoria non disponibili.");
  }
  const parsed = typeof amount === "string" ? parsePrice(amount) : null;

  if (typeof amount === "string" && (parsed === undefined || parsed === null)) {
    throw new LocalInputError("Inserisci un importo non negativo, con al massimo due decimali.");
  }
  const settings = await readSettings(transaction);
  const previous = settings.budgets.find((entry) => entry.profileId === profileId
    && entry.categoryId === categoryId);
  const removed = amount === undefined;

  if ((previous === undefined && removed)
    || (previous !== undefined && previous.amount === parsed && previous.removed === removed)) {
    return;
  }
  const operationId = createLocalId();
  const record: BudgetOverride = {
    profileId,
    categoryId,
    amount: parsed ?? null,
    currency: "EUR",
    removed,
    localSequence: (previous?.localSequence ?? 0) + 1,
    serverRevision: previous?.serverRevision ?? null,
    latestOperationId: operationId,
  };

  const mutation = previous === undefined ? "create" : "update";

  transaction.objectStore("app_meta").put({
    ...settings,
    budgets: [...settings.budgets.filter((entry) => entry !== previous), record],
  } satisfies Settings);
  transaction.objectStore("outbox").add({
    operationId,
    profileId,
    entityType: "budget",
    entityId: categoryId,
    action: removed ? "delete" : mutation,
    localSequence: record.localSequence,
    baseRevision: record.serverRevision,
    dependsOn: [
      ...(previous === undefined ? [] : [previous.latestOperationId]),
      ...profileDependencies(catalog, profileId),
    ],
    status: "pending",
    queuedAt: new Date().toISOString(),
    payload: record,
  } satisfies OutboxOperation);
}
