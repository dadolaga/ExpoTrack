import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  parseApp,
  parseCategories,
  parseInterests,
  parsePavilions,
  parseProfiles,
  parseStands,
} from "./parse-catalog";
import { parseQuestionnaires } from "./parse-questionnaires";
import { validateReferences } from "./validate-references";
import { ConfigValidationError } from "./validation";

import type { CatalogSnapshot } from "../../types/catalog";

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

// This module uses Node filesystem APIs. Keep it on the server or in CLI tools.
export async function loadCatalog(directory = path.join(process.cwd(), "config")): Promise<CatalogSnapshot> {
  let root: string;

  try {
    root = await realpath(directory);
  } catch {
    throw new ConfigValidationError(directory, "directory di configurazione non leggibile");
  }

  async function readJson(file: string, optional = false): Promise<unknown> {
    if (path.isAbsolute(file) || file.includes("\\") || file.split("/").some((part) => part === "..")
      || !file.endsWith(".json")) {
      throw new ConfigValidationError(file, "atteso un percorso JSON relativo alla directory di configurazione");
    }

    try {
      const resolved = await realpath(path.join(root, file));
      const relative = path.relative(root, resolved);

      if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
        throw new ConfigValidationError(file, "il file deve restare nella directory di configurazione");
      }
      const content = await readFile(resolved, "utf8");

      try {
        const parsed: unknown = JSON.parse(content);

        return parsed;
      } catch {
        throw new ConfigValidationError(file, "JSON non valido");
      }
    } catch (error) {
      if (optional && isMissing(error)) {
        return undefined;
      }
      if (error instanceof ConfigValidationError) {
        throw error;
      }

      throw new ConfigValidationError(file, "file mancante o non leggibile");
    }
  }

  const app = parseApp(await readJson("app.json"));
  const eventIds = new Set(app.events.map((event) => event.id));
  const [
    profileDocument, categoryDocument, pavilionDocument,
  ] = await Promise.all([
    readJson(app.configFiles.profiles),
    readJson(app.configFiles.categories),
    readJson(app.configFiles.pavilions),
  ]);
  const profiles = parseProfiles(profileDocument, app.configFiles.profiles);
  const categories = parseCategories(categoryDocument, app.configFiles.categories);
  const pavilions = parsePavilions(pavilionDocument, app.configFiles.pavilions);
  const standCatalogs = await Promise.all(app.events.map(async (event) => {
    return parseStands(await readJson(event.standsFile), event.id, event.standsFile);
  }));
  const seeds = await Promise.all(profiles.map(async (profile) => {
    const interestsFile = `interests/${profile.id}.json`;
    const questionsFile = `questionnaires/${profile.id}.json`;
    const [interestDocument, questionnaireDocument] = await Promise.all([
      readJson(interestsFile, true),
      readJson(questionsFile, true),
    ]);

    return {
      ...(interestDocument === undefined
        ? {
          interests: [],
          plannedProducts: [],
        }
        : parseInterests(interestDocument, profile.id, interestsFile, eventIds)),
      questionnaires: questionnaireDocument === undefined
        ? []
        : parseQuestionnaires(questionnaireDocument, profile.id, questionsFile),
    };
  }));
  const snapshot: CatalogSnapshot = {
    config: app,
    profiles,
    categories,
    pavilions,
    stands: standCatalogs.flat(),
    interests: seeds.flatMap((seed) => seed.interests),
    plannedProducts: seeds.flatMap((seed) => seed.plannedProducts),
    questionnaires: seeds.flatMap((seed) => seed.questionnaires),
  };

  validateReferences(snapshot);

  return snapshot;
}
