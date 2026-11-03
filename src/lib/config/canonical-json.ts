// JSON object key order is irrelevant (PostgreSQL JSONB does not preserve it).
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      return Object.fromEntries(Object.entries(entry).sort(([first], [second]) => first.localeCompare(second)));
    }

    return entry;
  });
}
