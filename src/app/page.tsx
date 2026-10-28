export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-page">
      <div className="w-full max-w-xl rounded-card border border-border bg-surface p-section">
        <p className="mb-3 text-label font-medium text-primary">
          Fiere, esposizioni ed eventi
        </p>
        <h1 className="border-l-4 border-brand-accent pl-3">
          Expo<wbr />Track
        </h1>
        <p className="mt-4 text-body">
          Il punto di partenza per organizzare le tue visite e raccogliere le tue
          scoperte.
        </p>
        <p className="mt-6 border-t border-border pt-4 text-caption text-text-muted">
          Applicazione in fase di sviluppo.
        </p>
      </div>
    </main>
  );
}
