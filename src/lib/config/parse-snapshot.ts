import {
  parseApp, parseCategories, parseInterests, parsePavilions, parseProfiles, parseStands,
} from "./parse-catalog";
import { parseQuestionnaires } from "./parse-questionnaires";
import { validateReferences } from "./validate-references";
import {
  array, ConfigValidationError, object, slug, unique,
} from "./validation";

import type { CatalogSnapshot } from "../../types/catalog";

// Reuse the file contracts at the HTTP boundary instead of trusting a TypeScript cast.
export function parseCatalogSnapshot(value: unknown): CatalogSnapshot {
  const root = object(value, "catalog", [
    "config",
    "profiles",
    "categories",
    "pavilions",
    "stands",
    "interests",
    "plannedProducts",
    "questionnaires",
  ]);
  const config = parseApp(root.config);
  const eventIds = new Set(config.events.map((event) => event.id));
  const profiles = parseProfiles({
    schemaVersion: 1,
    profiles: array(root.profiles, "profiles", (entry, entryPath) => {
      const profile = object(entry, entryPath, [
        "id", "origin", "name", "color", "icon", "enabled", "budgets",
      ]);
      const { origin, ...fields } = profile;

      if (origin !== "json") {
        throw new ConfigValidationError(entryPath, "atteso un profilo configurato");
      }

      return fields;
    }),
  }, "profiles");
  const categories = parseCategories({
    schemaVersion: 1,
    categories: root.categories,
  }, "categories");
  const pavilions = parsePavilions({
    schemaVersion: 1,
    pavilions: root.pavilions,
  }, "pavilions");
  const stands = unique(array(root.stands, "stands", (entry, entryPath) => {
    const stand = object(entry, entryPath, [
      "id", "eventId", "name", "categoryIds",
    ], [
      "description", "hall", "booth",
    ]);
    const { eventId, categoryIds, ...fields } = stand;

    if (!eventIds.has(slug(eventId, `${entryPath}.eventId`))) {
      throw new ConfigValidationError(entryPath, "evento inesistente");
    }

    return parseStands({
      schemaVersion: 1,
      stands: [
        {
          ...fields,
          categories: categoryIds,
        },
      ],
    }, slug(eventId, `${entryPath}.eventId`), entryPath)[0];
  }), "stands", (stand) => `${stand.eventId}:${stand.id}`);
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const scoped = (entry: unknown, entryPath: string, fields: string[], optional: string[] = []) => {
    const record = object(entry, entryPath, ["profileId", ...fields], optional);

    if (!profileIds.has(slug(record.profileId, `${entryPath}.profileId`))) {
      throw new ConfigValidationError(entryPath, "profilo inesistente");
    }

    return record;
  };
  const interests = array(root.interests, "interests", (entry, entryPath) => scoped(entry, entryPath, ["standRef", "checklist"], ["priority"]));
  const planned = array(root.plannedProducts, "plannedProducts", (entry, entryPath) => scoped(entry, entryPath, [
    "id", "standRef", "name", "categoryId",
  ], ["description"]));
  const reference = (entry: Record<string, unknown>) => {
    const ref = object(entry.standRef, "standRef", [
      "source", "eventId", "standId",
    ]);

    if (ref.source !== "catalog" || !eventIds.has(slug(ref.eventId, "standRef.eventId"))) {
      throw new ConfigValidationError("standRef", "riferimento catalogo non valido");
    }
    slug(ref.standId, "standRef.standId");

    return ref;
  };
  const seed = interests.map((entry) => {
    const ref = reference(entry);
    const matching = planned.filter((product) => {
      const productRef = reference(product);

      return product.profileId === entry.profileId && productRef.eventId === ref.eventId
        && productRef.standId === ref.standId;
    });

    return parseInterests({
      schemaVersion: 1,
      profileId: entry.profileId,
      events: [
        {
          eventId: ref.eventId,
          stands: [
            {
              standId: ref.standId,
              ...(entry.priority === undefined ? {} : {
                priority: entry.priority,
              }),
              whatToSee: entry.checklist,
              plannedProducts: matching.map((product) => {
                const { profileId: _profileId, standRef: _standRef, ...fields } = product;

                return fields;
              }),
            },
          ],
        },
      ],
    }, String(entry.profileId), "interests", eventIds);
  });
  const questions = array(root.questionnaires, "questionnaires", (entry, entryPath) => {
    const { profileId, ...definition } = scoped(entry, entryPath, [
      "id", "categoryId", "version", "title", "questions",
    ], ["description"]);

    return parseQuestionnaires({
      schemaVersion: 1,
      profileId,
      questionnaires: [definition],
    }, String(profileId), entryPath)[0];
  });
  const snapshot: CatalogSnapshot = {
    config,
    profiles,
    categories,
    pavilions,
    stands,
    interests: seed.flatMap((entry) => entry.interests),
    plannedProducts: seed.flatMap((entry) => entry.plannedProducts),
    questionnaires: questions,
  };

  unique(snapshot.interests, "interests", (entry) =>
    `${entry.profileId}:${entry.standRef.eventId}:${entry.standRef.standId}`);
  unique(snapshot.plannedProducts, "plannedProducts", (entry) =>
    `${entry.profileId}:${entry.standRef.eventId}:${entry.id}`);
  unique(questions, "questionnaires", (entry) => `${entry.profileId}:${entry.id}`);
  unique(questions, "questionnaires", (entry) => `${entry.profileId}:${entry.categoryId}`);

  if (snapshot.plannedProducts.length !== planned.length) {
    throw new ConfigValidationError("plannedProducts", "riferimento interesse assente o duplicato");
  }
  validateReferences(snapshot);

  return snapshot;
}
