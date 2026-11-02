import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Card } from "@/components/ui/Card";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prodotti · ExpoTrack",
};

export default function ProductsPage() {
  return (
    <section aria-labelledby="products-title">
      <Card>
        <h2 id="products-title">La tua raccolta</h2>
        <EmptyState
          title="Raccolta prodotti non ancora disponibile"
          description="Qui ritroverai i prodotti pianificati e quelli raccolti durante la visita."
        />
      </Card>
      <Link
        href="/products/new"
        className="product-add-link"
      >+ Aggiungi prodotto
      </Link>
    </section>
  );
}
