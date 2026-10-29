import Link from "next/link";

import { ComponentPreview } from "@/components/examples/ComponentPreview";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Componenti di base · ExpoTrack",
};

export default function ComponentsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-page">
      <Link
        href="/"
        className="self-start rounded-input p-3 text-primary underline"
      >
        Torna a Home
      </Link>
      <header className="flex flex-col gap-2">
        <h1>Componenti di base</h1>
        <p className="text-text-muted">
          Pagina di verifica locale: le azioni provano soltanto l’interfaccia.
          Nessun dato di prova viene salvato.
        </p>
      </header>
      <ComponentPreview />
    </main>
  );
}
