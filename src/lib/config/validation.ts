export class ConfigValidationError extends Error {
  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = "ConfigValidationError";
  }
}

type Parser<T> = (value: unknown, path: string) => T;
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function object(value: unknown, path: string, required: string[], optionalFields: string[] = []): JsonObject {
  if (!isObject(value)) {
    throw new ConfigValidationError(path, "atteso un oggetto");
  }

  const allowed = new Set([...required, ...optionalFields]);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new ConfigValidationError(`${path}.${key}`, "campo sconosciuto");
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      throw new ConfigValidationError(`${path}.${key}`, "campo obbligatorio mancante");
    }
  }

  return value;
}

export function document(value: unknown, path: string, fields: string[]) {
  const result = object(value, path, ["schemaVersion", ...fields]);

  if (result.schemaVersion !== 1) {
    throw new ConfigValidationError(`${path}.schemaVersion`, "versione non supportata: atteso 1");
  }

  return result;
}

export function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ConfigValidationError(path, "attesa una stringa non vuota");
  }

  return value;
}

export function freeText(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new ConfigValidationError(path, "atteso testo");
  }

  return value;
}

export function id(value: unknown, path: string): string {
  const result = text(value, path);

  if (!/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/.test(result)) {
    throw new ConfigValidationError(path, "ID non valido: usare 1–64 lettere minuscole, cifre, trattini o underscore");
  }

  return result;
}

export function slug(value: unknown, path: string): string {
  const result = id(value, path);

  if (result.includes("_")) {
    throw new ConfigValidationError(path, "lo slug non ammette underscore");
  }

  return result;
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new ConfigValidationError(path, "atteso un booleano");
  }

  return value;
}

export function number(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConfigValidationError(path, "atteso un numero finito");
  }

  return value;
}

export function integer(value: unknown, path: string): number {
  const result = number(value, path);

  if (!Number.isSafeInteger(result)) {
    throw new ConfigValidationError(path, "atteso un intero sicuro");
  }

  return result;
}

export function optional<T>(value: JsonObject, key: string, path: string, parse: Parser<T>) {
  return Object.hasOwn(value, key) ? parse(value[key], `${path}.${key}`) : undefined;
}

export function array<T>(value: unknown, path: string, parse: Parser<T>): T[] {
  if (!Array.isArray(value)) {
    throw new ConfigValidationError(path, "atteso un array");
  }

  return value.map((entry: unknown, index) => parse(entry, `${path}[${index}]`));
}

export function unique<T>(values: T[], path: string, key: (value: T) => string): T[] {
  const seen = new Set<string>();

  for (const [index, value] of values.entries()) {
    const identity = key(value);

    if (seen.has(identity)) {
      throw new ConfigValidationError(`${path}[${index}]`, `identificativo duplicato: ${identity}`);
    }
    seen.add(identity);
  }

  return values;
}

export function ids(value: unknown, path: string): string[] {
  return unique(array(value, path, slug), path, (entry) => entry);
}
