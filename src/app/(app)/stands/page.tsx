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
          title="Nessuno stand disponibile"
          description="Il catalogo dell’evento non è ancora disponibile. Qui potrai cercare gli stand e organizzare i tuoi interessi."
        />
      </Card>
    </section>
  );
}
