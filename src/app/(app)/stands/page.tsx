import { Suspense } from "react";

import { StandCatalog } from "@/components/stands/StandCatalog";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stand · ExpoTrack",
};

export default function StandsPage() {
  return (
    <section
      aria-label="Catalogo stand"
    >
      <Suspense fallback={<p role="status">Caricamento degli stand…</p>}>
        <StandCatalog />
      </Suspense>
    </section>
  );
}
