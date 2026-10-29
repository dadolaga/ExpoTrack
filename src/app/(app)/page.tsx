import { EmptyState } from "@/components/feedback/EmptyState";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <section aria-labelledby="visit-title">
      <Card>
        <h2 id="visit-title">La tua visita</h2>
        <EmptyState
          title="Riepilogo non ancora disponibile"
          description="Qui ritroverai il riepilogo delle attività e dei prodotti della tua visita."
        />
      </Card>
    </section>
  );
}
