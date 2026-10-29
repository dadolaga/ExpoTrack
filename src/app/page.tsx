import { ComponentPreview } from "@/components/examples/ComponentPreview";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-page">
      <Card>
        <p className="text-label font-medium text-primary">
          Fiere, esposizioni ed eventi
        </p>
        <h1 className="border-l-4 border-brand-accent pl-3">
          Expo<wbr />Track
        </h1>
        <p>
          Il punto di partenza per organizzare le tue visite e raccogliere le tue
          scoperte.
        </p>
        <p className="text-caption text-text-muted">
          Applicazione in fase di sviluppo.
        </p>
      </Card>
      <header className="flex flex-col gap-2">
        <h2>Componenti di base · Step 02</h2>
        <p className="text-text-muted">
          Pagina di verifica locale: le azioni provano soltanto l’interfaccia.
          Nessun dato viene salvato. Il tema segue le impostazioni di sistema.
        </p>
      </header>
      <ComponentPreview />
    </main>
  );
}
