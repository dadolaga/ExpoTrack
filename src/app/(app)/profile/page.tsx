import { EmptyState } from "@/components/feedback/EmptyState";
import { ThemeSelector } from "@/components/forms/ThemeSelector";
import { Card } from "@/components/ui/Card";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profilo · ExpoTrack",
};

export default function ProfilePage() {
  return (
    <>
      <section aria-labelledby="profile-title">
        <Card>
          <h2 id="profile-title">Profilo attivo</h2>
          <EmptyState
            title="Nessun profilo selezionato"
            description="La selezione dei profili e dell’evento sarà disponibile quando verrà caricato il catalogo."
          />
        </Card>
      </section>
      <section aria-labelledby="appearance-title">
        <Card>
          <h2 id="appearance-title">Aspetto</h2>
          <ThemeSelector />
        </Card>
      </section>
    </>
  );
}
