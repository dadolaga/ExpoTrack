import { parseQuestionnaireInputs } from "./questionnaire-input";

import type { CatalogSnapshot, StandReference } from "../../types/catalog";
import type {
  LocalContext, LocalProduct, PersonalStandData, ProductData, ProductInput, ProductIssues,
} from "../../types/offline";
import type { QuestionnaireAnswers } from "../../types/questionnaires";

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
      case "questionnaireInputs":
        result.questionnaireInputs = parseQuestionnaireInputs(field);
        break;
      case "name":
      case "description":
      case "price":
        if (typeof field !== "string") {
          throw new LocalInputError(`${key}: atteso testo.`);
        }
        result[key] = field;
        break;
      case "favorite":
        if (typeof field !== "boolean") {
          throw new LocalInputError("favorite: atteso un booleano.");
        }
        result.favorite = field;
        break;
      case "rating":
        if (field !== null && (typeof field !== "number" || !Number.isFinite(field))) {
          throw new LocalInputError("rating: atteso un numero o null.");
        }
        result.rating = field;
        break;
      case "plannedProductId":
      case "categoryId":
        if (field !== null && typeof field !== "string") {
          throw new LocalInputError("categoryId: atteso un ID o null.");
        }
        result[key] = field;
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

export function parsePrice(value: string): number | null | undefined {
  const text = value.trim();

  if (text === "") {
    return null;
  }
  const amount = Number(text.replace(",", "."));

  return /^\d+(?:[.,]\d{1,2})?$/u.test(text) && Number.isFinite(amount)
    && amount <= Number.MAX_SAFE_INTEGER / 100 ? amount : undefined;
}

export function validateProduct(
  input: ProductInput,
  context: LocalContext,
  catalog: CatalogSnapshot,
  personal: PersonalStandData | null = null,
): ProductIssues {
  const issues: ProductIssues = {};

  if (input.name.trim().length === 0) {
    issues.name = "Inserisci il nome del prodotto.";
  }
  if (!catalog.categories.some((category) => category.id === input.categoryId)) {
    issues.categoryId = "Seleziona una categoria disponibile.";
  }
  if (parsePrice(input.price ?? "") === undefined) {
    issues.price = "Inserisci un prezzo positivo o zero, con al massimo due decimali.";
  }
  if (input.rating !== undefined && input.rating !== null
    && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 10)) {
    issues.rating = "Scegli un voto da 1 a 10 oppure rimuovi la valutazione.";
  }
  const stand = input.standRef;

  const available = stand?.source === "personal"
    ? personal !== null && personal.id === stand.standId && personal.profileId === context.profileId
      && personal.eventId === context.eventId && personal.deletedAt === null
    : stand !== null && catalog.stands.some((entry) => entry.eventId === context.eventId
      && entry.id === stand.standId);

  if (stand?.eventId !== context.eventId || !available) {
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
  questionnaireAnswers: QuestionnaireAnswers[] = [],
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
    price: issues.price === undefined ? parsePrice(input.price ?? "") ?? null : lastValid?.price ?? null,
    rating: issues.rating === undefined ? input.rating ?? null : lastValid?.rating ?? null,
    favorite: input.favorite ?? false,
    plannedProductId: input.plannedProductId ?? null,
    questionnaireAnswers,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export function sameProduct(first: ProductData | null, second: ProductData): boolean {
  return first !== null && first.name === second.name && first.categoryId === second.categoryId
    && sameStand(first.standRef, second.standRef) && first.description === second.description
    && (first.price ?? null) === (second.price ?? null) && (first.rating ?? null) === (second.rating ?? null)
    && (first.favorite ?? false) === (second.favorite ?? false)
    && JSON.stringify(first.questionnaireAnswers ?? []) === JSON.stringify(second.questionnaireAnswers ?? [])
    && (first.plannedProductId ?? null) === (second.plannedProductId ?? null);
}

export function isProductDeleted(record: LocalProduct | undefined): boolean {
  return typeof record?.deletedAt === "string" || typeof record?.lastValid?.deletedAt === "string";
}

export function matchesPlannedProduct(record: Pick<LocalProduct, "id" | "input">, plannedId: string): boolean {
  return record.input.plannedProductId === plannedId || record.id === `planned:${plannedId}`;
}
