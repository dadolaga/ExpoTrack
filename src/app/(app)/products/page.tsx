import { ProductCatalog } from "@/components/products/ProductCatalog";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prodotti · ExpoTrack",
};

export default function ProductsPage() {
  return <ProductCatalog />;
}
