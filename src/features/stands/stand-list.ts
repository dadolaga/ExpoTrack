import type { CatalogSnapshot, StandReference } from "../../types/catalog";
import type {
  LocalContext, LocalStandPreferences, PersonalStandData, ProductData, VisitStatus,
} from "../../types/offline";

export const visitLabels: Record<VisitStatus, string> = {
  to_visit: "Da visitare",
  visited: "Visitato",
  to_revisit: "Da rivedere",
};

export type StandListItem = {
  id: string;
  source: StandReference["source"];
  description: string;
  name: string;
  categoryIds: string[];
  categoryNames: string[];
  hall: string | null;
  location: string;
  interested: boolean;
  priority: number | null;
  visitStatus: VisitStatus;
  searchText: string;
};

export type StandFilters = {
  query: string;
  interest: "interested" | "all" | "excluded";
  status: VisitStatus | "";
  category: string;
  pavilion: string;
  priority: string;
  sort: "priority" | "name";
};

export function defaultStandFilters(): StandFilters {
  return {
    query: "",
    interest: "interested",
    status: "",
    category: "",
    pavilion: "",
    priority: "",
    sort: "priority",
  };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT");
}

export function resolveStandList(
  catalog: CatalogSnapshot,
  context: LocalContext,
  preferences: LocalStandPreferences[],
  personalStands: PersonalStandData[] = [],
): StandListItem[] {
  const overrides = new Map(preferences
    .filter((entry) => entry.profileId === context.profileId && entry.eventId === context.eventId
      && entry.standRef.eventId === context.eventId)
    .map((entry) => [standKey(entry.standRef.source, entry.standRef.standId), entry]));
  const seeds = new Map(catalog.interests
    .filter((seed) => seed.profileId === context.profileId && seed.standRef.eventId === context.eventId)
    .map((seed) => [standKey(seed.standRef.source, seed.standRef.standId), seed]));

  const stands = [
    ...catalog.stands.filter((stand) => stand.eventId === context.eventId)
      .map((stand) => ({
        ...stand,
        source: "catalog" as const,
      })),
    ...personalStands.filter((stand) => stand.profileId === context.profileId
      && stand.eventId === context.eventId && stand.deletedAt === null)
      .map((stand) => ({
        ...stand,
        hall: stand.hall ?? undefined,
        source: "personal" as const,
      })),
  ];

  return stands.map((stand) => {
    const key = standKey(stand.source, stand.id);
    const override = overrides.get(key);
    const seed = seeds.get(key);
    const pavilion = catalog.pavilions.find((entry) => {
      return entry.eventId === context.eventId && entry.id === stand.hall;
    });
    const categoryNames = stand.categoryIds.map((id) => {
      return catalog.categories.find((entry) => entry.id === id)?.name ?? id;
    });
    const hallLabel = pavilion?.code ?? pavilion?.name ?? stand.hall;
    const location = [hallLabel, stand.booth].filter((part) => part !== undefined).join(" · ");

    return {
      id: stand.id,
      source: stand.source,
      description: stand.description ?? "",
      name: stand.name,
      categoryIds: stand.categoryIds,
      categoryNames,
      hall: stand.hall ?? null,
      location: location.length > 0 ? location : "Posizione non disponibile",
      interested: override?.interested ?? (stand.source === "personal" || seeds.has(key)),
      priority: override?.priority === undefined ? seed?.priority ?? null : override.priority,
      visitStatus: override?.visitStatus ?? "to_visit",
      searchText: normalize([
        stand.name, ...categoryNames, pavilion?.name, pavilion?.code, stand.hall, stand.booth,
      ].join(" ")),
    };
  });
}

export function filterStandList(items: StandListItem[], filters: StandFilters): StandListItem[] {
  const terms = normalize(filters.query).trim().split(/\s+/u).filter((term) => term.length > 0);

  return items.filter((item) => {
    return (filters.interest === "all" || item.interested === (filters.interest === "interested"))
      && (filters.status === "" || item.visitStatus === filters.status)
      && (filters.category === "" || item.categoryIds.includes(filters.category))
      && (filters.pavilion === "" || (filters.pavilion === "missing" ? item.hall === null : item.hall === filters.pavilion))
      && (filters.priority === "" || (filters.priority === "none"
        ? item.priority === null : item.priority === Number(filters.priority)))
      && terms.every((term) => item.searchText.includes(term));
  }).sort((first, second) => {
    const priorityOrder = filters.sort === "priority" ? (second.priority ?? 0) - (first.priority ?? 0) : 0;
    const nameOrder = first.name.localeCompare(second.name, "it-IT");

    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    const idOrder = first.id.localeCompare(second.id);

    if (nameOrder !== 0) {
      return nameOrder;
    }

    return idOrder !== 0 ? idOrder : first.source.localeCompare(second.source);
  });
}

