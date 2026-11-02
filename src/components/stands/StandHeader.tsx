"use client";

import { useRouter } from "next/navigation";

import { NavigationIcon } from "@/components/layout/NavigationIcon";

import type { ProfileSummary } from "@/types/profiles";

export function StandHeader({ profile, eventName, detail = false }: {
  profile: ProfileSummary;
  eventName: string;
  detail?: boolean;
}) {
  const router = useRouter();

  if (detail) {
    return (
      <header className="app-top-bar stand-header">
        <div className="stand-detail-topbar">
          <button
            type="button"
            aria-label="Torna alla lista stand"
            onClick={() => {
              if (new URLSearchParams(window.location.search).get("from") === "list" && window.history.length > 1) {
                router.back();
              } else {
                router.replace("/stands");
              }
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
      </div>
    </header>
  );
}
