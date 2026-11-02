import { isProductDeleted, matchesPlannedProduct, parsePrice } from "../../lib/offline/product-input";
import { standKey } from "../stands/stand-list";

import type { CatalogSnapshot, StandReference } from "../../types/catalog";
import type { LocalContext, LocalProduct, PersonalStandData } from "../../types/offline";

export type ProductListItem = {
  id: string;
  plannedId: string | null;
  kind: "registered" | "planned";
  name: string;
  categoryId: string;
  categoryName: string;
  standRef: StandReference;
  standName: string;
  favorite: boolean;
  rating: number | null;
  price: number | null;
  createdAt: string | null;
  hasPhotos: boolean;
};

export type ProductFilters = {
  query: string;
  status: "all" | "registered" | "planned";
  favorites: boolean;
  category: string;
  stand: string;
  minRating: string;
  minPrice: string;
  maxPrice: string;
  photos: "all" | "with" | "without";
  sort: "recent" | "rating" | "name" | "stand" | "price" | "favorites";
};

export function defaultProductFilters(): ProductFilters {
  return {
    query: "",
    status: "all",
    favorites: false,
    category: "",
    stand: "",
    minRating: "",
    minPrice: "",
    maxPrice: "",
    photos: "all",
    sort: "recent",
  };
}

export function resolveProductList(
  catalog: CatalogSnapshot,
  context: LocalContext,
  records: LocalProduct[],
  personalStands: PersonalStandData[],
): ProductListItem[] {
  const own = records.filter((record) => record.profileId === context.profileId
    && record.eventId === context.eventId && !isProductDeleted(record));
  const registered = own.flatMap((record) => record.lastValid === null ? [] : [record.lastValid]);
  const planned = catalog.plannedProducts.filter((seed) => seed.profileId === context.profileId
    && seed.standRef.eventId === context.eventId && !own.some((record) => record.lastValid !== null
      && matchesPlannedProduct(record, seed.id)));

  function present(entry: {
    id: string;
    name: string;
    categoryId: string;
    standRef: StandReference;
    favorite?: boolean;
    rating?: number | null;
    price?: number | null;
    createdAt?: string;
  }, kind: ProductListItem["kind"]): ProductListItem {
    const stand = entry.standRef.source === "catalog"
      ? catalog.stands.find((item) => item.id === entry.standRef.standId && item.eventId === context.eventId)
      : personalStands.find((item) => item.id === entry.standRef.standId && item.profileId === context.profileId
        && item.eventId === context.eventId && item.deletedAt === null);

    return {
      id: entry.id,
      plannedId: kind === "planned" ? entry.id : null,
      kind,
      name: entry.name,
      categoryId: entry.categoryId,
      categoryName: catalog.categories.find((item) => item.id === entry.categoryId)?.name ?? "Categoria non disponibile",
      standRef: entry.standRef,
      standName: stand?.name ?? "Stand non disponibile",
      favorite: entry.favorite ?? false,
      rating: entry.rating ?? null,
      price: entry.price ?? null,
      createdAt: entry.createdAt ?? null,
      // No photo records exist before the photo workflow (step 17).
      hasPhotos: false,
    };
  }

  return [
    ...registered.map((entry) => present(entry, "registered")),
    ...planned.map((entry) => present(entry, "planned")),
  ];
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT");
}

export function productFilterIssues(filters: ProductFilters) {
  const min = parsePrice(filters.minPrice);
  const max = parsePrice(filters.maxPrice);
  const rating = filters.minRating === "" ? null : Number(filters.minRating);

  return {
    minPrice: min === undefined ? "Inserisci un importo valido, almeno zero." : undefined,
    maxPrice: max === undefined || (typeof min === "number" && typeof max === "number" && min > max)
      ? "Il massimo deve essere valido e non inferiore al minimo." : undefined,
    minRating: rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)
      ? "Inserisci un voto da 1 a 10." : undefined,
  };
}

export function filterProductList(items: ProductListItem[], filters: ProductFilters): ProductListItem[] {
  if (Object.values(productFilterIssues(filters)).some((issue) => issue !== undefined)) {
    return [];
  }
  const terms = normalize(filters.query).trim().split(/\s+/u).filter((term) => term !== "");
  const min = parsePrice(filters.minPrice);
  const max = parsePrice(filters.maxPrice);
  const rating = filters.minRating === "" ? null : Number(filters.minRating);
  const results = items.filter((item) => {
    const text = normalize(`${item.name} ${item.categoryName} ${item.standName}`);

    return terms.every((term) => text.includes(term))
      && (filters.status === "all" || item.kind === filters.status)
      && (!filters.favorites || item.favorite)
      && (filters.category === "" || item.categoryId === filters.category)
      && (filters.stand === "" || standKey(item.standRef.source, item.standRef.standId) === filters.stand)
      && (rating === null || (item.rating !== null && item.rating >= rating))
      && (typeof min !== "number" || (item.price !== null && item.price >= min))
      && (typeof max !== "number" || (item.price !== null && item.price <= max))
      && (filters.photos === "all" || item.hasPhotos === (filters.photos === "with"));
  });

  return results.sort((a, b) => {
    let order = 0;

    switch (filters.sort) {
      case "recent": order = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
        break;
      case "rating": order = (b.rating ?? -1) - (a.rating ?? -1);
        break;
      case "price": order = (b.price ?? -1) - (a.price ?? -1);
        break;
      case "favorites": order = Number(b.favorite) - Number(a.favorite);
        break;
      case "stand": order = a.standName.localeCompare(b.standName, "it");
        break;
      case "name": break;
    }

    if (order !== 0) {
      return order;
    }
    const nameOrder = a.name.localeCompare(b.name, "it");

    return nameOrder === 0 ? a.id.localeCompare(b.id) : nameOrder;
  });
}

export function productFiltersQuery(filters: ProductFilters, context: LocalContext): string {
  const params = new URLSearchParams({
    profile: context.profileId,
    event: context.eventId,
  });
  const defaults = defaultProductFilters();

  for (const key of Object.keys(defaults) as (keyof ProductFilters)[]) {
    if (filters[key] !== defaults[key]) {
      params.set(key, String(filters[key]));
    }
  }

  return params.toString();
}

export function readProductFilters(params: URLSearchParams, context: LocalContext): ProductFilters {
  const filters = defaultProductFilters();

  if (params.get("profile") !== context.profileId || params.get("event") !== context.eventId) {
    return filters;
  }
  const status = params.get("status");
  const photos = params.get("photos");
  const sort = params.get("sort");

  return {
    query: params.get("query") ?? "",
    status: status === "registered" || status === "planned" ? status : "all",
    favorites: params.get("favorites") === "true",
    category: params.get("category") ?? "",
    stand: params.get("stand") ?? "",
    minRating: params.get("minRating") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    photos: photos === "with" || photos === "without" ? photos : "all",
    sort: sort === "rating" || sort === "price" || sort === "name" || sort === "stand" || sort === "favorites"
      ? sort : "recent",
  };
}

export function productHref(product: Pick<ProductListItem, "id" | "plannedId">, returnHref: string) {
  const params = new URLSearchParams({
    return: returnHref,
  });

  if (product.plannedId !== null) {
    params.set("planned", product.plannedId);

    return `/products/new?${params}`;
  }

  return `/products/${encodeURIComponent(product.id)}?${params}`;
}
