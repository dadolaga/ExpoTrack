import { ConfigValidationError } from "./validation";

import type { CatalogSnapshot } from "../../types/catalog";

function reference(exists: boolean, path: string, identity: string) {
  if (!exists) {
    throw new ConfigValidationError(path, `riferimento inesistente: ${identity}`);
  }
}

export function validateReferences(snapshot: CatalogSnapshot): void {
  const events = new Set(snapshot.config.events.map((event) => event.id));
  const categories = new Map(snapshot.categories.map((category) => [category.id, category]));
  const pavilions = new Set(snapshot.pavilions.map((pavilion) => `${pavilion.eventId}:${pavilion.id}`));
  const stands = new Set(snapshot.stands.map((stand) => `${stand.eventId}:${stand.id}`));

  for (const [index, category] of snapshot.categories.entries()) {
    const path = `${snapshot.config.configFiles.categories}.categories[${index}].parentId`;
    const visited = new Set([category.id]);
    let parent = category.parentId;

    while (parent !== undefined) {
      reference(categories.has(parent), path, parent);

      if (visited.has(parent)) {
        throw new ConfigValidationError(path, `ciclo nella gerarchia: ${parent}`);
      }
      visited.add(parent);
      parent = categories.get(parent)?.parentId;
    }
  }
  for (const [index, pavilion] of snapshot.pavilions.entries()) {
    reference(
      events.has(pavilion.eventId),
      `${snapshot.config.configFiles.pavilions}.pavilions[${index}].eventId`,
      pavilion.eventId,
    );
  }
  for (const stand of snapshot.stands) {
    const file = snapshot.config.events.find((event) => event.id === stand.eventId)?.standsFile;
    const path = `${file ?? "stands"} (stand ${stand.id})`;

    for (const categoryId of stand.categoryIds) {
      reference(categories.has(categoryId), `${path}.categories`, categoryId);
    }
    if (stand.hall !== undefined) {
      reference(pavilions.has(`${stand.eventId}:${stand.hall}`), `${path}.hall`, stand.hall);
    }
  }
  for (const profile of snapshot.profiles) {
    for (const budget of profile.budgets) {
      reference(
        categories.has(budget.categoryId),
        `${snapshot.config.configFiles.profiles} (profilo ${profile.id}).budgets.categoryId`,
        budget.categoryId,
      );
    }
  }
  for (const interest of snapshot.interests) {
    const { eventId, standId } = interest.standRef;
    const path = `interests/${interest.profileId}.json (evento ${eventId}, stand ${standId})`;

    reference(events.has(eventId), `${path}.eventId`, eventId);
    reference(stands.has(`${eventId}:${standId}`), `${path}.standId`, standId);
  }
  for (const product of snapshot.plannedProducts) {
    reference(
      categories.has(product.categoryId),
      `interests/${product.profileId}.json (pianificato ${product.id}).categoryId`,
      product.categoryId,
    );
  }
  for (const questionnaire of snapshot.questionnaires) {
    reference(
      categories.has(questionnaire.categoryId),
      `questionnaires/${questionnaire.profileId}.json (questionario ${questionnaire.id}).categoryId`,
      questionnaire.categoryId,
    );
  }
}
