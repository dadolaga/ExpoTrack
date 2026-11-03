"use client";

import { usePathname, useRouter } from "next/navigation";

import { NavigationIcon } from "@/components/layout/NavigationIcon";
import { useProfileSession } from "@/components/profiles/ProfileProvider";
import { SyncIndicator } from "@/components/sync/SyncStatus";

import type { ProfileSummary } from "@/types/profiles";

export function StandHeader({
  profile, eventName, detail = false, dashboard = false,
}: {
  profile: ProfileSummary;
  eventName: string;
  detail?: boolean;
  dashboard?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { leave } = useProfileSession();
  const notes = pathname.endsWith("/notes");
  const editor = pathname.endsWith("/edit");

  if (detail) {
    return (
      <header className="app-top-bar stand-header">
        <div className="stand-detail-topbar">
          <button
            type="button"
            aria-label={notes || editor ? "Torna al dettaglio stand" : "Torna indietro"}
            onClick={() => {
              void leave(() => {
                const from = new URLSearchParams(window.location.search).get("from");
                const historyState = window.history.state as {
                  notesBackFallback?: boolean;
                } | null;

                if ((from === ((notes || editor) ? "detail" : "list") || from === "dashboard") && window.history.length > 1
                  && (!(notes || editor) || historyState?.notesBackFallback !== true)) {
                  router.back();
                } else {
                  router.replace(notes || editor ? pathname.slice(0, pathname.lastIndexOf("/")) : "/stands");
                }
              });
            }}
          ><NavigationIcon name="back" />
          </button>
          <p className="stand-wordmark">Expo<span>Track</span></p>
        </div>
      </header>
    );
  }

  function openFilters() {
    const summary = document.getElementById("stand-more-filters");

    summary?.closest("details")?.setAttribute("open", "");
    summary?.focus();
  }

  return (
    <header className="app-top-bar stand-header">
      <div className="stand-header-content">
        <div className="min-w-0 flex-1">
          <p
            className="stand-wordmark"
            aria-label="ExpoTrack"
          >Expo<span>Track</span>
          </p>
          <p className="stand-header-context">
            {eventName} · {" "}
            <span
              style={{
                borderColor: profile.color,
              }}
            >
              Profilo: {profile.name}
            </span>
          </p>
        </div>
        {dashboard ? (
          <SyncIndicator />
        ) : (
          <>
            <SyncIndicator />
            <button
              type="button"
              aria-label="Vai alla ricerca stand"
              onClick={() => {
                document.getElementById("stand-search")?.focus();
              }}
            ><NavigationIcon name="search" />
            </button>
            <button
              type="button"
              aria-label="Vai ai filtri stand"
              onClick={openFilters}
            ><NavigationIcon name="filters" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
