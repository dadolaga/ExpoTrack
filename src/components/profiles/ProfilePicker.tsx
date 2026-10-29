"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";

import { useProfileSession } from "./ProfileProvider";
import { ProfileRow } from "./ProfileRow";

import type { ProfileSummary } from "@/types/profiles";

export function ProfilePicker() {
  const router = useRouter();
  const {
    state, selecting, selectionError, chooseProfile,
  } = useProfileSession();

  if (state.status !== "ready") {
    return null;
  }
  const session = state.session;
  const profiles: ProfileSummary[] = session.catalog.profiles.filter((profile) => profile.enabled);
  const groups = [
    {
      origin: "json",
      title: "Profili configurati",
      empty: "Nessun profilo configurato disponibile.",
    },
    {
      origin: "personal",
      title: "Profili personali",
      empty: "Non ci sono profili personali su questo dispositivo.",
    },
  ] as const;

  async function select(id: string) {
    if (await chooseProfile(id)) {
      router.replace("/");
    }
  }

  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-3 text-center">
        <Image
          src="/brand/expotrack-icon.png"
          alt=""
          width={112}
          height={112}
          loading="eager"
          className="mx-auto rounded-card"
        />
        <h1>Chi sta usando ExpoTrack?</h1>
        <p className="text-text-muted">Seleziona il tuo profilo per continuare.</p>
      </header>
      {session.invalidSelection && (
        <p role="status">
          Il profilo o l’evento ricordato non è più disponibile. Scegli un profilo per continuare:
          i dati già salvati restano sul dispositivo.
        </p>
      )}
      {groups.map((group) => {
        const entries = profiles.filter((profile) => profile.origin === group.origin);

        return (
          <section
            key={group.origin}
            aria-labelledby={`profiles-${group.origin}`}
            className="flex flex-col gap-3"
          >
            <h2 id={`profiles-${group.origin}`}>{group.title}</h2>
            {entries.length === 0 ? (
              <Card><p className="text-text-muted">{group.empty}</p></Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {entries.map((profile) => (
                  <li key={profile.id}>
                    <ProfileRow
                      profile={profile}
                      active={profile.id === session.profile?.id}
                      disabled={selecting}
                      onSelect={() => {
                        void select(profile.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {profiles.length === 0 && (
        <p className="text-text-muted">
          Non ci sono profili selezionabili. Quando sarà disponibile un profilo, potrai sceglierlo qui.
        </p>
      )}
      <p
        id="selection-progress"
        role="status"
        aria-atomic="true"
        className="text-label"
      >
        {selecting ? "Salvataggio della scelta sul dispositivo…" : selectionError}
      </p>
      <Card>
        <p className="text-label">La scelta verrà ricordata su questo dispositivo.</p>
        <p className="text-caption text-text-muted">Potrai cambiare profilo dalla sezione Profilo.</p>
      </Card>
      {session.profile !== null && (
        <Link
          href="/"
          className="self-start rounded-input p-3 text-primary underline"
        >
          Torna a Home
        </Link>
      )}
    </div>
  );
}
