import { LocalInputError } from "./product-input";

import type { CatalogSnapshot } from "../../types/catalog";
import type { LocalContext, PersonalStandInput } from "../../types/offline";

export function parsePersonalStandPatch(value: Partial<PersonalStandInput>): Partial<PersonalStandInput> {
  const result: Partial<PersonalStandInput> = {};

  if (Object.keys(value).length === 0) {
    throw new LocalInputError("Specificare una modifica dello stand.");
  }
  for (const [key, field] of Object.entries(value)) {
    switch (key) {
      case "name":
      case "description":
      case "booth":
        if (typeof field !== "string") {
          throw new LocalInputError("Atteso un testo per lo stand.");
        }
        result[key] = field;
        break;
      case "hall":
        if (field !== null && typeof field !== "string") {
          throw new LocalInputError("Padiglione non valido.");
        }
        result.hall = field;
        break;
      case "categoryIds":
        if (!Array.isArray(field) || field.some((id: unknown) => typeof id !== "string")) {
          throw new LocalInputError("Categorie non valide.");
        }
        result.categoryIds = [...new Set(field)];
        break;
      default:
        throw new LocalInputError("Campo stand non modificabile.");
    }
  }

  return result;
}

export function validatePersonalStand(
  input: PersonalStandInput,
  context: LocalContext,
  catalog: CatalogSnapshot,
) {
  if (!catalog.profiles.some((profile) => profile.id === context.profileId && profile.enabled)
    || !catalog.config.events.some((event) => event.id === context.eventId && event.enabled)) {
    throw new LocalInputError("Seleziona un profilo e un evento disponibili.");
  }
  if (input.categoryIds.some((id) => !catalog.categories.some((category) => category.id === id))) {
    throw new LocalInputError("Seleziona categorie disponibili.");
  }
  if (input.hall !== null && !catalog.pavilions.some((pavilion) => {
    return pavilion.id === input.hall && pavilion.eventId === context.eventId;
  })) {
    throw new LocalInputError("Seleziona un padiglione dell’evento attivo.");
  }
}
