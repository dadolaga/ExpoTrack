import { EmptyState } from "@/components/feedback/EmptyState";
import { Card } from "@/components/ui/Card";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stand · ExpoTrack",
};

export default function StandsPage() {
  return (
    <section aria-labelledby="stands-title">
      <Card>
        <h2 id="stands-title">Catalogo stand</h2>
        <EmptyState
          title="Elenco stand non ancora disponibile"
          description="Qui potrai cercare gli stand dell’evento e organizzare i tuoi interessi."
        />
      </Card>
    </section>
  );
}
