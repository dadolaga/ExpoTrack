"use client";

import { useId } from "react";

import { StatusChip } from "@/components/ui/StatusChip";

import { ProfileIdentity } from "./ProfileIdentity";

import type { ProfileSummary } from "@/types/profiles";

type ProfileRowProps = {
  profile: ProfileSummary;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export function ProfileRow({
  profile, active, disabled, onSelect,
}: ProfileRowProps) {
  const id = useId();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-label={`Usa il profilo ${profile.name}`}
      aria-describedby={`${id}-origin selection-progress`}
      aria-current={active ? "true" : undefined}
      className="flex min-h-touch w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4 text-left enabled:hover:border-primary disabled:cursor-wait disabled:opacity-70"
    >
      <ProfileIdentity profile={profile}>
        <span
          id={`${id}-origin`}
          className="block text-caption text-text-muted"
        >
          {profile.origin === "json" ? "Configurato · identità in sola lettura" : "Profilo personale"}
        </span>
      </ProfileIdentity>
      {active ? <StatusChip>In uso</StatusChip> : <span aria-hidden="true">›</span>}
    </button>
  );
}
