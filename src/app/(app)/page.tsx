import { EmptyState } from "@/components/feedback/EmptyState";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <section aria-labelledby="visit-title">
      <Card>
        <h2 id="visit-title">La tua visita</h2>
        <EmptyState
          title="Nessuna visita da mostrare"
          description="Non hai ancora un profilo o un evento attivo. Qui troverai il riepilogo della visita quando saranno disponibili."
        />
      </Card>
    </section>
  );
}
