"use client";

import { NavigationIcon } from "@/components/layout/NavigationIcon";

import type { ProfileSummary } from "@/types/profiles";

export function StandHeader({ profile, eventName }: {
  profile: ProfileSummary;
  eventName: string;
}) {
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
