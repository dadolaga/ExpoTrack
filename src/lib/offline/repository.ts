import { validateReferences } from "../config/validate-references";

import { inTransaction, openLocalDatabase, readRequest } from "./database";
import { createLocalId } from "./identity";
import { parsePersonalStandPatch, validatePersonalStand } from "./personal-stand-input";
import {
  isProductDeleted,
  LocalInputError,
  nextProductData,
  parseProductPatch,
  sameProduct,
  sameStand,
  validateContext,
  validateIdentity,
  validateProduct,
} from "./product-input";
import { profileContextForSelection, resolveProfileSession } from "./profile-session";
import {
  profileDependencies, readSettings, withPersonalProfiles, writeBudget, writePersonalProfile,
} from "./profile-settings";
import { checkQuestionnaireInputs, validateQuestionnaireAnswers } from "./questionnaire-input";
import { applyStandPatch } from "./stand-input";

import type { LocalDatabaseOptions } from "./database";
import type { CatalogSnapshot, StandReference } from "../../types/catalog";
import type {
  LocalContext, LocalProduct, LocalPersonalStand, PersonalStandData, PersonalStandInput,
  VisitData, LocalStandPreferences, OutboxOperation, ProductInput, StandPreferencesData,
  StandPreferencesPatch,
} from "../../types/offline";
import type { ProfileSession } from "../../types/profiles";
import type { QuestionnaireInput } from "../../types/questionnaires";

type StoredCatalog = {
  id: string;
  data: CatalogSnapshot;
  createdAt: string;
};

type ActiveCatalog = {
  key: "active-catalog";
  snapshotId: string;
};

async function readConfiguredCatalog(transaction: IDBTransaction): Promise<CatalogSnapshot | null> {
  const active = await readRequest<ActiveCatalog | undefined>(
    transaction.objectStore("app_meta").get("active-catalog"),
  );

  if (active === undefined) {
    return null;
  }
  const stored = await readRequest<StoredCatalog | undefined>(
    transaction.objectStore("config_snapshots").get(active.snapshotId),
  );

  if (stored === undefined) {
    throw new Error("Snapshot locale attivo non disponibile: ricarica il catalogo.");
  }

  return stored.data;
}

async function readCatalog(transaction: IDBTransaction): Promise<CatalogSnapshot | null> {
  const catalog = await readConfiguredCatalog(transaction);

  return catalog === null ? null : withPersonalProfiles(transaction, catalog);
}

function activateCatalog(transaction: IDBTransaction, data: CatalogSnapshot, snapshotId: string) {
  transaction.objectStore("config_snapshots").add({
    id: snapshotId,
    data,
    createdAt: new Date().toISOString(),
  } satisfies StoredCatalog);
  transaction.objectStore("app_meta").put({
    key: "active-catalog",
    snapshotId,
  } satisfies ActiveCatalog);
}

