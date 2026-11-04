import type { Category } from "../../types/catalog";

export function productCategories(categories: Category[], categoryIds?: readonly string[]): Category[] {
  if (categoryIds === undefined || categoryIds.length === 0) {
    return categories;
  }

  return categories.filter((category) => categoryIds.includes(category.id));
}
