import {
  array,
  boolean,
  ConfigValidationError,
  document,
  freeText,
  id,
  ids,
  integer,
  number,
  object,
  optional,
  slug,
  text,
  unique,
} from "./validation";

import type {
  AppConfig,
  BudgetSeed,
  CatalogStand,
  Category,
  ConfiguredProfile,
  InterestSeed,
  Pavilion,
  PlannedProduct,
} from "../../types/catalog";

export function parseApp(value: unknown): AppConfig {
  const path = "app.json";
  const root = document(value, path, [
    "app", "configFiles", "events",
  ]);
  const app = object(root.app, `${path}.app`, [
    "name", "defaultLocale", "defaultEventId",
  ]);
  const files = object(root.configFiles, `${path}.configFiles`, [
    "profiles", "pavilions", "categories",
  ]);

  if (app.defaultLocale !== "it-IT") {
    throw new ConfigValidationError(`${path}.app.defaultLocale`, "lingua supportata: it-IT");
  }

  const events = unique(array(root.events, `${path}.events`, (entry, entryPath) => {
    const item = object(entry, entryPath, [
      "id", "name", "standsFile",
    ], ["enabled"]);

    return {
      id: slug(item.id, `${entryPath}.id`),
      name: text(item.name, `${entryPath}.name`),
      standsFile: text(item.standsFile, `${entryPath}.standsFile`),
      enabled: optional(item, "enabled", entryPath, boolean) ?? true,
    };
  }), `${path}.events`, (event) => event.id);
  const defaultEventId = slug(app.defaultEventId, `${path}.app.defaultEventId`);

  if (!events.some((event) => event.id === defaultEventId && event.enabled)) {
    throw new ConfigValidationError(`${path}.app.defaultEventId`, "deve riferirsi a un evento esistente e abilitato");
  }

  return {
    schemaVersion: 1,
    app: {
      name: text(app.name, `${path}.app.name`),
      defaultLocale: "it-IT",
      defaultEventId,
    },
    configFiles: {
      profiles: text(files.profiles, `${path}.configFiles.profiles`),
      pavilions: text(files.pavilions, `${path}.configFiles.pavilions`),
      categories: text(files.categories, `${path}.configFiles.categories`),
    },
    events,
  };
}

function parseBudget(value: unknown, path: string): BudgetSeed {
  const item = object(value, path, [
    "categoryId", "amount", "currency",
  ]);
  const amount = number(item.amount, `${path}.amount`);
  const cents = amount * 100;

  if (amount < 0 || !Number.isSafeInteger(Math.round(cents))
    || Math.round(cents) / 100 !== amount) {
    throw new ConfigValidationError(`${path}.amount`, "atteso importo non negativo con massimo due decimali");
  }
  if (item.currency !== "EUR") {
    throw new ConfigValidationError(`${path}.currency`, "valuta supportata: EUR");
  }

  return {
    categoryId: slug(item.categoryId, `${path}.categoryId`),
    amount,
    currency: "EUR",
  };
}

export function parseProfiles(value: unknown, path: string): ConfiguredProfile[] {
  const root = document(value, path, ["profiles"]);

  return unique(array(root.profiles, `${path}.profiles`, (entry, entryPath) => {
    const item = object(entry, entryPath, [
      "id", "name", "color", "icon", "enabled",
    ], ["budgets"]);
    const color = text(item.color, `${entryPath}.color`);

    if (!/^#[a-fA-F0-9]{6}$/.test(color)) {
      throw new ConfigValidationError(`${entryPath}.color`, "atteso colore #RRGGBB");
    }

    const budgets = optional(
      item,
      "budgets",
      entryPath,
      (entries, budgetPath) => array(entries, budgetPath, parseBudget),
    ) ?? [];

    return {
      id: slug(item.id, `${entryPath}.id`),
      origin: "json" as const,
      name: text(item.name, `${entryPath}.name`),
      color,
      icon: slug(item.icon, `${entryPath}.icon`),
      enabled: boolean(item.enabled, `${entryPath}.enabled`),
      budgets: unique(budgets, `${entryPath}.budgets`, (budget) => budget.categoryId),
    };
  }), `${path}.profiles`, (profile) => profile.id);
}

export function parseCategories(value: unknown, path: string): Category[] {
  const root = document(value, path, ["categories"]);

  return unique(array(root.categories, `${path}.categories`, (entry, entryPath) => {
    const item = object(entry, entryPath, ["id", "name"], ["parentId", "sortOrder"]);

    return {
      id: slug(item.id, `${entryPath}.id`),
      name: text(item.name, `${entryPath}.name`),
      parentId: optional(item, "parentId", entryPath, slug),
      sortOrder: optional(item, "sortOrder", entryPath, integer),
    };
  }), `${path}.categories`, (category) => category.id);
}