async function writeStandPreferences(
  transaction: IDBTransaction,
  catalog: CatalogSnapshot,
  scope: LocalContext,
  identity: string,
  source: StandReference["source"],
  patch: StandPreferencesPatch,
  dependencies: string[],
): Promise<LocalStandPreferences> {
  const store = transaction.objectStore("stand_preferences");
  const previous = await readRequest<LocalStandPreferences | undefined>(store.get([
    scope.profileId, scope.eventId, source, identity,
  ]));

  const seed = source === "personal" ? undefined : catalog.interests.find((entry) => entry.profileId === scope.profileId
    && entry.standRef.eventId === scope.eventId && entry.standRef.standId === identity);
  const previousData: StandPreferencesData = {
    ...scope,
    standRef: {
      source,
      eventId: scope.eventId,
      standId: identity,
    },
    ...(previous?.interested === undefined ? {} : {
      interested: previous.interested,
    }),
    ...(previous?.priority === undefined ? {} : {
      priority: previous.priority,
    }),
    ...(previous?.visitStatus === undefined ? {} : {
      visitStatus: previous.visitStatus,
    }),
    ...(previous?.checklist === undefined ? {} : {
      checklist: previous.checklist,
    }),
    ...(previous?.checklistDone === undefined ? {} : {
      checklistDone: previous.checklistDone,
    }),
    ...(previous?.notes === undefined ? {} : {
      notes: previous.notes,
    }),
  };
  const payload = applyStandPatch(previousData, seed?.checklist ?? [], patch);

  if (previous !== undefined && JSON.stringify(payload) === JSON.stringify(previousData)) {
    return previous;
  }
  const operationId = createLocalId();
  const now = new Date().toISOString();
  const record: LocalStandPreferences = {
    ...previous,
    ...payload,
    localSequence: (previous?.localSequence ?? 0) + 1,
    serverRevision: previous?.serverRevision ?? null,
    latestOperationId: operationId,
    updatedAt: now,
  };

  store.put(record);
  transaction.objectStore("outbox").add({
    ...scope,
    operationId,
    entityType: "stand-preferences",
    entityId: JSON.stringify([payload.standRef.source, identity]),
    action: previous === undefined ? "create" : "update",
    localSequence: record.localSequence,
    baseRevision: record.serverRevision,
    dependsOn: [
      ...(previous === undefined ? [] : [previous.latestOperationId]),
      ...dependencies,
      ...profileDependencies(catalog, scope.profileId),
    ],
    payload,
    status: "pending",
    queuedAt: now,
  } satisfies OutboxOperation);

  return record;
}

async function writeProduct(
  transaction: IDBTransaction,
  scope: LocalContext,
  identity: string,
  patch: Partial<ProductInput>,
  copiedQuestionnaires: QuestionnaireInput[] = [],
): Promise<LocalProduct> {
  const catalog = await readCatalog(transaction);

  if (catalog === null) {
    throw new LocalInputError("Carica un catalogo valido prima di registrare dati personali.");
  }
  if (!catalog.profiles.some((profile) => profile.id === scope.profileId && profile.enabled)
    || !catalog.config.events.some((event) => event.id === scope.eventId && event.enabled)) {
    throw new LocalInputError("Seleziona un profilo e un evento disponibili.");
  }
  const store = transaction.objectStore("products");
  const previous = await readRequest<LocalProduct | undefined>(
    store.get([
      scope.profileId, scope.eventId, identity,
    ]),
  );

  if (isProductDeleted(previous)) {
    throw new LocalInputError("Il prodotto è stato eliminato.");
  }
  if (previous !== undefined && patch.plannedProductId !== undefined
    && patch.plannedProductId !== (previous.input.plannedProductId ?? null)) {
    throw new LocalInputError("Il collegamento al prodotto pianificato non è modificabile.");
  }
  if (typeof patch.plannedProductId === "string"
    && !catalog.plannedProducts.some((planned) => planned.id === patch.plannedProductId
      && planned.profileId === scope.profileId && planned.standRef.eventId === scope.eventId)) {
    throw new LocalInputError("Prodotto pianificato non disponibile in questo contesto.");
  }
  const input: ProductInput = {
    name: "",
    categoryId: null,
    standRef: null,
    description: "",
    ...previous?.input,
    ...patch,
  };
  const now = new Date().toISOString();
  const questionnaireInputs = input.questionnaireInputs ?? [];

  checkQuestionnaireInputs(
    questionnaireInputs,
    previous?.input.questionnaireInputs ?? copiedQuestionnaires,
    catalog,
    scope.profileId,
    input.categoryId,
  );
  const questionnaire = validateQuestionnaireAnswers(
    questionnaireInputs,
    previous?.lastValid?.questionnaireAnswers ?? [],
    input.categoryId,
  );
  const personal = input.standRef?.source === "personal"
    ? await readRequest<LocalPersonalStand | undefined>(transaction.objectStore("personal_stands")
      .get([
        scope.profileId, scope.eventId, input.standRef.standId,
      ])) : undefined;
  const issues = validateProduct(input, scope, catalog, personal?.lastValid ?? null);

  if (Object.keys(questionnaire.issues).length > 0) {
    issues.questionnaires = questionnaire.issues;
  }
  const candidate = nextProductData(previous, input, issues, scope, identity, now, questionnaire.answers);
  const lastValid = previous?.lastValid ?? null;
  const changed = candidate !== null && !sameProduct(lastValid, candidate);
  const operationId = changed ? createLocalId() : previous?.latestOperationId ?? null;
  const record: LocalProduct = {
    ...scope,
    id: identity,
    input,
    lastValid: changed ? candidate : lastValid,
    issues,
    localSequence: (previous?.localSequence ?? 0) + 1,
    serverRevision: previous?.serverRevision ?? null,
    latestOperationId: operationId,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };

  store.put(record);

  if (changed && operationId !== null) {
    transaction.objectStore("outbox").add({
      operationId,
      ...scope,
      entityType: "product",
      entityId: identity,
      action: lastValid === null ? "create" : "update",
      localSequence: record.localSequence,
      baseRevision: record.serverRevision,
      dependsOn: [
        ...profileDependencies(catalog, scope.profileId),
        previous?.latestOperationId,
        personal?.latestOperationId,
      ]
        .filter((dependency): dependency is string => typeof dependency === "string"),
      payload: candidate,
      status: "pending",
      queuedAt: now,
    } satisfies OutboxOperation);
  }

  return record;
}

