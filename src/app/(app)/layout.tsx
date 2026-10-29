import { AppShell } from "@/components/layout/AppShell";
import { ProfileProvider } from "@/components/profiles/ProfileProvider";
import { loadCatalog } from "@/lib/config/load-catalog";

import type { CatalogSnapshot } from "@/types/catalog";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: {
  children: ReactNode;
}) {
  let catalog: CatalogSnapshot | null = null;

  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.error("Impossibile caricare il catalogo dei profili.", error);
  }

  return (
    <ProfileProvider catalog={catalog}>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  );
}
