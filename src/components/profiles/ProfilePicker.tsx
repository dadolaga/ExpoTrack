"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/Card";

import { PersonalProfileEditor } from "./PersonalProfileEditor";
import { useProfileSession } from "./ProfileProvider";
import { ProfileRow } from "./ProfileRow";

import type { ProfileSummary } from "@/types/profiles";

export function ProfilePicker() {
  const router = useRouter();
  const params = useSearchParams();
  const {
    state, selecting, selectionError, chooseProfile,
  } = useProfileSession();

  if (state.status !== "ready") {
    return null;
  }
  const session = state.session;
  const edit = params.get("edit");
  const managing = params.has("manage");

  if (edit !== null) {
    const profile = session.catalog.profiles.find((entry) => entry.id === edit && entry.enabled);

    if (edit !== "new" && profile === undefined) {
      return <Card><p>Profilo non disponibile.</p><Link href="/profiles?manage=1">Torna ai profili</Link></Card>;
    }
    if (profile?.origin === "json") {
      return <Card><h1>{profile.name}</h1><p>Nome e colore configurati sono in sola lettura.</p><Link href="/profiles?manage=1">Torna ai profili</Link></Card>;
    }

    return (
      <PersonalProfileEditor
        key={edit}
        repository={state.repository}
        profile={profile}
      />
    );
  }
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
        <h1>{managing ? "Gestione profili" : "Chi sta usando ExpoTrack?"}</h1>
        <p className="text-text-muted">{managing ? "Apri un profilo per consultarne i dettagli." : "Seleziona il tuo profilo per continuare."}</p>
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
                        if (managing) {
                          router.push(`/profiles?edit=${encodeURIComponent(profile.id)}`);
                        } else {
                          void select(profile.id);
                        }
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
          Non ci sono profili selezionabili. Aggiungi un profilo personale per iniziare.
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
      <Link
        href="/profiles?edit=new"
        className="profile-action-link"
      >+ Aggiungi profilo
      </Link>
      <Card>
        <p className="text-label">La scelta verrà ricordata su questo dispositivo.</p>
        <p className="text-caption text-text-muted">Potrai cambiare profilo dalla sezione Profilo.</p>
      </Card>
      {session.profile !== null && (
        <Link
          href={managing ? "/profile" : "/"}
          className="self-start rounded-input p-3 text-primary underline"
        >
          {managing ? "Torna a Profilo" : "Torna a Home"}
        </Link>
      )}
    </div>
  );
}