export class LocalRepository {
  private readonly database: IDBDatabase;

  constructor(database: IDBDatabase) {
    this.database = database;
  }

  close(): void {
    this.database.close();
  }

  async saveCatalog(catalog: CatalogSnapshot, snapshotId: string = createLocalId()): Promise<void> {
    if (snapshotId.trim().length === 0) {
      throw new LocalInputError("Identificativo snapshot obbligatorio.");
    }
    const data = structuredClone(catalog);

    validateReferences(data);
    await inTransaction(this.database, ["config_snapshots", "app_meta"], "readwrite", (transaction) => {
      activateCatalog(transaction, data, snapshotId);
    });
  }

  async getCatalog(): Promise<CatalogSnapshot | null> {
    return inTransaction(this.database, ["config_snapshots", "app_meta"], "readonly", readCatalog);
  }

  async initializeProfileSession(catalog: CatalogSnapshot): Promise<ProfileSession> {
    const data = structuredClone(catalog);

    validateReferences(data);

    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const current = await readConfiguredCatalog(transaction);

      if (JSON.stringify(current) !== JSON.stringify(data)) {
        activateCatalog(transaction, data, createLocalId());
      }
      const stored = await readRequest<unknown>(transaction.objectStore("app_meta").get("active-context"));

      return resolveProfileSession(await withPersonalProfiles(transaction, data), stored);
    });
  }

  async getProfileSession(): Promise<ProfileSession | null> {
    return inTransaction(this.database, ["config_snapshots", "app_meta"], "readonly", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        return null;
      }
      const stored = await readRequest<unknown>(transaction.objectStore("app_meta").get("active-context"));

      return resolveProfileSession(catalog, stored);
    });
  }

  async selectProfile(profileId: string): Promise<ProfileSession> {
    // Sharing the write scope waits for previously started product/outbox commits.
    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        throw new LocalInputError("Carica un catalogo valido prima di scegliere il profilo.");
      }
      const store = transaction.objectStore("app_meta");
      const stored = await readRequest<unknown>(store.get("active-context"));
      const selected = {
        key: "active-context",
        ...profileContextForSelection(catalog, stored, profileId),
      };

      store.put(selected);

      return resolveProfileSession(catalog, selected);
    });
  }

  async selectEvent(eventId: string): Promise<ProfileSession> {
    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);
      const store = transaction.objectStore("app_meta");
      const stored = await readRequest<unknown>(store.get("active-context"));
      const session = catalog === null ? null : resolveProfileSession(catalog, stored);

      if (catalog === null || session?.profile === undefined || session.profile === null
        || !catalog.config.events.some((event) => event.id === eventId && event.enabled)) {
        throw new LocalInputError("Seleziona un profilo e un evento disponibili.");
      }
      const selected = {
        key: "active-context",
        profileId: session.profile.id,
        eventId,
      };

      store.put(selected);

      return resolveProfileSession(catalog, selected);
    });
  }

  async savePersonalProfile(id: string, input: {
    name: string;
    color: string;
  }): Promise<void> {
    await this.changePersonalProfile(validateIdentity(id), structuredClone(input));
  }

  async deletePersonalProfile(id: string): Promise<void> {
    await this.changePersonalProfile(validateIdentity(id), null);
  }

  private async changePersonalProfile(id: string, input: {
    name: string;
    color: string;
  } | null) {
    await inTransaction(this.database, [
      "config_snapshots", "app_meta", "products", "personal_stands", "stand_preferences", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        throw new LocalInputError("Catalogo non disponibile.");
      }
      await writePersonalProfile(transaction, catalog, id, input);
    });
  }

  async listBudgetOverrides() {
    return inTransaction(this.database, ["app_meta"], "readonly", async (transaction) => {
      return (await readSettings(transaction)).budgets;
    });
  }

  async setBudget(profileId: string, categoryId: string, amount: string | null | undefined) {
    await inTransaction(this.database, [
      "config_snapshots", "app_meta", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        throw new LocalInputError("Catalogo non disponibile.");
      }
      await writeBudget(transaction, catalog, profileId, categoryId, amount);
    });
  }

  async listPendingOperations(): Promise<OutboxOperation[]> {
    return inTransaction(this.database, ["outbox"], "readonly", (transaction) => {
      return readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());
    });
  }

  async getProduct(context: LocalContext, id: string): Promise<LocalProduct | undefined> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);

    return inTransaction(this.database, ["products"], "readonly", (transaction) => {
      return readRequest<LocalProduct | undefined>(
        transaction.objectStore("products").get([
          scope.profileId, scope.eventId, identity,
        ]),
      );
    });
  }

  async listStandPreferences(context: LocalContext): Promise<LocalStandPreferences[]> {
    const scope = validateContext(context);

    return inTransaction(this.database, ["stand_preferences"], "readonly", (transaction) => {
      return readRequest<LocalStandPreferences[]>(transaction.objectStore("stand_preferences")
        .index("by_context").getAll([scope.profileId, scope.eventId]));
    });
  }

  async setStandInterest(
    context: LocalContext,
    standId: string,
    interested: boolean,
    source: StandReference["source"] = "catalog",
  ): Promise<LocalStandPreferences> {
    return this.saveStandPreferences(context, standId, {
      interested,
    }, source);
  }

  async saveStandPreferences(
    context: LocalContext,
    standId: string,
    changes: StandPreferencesPatch,
    source: StandReference["source"] = "catalog",
  ): Promise<LocalStandPreferences> {
    const scope = validateContext(context);
    const identity = validateIdentity(standId);
    const patch = structuredClone(changes);

    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "personal_stands", "stand_preferences", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);
      const personal = source === "personal" ? await readRequest<LocalPersonalStand | undefined>(
        transaction.objectStore("personal_stands").get([
          scope.profileId, scope.eventId, identity,
        ]),
      ) : undefined;
      const available = source === "catalog"
        ? catalog?.stands.some((stand) => stand.id === identity && stand.eventId === scope.eventId) ?? false
        : personal?.lastValid?.deletedAt === null;

      if (catalog === null || !available
        || !catalog.profiles.some((profile) => profile.id === scope.profileId && profile.enabled)
        || !catalog.config.events.some((event) => event.id === scope.eventId && event.enabled)) {
        throw new LocalInputError("Seleziona un profilo, un evento e uno stand disponibili.");
      }

      return writeStandPreferences(
        transaction,
        catalog,
        scope,
        identity,
        source,
        patch,
        typeof personal?.latestOperationId !== "string" ? [] : [personal.latestOperationId],
      );
    });
  }

  async getVisitData(context: LocalContext): Promise<VisitData> {
    const scope = validateContext(context);
    const key = [scope.profileId, scope.eventId];

    return inTransaction(this.database, [
      "personal_stands", "stand_preferences", "products",
    ], "readonly", async (transaction) => {
      const personal = await readRequest<LocalPersonalStand[]>(
        transaction.objectStore("personal_stands").index("by_context").getAll(key),
      );
      const preferences = await readRequest<LocalStandPreferences[]>(
        transaction.objectStore("stand_preferences").index("by_context").getAll(key),
      );
      const products = await readRequest<LocalProduct[]>(
        transaction.objectStore("products").index("by_context").getAll(key),
      );

      return {
        preferences,
        personalStands: personal.flatMap((record) => record.lastValid !== null
          && record.lastValid.deletedAt === null ? [record.lastValid] : []),
        products: products.flatMap((record) => record.lastValid === null || isProductDeleted(record)
          ? [] : [record.lastValid]),
      };
    });
  }

  async getPersonalStand(context: LocalContext, id: string): Promise<LocalPersonalStand | undefined> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);

    return inTransaction(this.database, ["personal_stands"], "readonly", (transaction) => {
      return readRequest<LocalPersonalStand | undefined>(transaction.objectStore("personal_stands")
        .get([
          scope.profileId, scope.eventId, identity,
        ]));
    });
  }

  async savePersonalStand(
    context: LocalContext,
    id: string,
    changes: Partial<PersonalStandInput>,
  ): Promise<LocalPersonalStand> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);
    const patch = parsePersonalStandPatch(structuredClone(changes));

    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "personal_stands", "stand_preferences", "outbox",
    ], "readwrite", async (transaction) => {
      const catalog = await readCatalog(transaction);

      if (catalog === null) {
        throw new LocalInputError("Catalogo non disponibile.");
      }
      if (!catalog.profiles.some((profile) => profile.id === scope.profileId && profile.enabled)) {
        throw new LocalInputError("Profilo non disponibile.");
      }
      const store = transaction.objectStore("personal_stands");
      const previous = await readRequest<LocalPersonalStand | undefined>(store.get([
        scope.profileId, scope.eventId, identity,
      ]));

      if (typeof previous?.lastValid?.deletedAt === "string") {
        throw new LocalInputError("Lo stand è stato eliminato.");
      }
      const input: PersonalStandInput = {
        name: "",
        description: "",
        categoryIds: [],
        hall: null,
        booth: "",
        ...previous?.input,
        ...patch,
      };

      validatePersonalStand(input, scope, catalog);
      if (previous !== undefined && JSON.stringify(input) === JSON.stringify(previous.input)) {
        return previous;
      }
      const now = new Date().toISOString();
      const trimmedName = input.name.trim();
      const name = trimmedName.length > 0 ? trimmedName : previous?.lastValid?.name;
      const candidate: PersonalStandData | null = name === undefined ? null : {
        ...input,
        ...scope,
        name,
        id: identity,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      };
      const last = previous?.lastValid ?? null;
      const changed = candidate !== null && (candidate.name !== last?.name
        || candidate.description !== last.description || candidate.hall !== last.hall
        || candidate.booth !== last.booth
        || JSON.stringify(candidate.categoryIds) !== JSON.stringify(last.categoryIds));
      const operationId = changed ? createLocalId() : previous?.latestOperationId ?? null;
      const record: LocalPersonalStand = {
        ...scope,
        id: identity,
        input,
        lastValid: changed ? candidate : previous?.lastValid ?? null,
        localSequence: (previous?.localSequence ?? 0) + 1,
        serverRevision: previous?.serverRevision ?? null,
        latestOperationId: operationId,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };

      store.put(record);
      if (changed && operationId !== null) {
        transaction.objectStore("outbox").add({
          ...scope,
          operationId,
          entityType: "personal-stand",
          entityId: identity,
          action: last === null ? "create" : "update",
          localSequence: record.localSequence,
          baseRevision: record.serverRevision,
          dependsOn: [
            ...(typeof previous?.latestOperationId !== "string" ? [] : [previous.latestOperationId]),
            ...profileDependencies(catalog, scope.profileId),
          ],
          payload: candidate,
          status: "pending",
          queuedAt: now,
        } satisfies OutboxOperation);
        if (last === null) {
          await writeStandPreferences(transaction, catalog, scope, identity, "personal", {
            interested: true,
            visitStatus: "to_visit",
          }, [operationId]);
        }
      }

      return record;
    });
  }

  async deletePersonalStand(context: LocalContext, id: string): Promise<void> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);

    await inTransaction(this.database, [
      "personal_stands", "stand_preferences", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const store = transaction.objectStore("personal_stands");
      const key = [
        scope.profileId, scope.eventId, identity,
      ];
      const previous = await readRequest<LocalPersonalStand | undefined>(store.get(key));

      if (previous === undefined || typeof previous.lastValid?.deletedAt === "string") {
        return;
      }
      const standRef: StandReference = {
        source: "personal",
        eventId: scope.eventId,
        standId: identity,
      };
      const products = await readRequest<LocalProduct[]>(transaction.objectStore("products")
        .index("by_context").getAll([scope.profileId, scope.eventId]));

      const linkedProducts = products.filter((product) => sameStand(product.input.standRef, standRef)
        || (product.lastValid !== null && sameStand(product.lastValid.standRef, standRef)));

      if (linkedProducts.some((product) => !isProductDeleted(product))) {
        throw new LocalInputError("Questo stand ha prodotti collegati. Gestiscili prima di eliminare lo stand.");
      }
      const preferences = transaction.objectStore("stand_preferences");
      const preferenceKey = [
        scope.profileId, scope.eventId, "personal", identity,
      ];
      const preference = await readRequest<LocalStandPreferences | undefined>(preferences.get(preferenceKey));

      preferences.delete(preferenceKey);
      if (previous.lastValid === null) {
        store.delete(key);

        return;
      }
      const now = new Date().toISOString();
      const operationId = createLocalId();
      const payload: PersonalStandData = {
        ...previous.lastValid,
        deletedAt: now,
        updatedAt: now,
      };
      const record: LocalPersonalStand = {
        ...previous,
        lastValid: payload,
        localSequence: previous.localSequence + 1,
        latestOperationId: operationId,
        updatedAt: now,
      };

      store.put(record);
      transaction.objectStore("outbox").add({
        ...scope,
        operationId,
        entityType: "personal-stand",
        entityId: identity,
        action: "delete",
        localSequence: record.localSequence,
        baseRevision: record.serverRevision,
        dependsOn: [
          previous.latestOperationId,
          preference?.latestOperationId,
          ...linkedProducts.map((product) => product.latestOperationId),
        ]
          .filter((dependency): dependency is string => dependency !== null && dependency !== undefined),
        payload,
        status: "pending",
        queuedAt: now,
      } satisfies OutboxOperation);
    });
  }

  async listProducts(context: LocalContext): Promise<LocalProduct[]> {
    const scope = validateContext(context);

    return inTransaction(this.database, ["products"], "readonly", (transaction) => {
      return readRequest<LocalProduct[]>(transaction.objectStore("products")
        .index("by_context").getAll([scope.profileId, scope.eventId]));
    });
  }

  async listRegisteredProducts(context: LocalContext) {
    const records = await this.listProducts(context);

    return records.flatMap((record) => record.lastValid === null || isProductDeleted(record) ? [] : [record.lastValid]);
  }

  async listOutbox(context: LocalContext): Promise<OutboxOperation[]> {
    const scope = validateContext(context);
    const operations = await inTransaction(this.database, ["outbox"], "readonly", (transaction) => {
      return readRequest<OutboxOperation[]>(transaction.objectStore("outbox")
        .index("by_context").getAll([scope.profileId, scope.eventId]));
    });

    return operations.sort((first, second) => {
      const entityOrder = first.entityId.localeCompare(second.entityId);

      return entityOrder !== 0 ? entityOrder : first.localSequence - second.localSequence;
    });
  }

  async duplicateProduct(context: LocalContext, id: string): Promise<LocalProduct> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);

    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "personal_stands", "products", "outbox",
    ], "readwrite", async (transaction) => {
      const source = await readRequest<LocalProduct | undefined>(transaction.objectStore("products").get([
        scope.profileId, scope.eventId, identity,
      ]));
      const data = source?.lastValid;

      if (source === undefined || isProductDeleted(source) || data === undefined || data === null) {
        throw new LocalInputError("Puoi duplicare soltanto un prodotto registrato disponibile.");
      }

      // Explicitly copy editable data; identity, plan association and media never follow the source.
      const questionnaireInputs = structuredClone(data.questionnaireAnswers ?? []);

      return writeProduct(transaction, scope, createLocalId(), {
        name: data.name,
        categoryId: data.categoryId,
        standRef: data.standRef,
        description: data.description,
        price: data.price === undefined || data.price === null ? "" : String(data.price),
        rating: data.rating ?? null,
        favorite: data.favorite ?? false,
        questionnaireInputs,
      }, questionnaireInputs);
    });
  }

  async deleteProduct(context: LocalContext, id: string): Promise<void> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);

    await inTransaction(this.database, ["products", "outbox"], "readwrite", async (transaction) => {
      const store = transaction.objectStore("products");
      const previous = await readRequest<LocalProduct | undefined>(store.get([
        scope.profileId, scope.eventId, identity,
      ]));

      if (previous === undefined || isProductDeleted(previous)) {
        return;
      }
      const now = new Date().toISOString();
      const payload = previous.lastValid === null ? null : {
        ...previous.lastValid,
        deletedAt: now,
        updatedAt: now,
      };
      const operationId = payload === null ? null : createLocalId();
      const record: LocalProduct = {
        ...previous,
        deletedAt: now,
        updatedAt: now,
        lastValid: payload,
        localSequence: previous.localSequence + 1,
        latestOperationId: operationId,
      };

      store.put(record);
      if (operationId !== null && payload !== null) {
        transaction.objectStore("outbox").add({
          ...scope,
          operationId,
          entityType: "product",
          entityId: identity,
          action: "delete",
          localSequence: record.localSequence,
          baseRevision: record.serverRevision,
          dependsOn: previous.latestOperationId === null ? [] : [previous.latestOperationId],
          payload,
          status: "pending",
          queuedAt: now,
        } satisfies OutboxOperation);
      }
    });
  }

  async saveProduct(context: LocalContext, id: string, changes: Partial<ProductInput>): Promise<LocalProduct> {
    const scope = validateContext(context);
    const identity = validateIdentity(id);
    const patch = parseProductPatch(changes);

    return inTransaction(this.database, [
      "config_snapshots", "app_meta", "personal_stands", "products", "outbox",
    ], "readwrite", async (transaction) => {
      return writeProduct(transaction, scope, identity, patch);
    });
  }
}

export async function openLocalRepository(options: LocalDatabaseOptions = {}): Promise<LocalRepository> {
  return new LocalRepository(await openLocalDatabase(options));
}
