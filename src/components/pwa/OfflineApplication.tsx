"use client";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { ProductEditor } from "@/components/products/ProductEditor";
import { ActiveProfile } from "@/components/profiles/ActiveProfile";
import { BudgetSettings } from "@/components/profiles/BudgetSettings";
import { ProfilePicker } from "@/components/profiles/ProfilePicker";
import { ProfileProvider } from "@/components/profiles/ProfileProvider";
import { ProfileSettings } from "@/components/profiles/ProfileSettings";
import { PersonalStandEditor } from "@/components/stands/PersonalStandEditor";
import { StandCatalog } from "@/components/stands/StandCatalog";
import { StandDetail } from "@/components/stands/StandDetail";
import { StandNotes } from "@/components/stands/StandNotes";
import { SyncPage } from "@/components/sync/SyncPage";
import { SyncProvider } from "@/components/sync/SyncProvider";
import Link, { OfflineNavigationProvider, usePathname } from "@/lib/navigation";

function Screen() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (pathname === "/" || pathname === "/offline") {
    return <Dashboard />;
  }
  if (pathname === "/profiles") {
    return <ProfilePicker />;
  }
  if (pathname === "/profile") {
    return <><ActiveProfile /><ProfileSettings /></>;
  }
  if (pathname === "/profile/budgets") {
    return <BudgetSettings />;
  }
  if (pathname === "/sync") {
    return <SyncPage />;
  }
  if (pathname === "/products") {
    return <ProductCatalog />;
  }
  if (parts[0] === "products" && parts.length === 2) {
    return (
      <ProductEditor
        key={parts[1]}
        productId={parts[1] === "new" ? undefined : parts[1]}
      />
    );
  }
  if (pathname === "/stands") {
    return <StandCatalog />;
  }
  if (pathname === "/stands/new") {
    return <PersonalStandEditor />;
  }
  if (parts[0] === "stands") {
    const personal = parts[1] === "personal";
    const id = parts.at(personal ? 2 : 1);
    const action = parts.at(personal ? 3 : 2);
    const source = personal ? "personal" : "catalog";

    if (id !== undefined) {
      if (action === "notes") {
        return (
          <StandNotes
            key={`${source}/${id}`}
            standId={id}
            source={source}
          />
        );
      }
      if (personal && action === "edit") {
        return (
          <PersonalStandEditor
            key={id}
            standId={id}
          />
        );
      }
      if (action === undefined) {
        return (
          <StandDetail
            key={`${source}/${id}`}
            standId={id}
            source={source}
          />
        );
      }
    }
  }

  return <p>Pagina non disponibile. <Link href="/">Apri Home</Link></p>;
}

export function OfflineApplication() {
  return (
    <OfflineNavigationProvider>
      <ProfileProvider>
        <SyncProvider><AppShell><Screen /></AppShell></SyncProvider>
      </ProfileProvider>
    </OfflineNavigationProvider>
  );
}
