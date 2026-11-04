"use client";

import { Card } from "@/components/ui/Card";
import Link from "@/lib/navigation";

import { ProfileIdentity } from "./ProfileIdentity";
import { useProfileSession } from "./ProfileProvider";

export function ActiveProfile() {
  const { state } = useProfileSession();

  if (state.status !== "ready" || state.session.profile === null) {
    return null;
  }
  const { profile, event } = state.session;

  return (
    <section aria-labelledby="profile-title">
      <Card>
        <h2 id="profile-title">Profilo attivo</h2>
        <ProfileIdentity profile={profile}>
          <span className="block text-caption text-text-muted">
            {profile.origin === "json" ? "Profilo configurato · identità in sola lettura" : "Profilo personale"}
          </span>
        </ProfileIdentity>
        <p className="text-label">Evento: {event?.name}</p>
        <Link
          href="/profiles"
          className="inline-flex min-h-touch items-center self-start rounded-input border border-text-muted px-4 py-3 text-label font-medium"
        >
          Cambia profilo
        </Link>
      </Card>
    </section>
  );
}
