"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ProfileIdentity } from "@/components/profiles/ProfileIdentity";
import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { StandHeader } from "@/components/stands/StandHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, retry } = useProfileSession();
  const missingProfile = state.status === "ready" && state.session.profile === null;

  useEffect(() => {
    if (missingProfile && pathname !== "/profiles") {
      router.replace("/profiles");
    }
  }, [
    missingProfile, pathname, router,
  ]);

  if (state.status !== "ready" || (missingProfile && pathname !== "/profiles")) {
    return (
      <main className="profile-selection mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-section">
        <Card>
          <h1>{state.status === "error" ? "Profili non disponibili" : "Preparazione di ExpoTrack"}</h1>
          <p role="status">
            {state.status === "error" ? state.message : "Caricamento dei profili sul dispositivo…"}
          </p>
          {state.status === "error" && <Button onClick={retry}>Riprova</Button>}
        </Card>
      </main>
    );
  }

  if (pathname === "/profiles") {
    return (
      <main className="profile-selection mx-auto min-h-dvh w-full max-w-2xl">
        {children}
      </main>
    );
  }
  const { profile, event } = state.session;
  const productEditor = pathname === "/products" || pathname.startsWith("/products/");

  return (
    <div
      className="app-shell"
      data-editor={productEditor ? "product" : undefined}
      data-section={pathname.startsWith("/stands") || pathname === "/" ? "stands" : undefined}
    >
      <a
        href="#main-content"
        className="skip-link rounded-input bg-primary p-3 font-medium text-on-primary"
      >
        Vai al contenuto
      </a>
      {!productEditor && ((pathname.startsWith("/stands") || pathname === "/") && profile !== null ? (
        <StandHeader
          profile={profile}
          eventName={event?.name ?? ""}
          detail={pathname.startsWith("/stands/")}
          dashboard={pathname === "/"}
        />
      ) : (
        <TopBar
          context={profile === null ? null : (
            <ProfileIdentity
              profile={profile}
              compact
            >
              <span className="block text-caption text-text-muted">{event?.name}</span>
            </ProfileIdentity>
          )}
        />
      ))}
      <main
        id="main-content"
        tabIndex={-1}
        className="app-main"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-section p-page">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
