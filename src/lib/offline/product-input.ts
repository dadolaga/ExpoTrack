import type { CatalogSnapshot, StandReference } from "../../types/catalog";
import type {
  LocalContext, LocalProduct, ProductData, ProductInput, ProductIssues,
} from "../../types/offline";

export class LocalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalInputError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateContext(context: LocalContext): LocalContext {
  if (!nonempty(context.profileId) || !nonempty(context.eventId)) {
    throw new LocalInputError("Profilo ed evento sono obbligatori per ogni accesso personale.");
  }

  return {
    profileId: context.profileId,
    eventId: context.eventId,
  };
}

export function validateIdentity(id: string): string {
  if (!nonempty(id)) {
    throw new LocalInputError("Identificativo prodotto obbligatorio.");
  }

  return id;
}

function parseStand(value: unknown): StandReference | null {
  if (value === null) {
    return null;
  }
  if (!isObject(value)
    || Object.keys(value).some((key) => ![
      "source", "eventId", "standId",
    ].includes(key))
    || (value.source !== "catalog" && value.source !== "personal")
    || !nonempty(value.eventId) || !nonempty(value.standId)) {
    throw new LocalInputError("Riferimento stand non valido.");
  }

  return {
    source: value.source,
    eventId: value.eventId,
    standId: value.standId,
  };
}

export function parseProductPatch(value: unknown): Partial<ProductInput> {
  if (!isObject(value)) {
    throw new LocalInputError("Le modifiche prodotto devono essere un oggetto.");
  }
  if (Object.keys(value).length === 0) {
    throw new LocalInputError("Specificare almeno una modifica intenzionale.");
  }
  const result: Partial<ProductInput> = {};

  for (const [key, field] of Object.entries(value)) {
    switch (key) {
      case "name":
      case "description":
        if (typeof field !== "string") {
          throw new LocalInputError(`${key}: atteso testo.`);
        }
        result[key] = field;
        break;
      case "categoryId":
        if (field !== null && typeof field !== "string") {
          throw new LocalInputError("categoryId: atteso un ID o null.");
        }
        result.categoryId = field;
        break;
      case "standRef":
        result.standRef = parseStand(field);
        break;
      default:
        throw new LocalInputError(`Campo prodotto non previsto: ${key}.`);
    }
  }

  return result;
}

export function sameStand(first: StandReference | null, second: StandReference): boolean {
  return first !== null && first.source === second.source
    && first.eventId === second.eventId && first.standId === second.standId;
}

export function validateProduct(input: ProductInput, context: LocalContext, catalog: CatalogSnapshot): ProductIssues {
  const issues: ProductIssues = {};

  if (input.name.trim().length === 0) {
    issues.name = "Inserisci il nome del prodotto.";
  }
  if (!catalog.categories.some((category) => category.id === input.categoryId)) {
    issues.categoryId = "Seleziona una categoria disponibile.";
  }
  const stand = input.standRef;

  if (stand?.eventId !== context.eventId || stand.source !== "catalog"
    || !catalog.stands.some((entry) => entry.eventId === context.eventId && entry.id === stand.standId)) {
    issues.standRef = "Seleziona uno stand disponibile per questo evento e profilo.";
  }

  return issues;
}

export function nextProductData(
  previous: LocalProduct | undefined,
  input: ProductInput,
  issues: ProductIssues,
  context: LocalContext,
  id: string,
  now: string,
): ProductData | null {
  const lastValid = previous?.lastValid ?? null;

  if (lastValid !== null
    && (input.categoryId !== lastValid.categoryId || !sameStand(input.standRef, lastValid.standRef))) {
    throw new LocalInputError("Categoria e stand sono bloccati dalla prima registrazione valida.");
  }
  const name = issues.name === undefined ? input.name.trim() : lastValid?.name;

  if (name === undefined || input.categoryId === null || input.standRef === null
    || issues.categoryId !== undefined || issues.standRef !== undefined) {
    return null;
  }

  return {
    ...context,
    id,
    name,
    categoryId: input.categoryId,
    standRef: input.standRef,
    description: input.description,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export function sameProduct(first: ProductData | null, second: ProductData): boolean {
  return first !== null && first.name === second.name && first.categoryId === second.categoryId
    && sameStand(first.standRef, second.standRef) && first.description === second.description;
}
