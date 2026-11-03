import { parseCatalogSnapshot } from "../config/parse-snapshot";
import { object } from "../config/validation";

import type { LocalRepository } from "./repository";
import type { ProfileSession } from "../../types/profiles";

export async function initializeServerCatalog(
  repository: LocalRepository,
  request: typeof fetch = fetch,
): Promise<ProfileSession> {
  const existing = await repository.getProfileSession();
  const hash = await repository.getServerCatalogHash();

  try {
    const response = await request("/api/v1/bootstrap", {
      cache: "no-store",
      headers: hash === null ? {} : {
        "If-None-Match": `"${hash}"`,
      },
      signal: AbortSignal.timeout(3500),
    });

    if (response.status === 304 && existing !== null) {
      return existing;
    }
    if (!response.ok) {
      throw new Error("Catalogo server non disponibile.");
    }
    const body = object(await response.json(), "bootstrap", [
      "schemaVersion", "configHash", "catalog",
    ]);

    if (body.schemaVersion !== 1 || typeof body.configHash !== "string"
      || !/^[a-f0-9]{64}$/.test(body.configHash)) {
      throw new Error("Bootstrap server non valido.");
    }
    const catalog = parseCatalogSnapshot(body.catalog);

    return await repository.initializeProfileSession(catalog, body.configHash);
  } catch (error) {
    if (existing !== null) {
      return existing;
    }

    throw error;
  }
}