export function parsePavilions(value: unknown, path: string): Pavilion[] {
  const root = document(value, path, ["pavilions"]);

  return unique(array(root.pavilions, `${path}.pavilions`, (entry, entryPath) => {
    const item = object(entry, entryPath, [
      "eventId", "id", "name",
    ], [
      "code", "description", "sortOrder",
    ]);

    return {
      eventId: slug(item.eventId, `${entryPath}.eventId`),
      id: slug(item.id, `${entryPath}.id`),
      name: text(item.name, `${entryPath}.name`),
      code: optional(item, "code", entryPath, text),
      description: optional(item, "description", entryPath, freeText),
      sortOrder: optional(item, "sortOrder", entryPath, integer),
    };
  }), `${path}.pavilions`, (pavilion) => `${pavilion.eventId}:${pavilion.id}`);
}

export function parseStands(value: unknown, eventId: string, path: string): CatalogStand[] {
  const root = document(value, path, ["stands"]);

  return unique(array(root.stands, `${path}.stands`, (entry, entryPath) => {
    const item = object(entry, entryPath, [
      "id", "name", "categories",
    ], [
      "description", "hall", "booth",
    ]);

    return {
      id: slug(item.id, `${entryPath}.id`),
      eventId,
      name: text(item.name, `${entryPath}.name`),
      categoryIds: ids(item.categories, `${entryPath}.categories`),
      description: optional(item, "description", entryPath, freeText),
      hall: optional(item, "hall", entryPath, slug),
      booth: optional(item, "booth", entryPath, text),
    };
  }), `${path}.stands`, (stand) => stand.id);
}

export function parseInterests(value: unknown, profileId: string, path: string, eventIds: ReadonlySet<string>) {
  const root = document(value, path, ["profileId", "events"]);
  const interests: InterestSeed[] = [];
  const plannedProducts: PlannedProduct[] = [];

  if (root.profileId !== profileId) {
    throw new ConfigValidationError(`${path}.profileId`, `profilo atteso: ${profileId}`);
  }

  const events = array(root.events, `${path}.events`, (entry, entryPath) => {
    const item = object(entry, entryPath, ["eventId", "stands"]);
    const eventId = slug(item.eventId, `${entryPath}.eventId`);

    if (!eventIds.has(eventId)) {
      throw new ConfigValidationError(`${entryPath}.eventId`, `riferimento inesistente: ${eventId}`);
    }

    const stands = array(item.stands, `${entryPath}.stands`, (standEntry, standPath) => {
      const stand = object(standEntry, standPath, ["standId"], [
        "priority", "whatToSee", "plannedProducts",
      ]);
      const standRef = {
        source: "catalog" as const,
        eventId,
        standId: slug(stand.standId, `${standPath}.standId`),
      };
      const priority = optional(stand, "priority", standPath, integer);

      if (priority !== undefined && (priority < 1 || priority > 10)) {
        throw new ConfigValidationError(`${standPath}.priority`, "atteso intero da 1 a 10");
      }

      const checklist = optional(stand, "whatToSee", standPath, (entries, checklistPath) => {
        return unique(array(entries, checklistPath, (check, checkPath) => {
          const checkItem = object(check, checkPath, ["id", "text"]);

          return {
            id: id(checkItem.id, `${checkPath}.id`),
            text: text(checkItem.text, `${checkPath}.text`),
          };
        }), checklistPath, (check) => check.id);
      }) ?? [];

      interests.push({
        profileId,
        standRef,
        priority,
        checklist,
      });

      const planned = optional(stand, "plannedProducts", standPath, (entries, plannedPath) => {
        return array(entries, plannedPath, (productEntry, productPath): PlannedProduct => {
          const product = object(productEntry, productPath, [
            "id", "name", "categoryId",
          ], ["description"]);

          return {
            id: slug(product.id, `${productPath}.id`),
            profileId,
            standRef,
            name: text(product.name, `${productPath}.name`),
            categoryId: slug(product.categoryId, `${productPath}.categoryId`),
            description: optional(product, "description", productPath, freeText),
          };
        });
      }) ?? [];

      plannedProducts.push(...planned);

      return standRef;
    });

    unique(stands, `${entryPath}.stands`, (stand) => stand.standId);

    return eventId;
  });

  unique(events, `${path}.events`, (eventId) => eventId);
  unique(plannedProducts, `${path}.plannedProducts`, (product) => `${product.standRef.eventId}:${product.id}`);

  return {
    interests,
    plannedProducts,
  };
}
