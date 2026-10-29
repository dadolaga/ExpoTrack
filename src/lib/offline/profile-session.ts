import { LocalInputError } from "./product-input";

import type { CatalogSnapshot } from "../../types/catalog";
import type { LocalContext } from "../../types/offline";
import type { ProfileSession } from "../../types/profiles";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveProfileSession(catalog: CatalogSnapshot, stored: unknown): ProfileSession {
  const profile = isObject(stored)
    ? catalog.profiles.find((entry) => entry.id === stored.profileId && entry.enabled) ?? null
    : null;
  const event = isObject(stored)
    ? catalog.config.events.find((entry) => entry.id === stored.eventId && entry.enabled) ?? null
    : null;
  const valid = profile !== null && event !== null;

  return {
    catalog,
    context: valid ? {
      profileId: profile.id,
      eventId: event.id,
    } : null,
    profile: valid ? profile : null,
    event: valid ? event : null,
    invalidSelection: stored !== undefined && !valid,
  };
}

export function profileContextForSelection(catalog: CatalogSnapshot, stored: unknown, profileId: string): LocalContext {
  const profile = catalog.profiles.find((entry) => entry.id === profileId && entry.enabled);

  if (profile === undefined) {
    throw new LocalInputError("Il profilo scelto non è più disponibile. Scegline un altro.");
  }
  const storedEventId = isObject(stored) ? stored.eventId : undefined;
  const event = catalog.config.events.find((entry) => entry.id === storedEventId && entry.enabled)
    ?? catalog.config.events.find((entry) => entry.id === catalog.config.app.defaultEventId && entry.enabled);

  if (event === undefined) {
    throw new LocalInputError("Nessun evento disponibile per la selezione del profilo.");
  }

  return {
    profileId: profile.id,
    eventId: event.id,
  };
}
