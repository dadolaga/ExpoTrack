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
          title="Nessun prodotto da mostrare"
          description="Non ci sono prodotti disponibili. Qui ritroverai i prodotti pianificati e quelli raccolti durante la visita."
        />
      </Card>
    </section>
  );
}