export function resolveStandDetail(
  catalog: CatalogSnapshot,
  context: LocalContext,
  standId: string,
  preferences: LocalStandPreferences[],
  products: ProductData[],
  personalStands: PersonalStandData[] = [],
  source: StandReference["source"] = "catalog",
) {
  const stand = resolveStandList(catalog, context, preferences, personalStands)
    .find((entry) => entry.id === standId && entry.source === source);

  if (stand === undefined) {
    return null;
  }
  const own = preferences.find((entry) => entry.profileId === context.profileId && entry.eventId === context.eventId
    && entry.standRef.source === source && entry.standRef.standId === standId);
  const seed = source === "personal" ? undefined : catalog.interests.find((entry) => entry.profileId === context.profileId
    && entry.standRef.eventId === context.eventId && entry.standRef.standId === standId);
  const checklist = (own?.checklist ?? seed?.checklist ?? []).map((item) => ({
    ...item,
    checked: own?.checklistDone?.[item.id] === true,
  }));

  return {
    ...stand,
    notes: own?.notes ?? "",
    checklist,
    completed: checklist.filter((item) => item.checked).length,
    planned: catalog.plannedProducts.filter((entry) => source === "catalog" && entry.profileId === context.profileId
      && entry.standRef.eventId === context.eventId && entry.standRef.standId === standId),
    registered: products.filter((entry) => entry.profileId === context.profileId && entry.eventId === context.eventId
      && entry.standRef.source === source && entry.standRef.standId === standId),
  };
}

export function readStandFilters(params: URLSearchParams, context: LocalContext): StandFilters {
  const defaults = defaultStandFilters();

  if (params.get("profile") !== context.profileId || params.get("event") !== context.eventId) {
    return defaults;
  }
  const interest = params.get("interest");
  const status = params.get("status");
  const priority = params.get("priority") ?? "";

  return {
    query: params.get("q") ?? "",
    interest: interest === "all" || interest === "excluded" ? interest : defaults.interest,
    status: status === "to_visit" || status === "visited" || status === "to_revisit" ? status : "",
    category: params.get("category") ?? "",
    pavilion: params.get("pavilion") ?? "",
    priority: /^(?:[1-9]|10|none)$/u.test(priority) ? priority : "",
    sort: params.get("sort") === "name" ? "name" : "priority",
  };
}

export function standFiltersQuery(filters: StandFilters, context: LocalContext): string {
  const params = new URLSearchParams({
    profile: context.profileId,
    event: context.eventId,
  });

  for (const [key, value] of Object.entries(filters)) {
    params.set(key === "query" ? "q" : key, value);
  }

  return params.toString();
}

export function standKey(source: StandReference["source"], id: string): string {
  return JSON.stringify([source, id]);
}

export function standHref(stand: Pick<StandListItem, "source" | "id">): string {
  return `/stands/${stand.source === "personal" ? "personal/" : ""}${encodeURIComponent(stand.id)}`;
}

export function countStandVisits(items: StandListItem[]): Record<VisitStatus, number> {
  const counts = {
    to_visit: 0,
    visited: 0,
    to_revisit: 0,
  };

  for (const stand of items) {
    counts[stand.visitStatus] += 1;
  }

  return counts;
}

export function selectDashboard(items: StandListItem[], products: ProductData[], context: LocalContext) {
  const interests = filterStandList(items, defaultStandFilters());

  return {
    counts: countStandVisits(interests),
    products: products.filter((product) => product.profileId === context.profileId
      && product.eventId === context.eventId).length,
    priorities: interests.filter((stand) => stand.priority !== null && stand.visitStatus !== "visited")
      .slice(0, 5),
  };
}
