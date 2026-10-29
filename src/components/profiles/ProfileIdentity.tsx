import { NavigationIcon } from "@/components/layout/NavigationIcon";

import type { ProfileSummary } from "@/types/profiles";
import type { ReactNode } from "react";

type ProfileIdentityProps = {
  profile: ProfileSummary;
  compact?: boolean;
  children?: ReactNode;
};

export function ProfileIdentity({ profile, compact = false, children }: ProfileIdentityProps) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-surface ${compact ? "size-9" : "size-touch"}`}
        style={{
          color: profile.color,
          borderColor: profile.color,
        }}
      >
        <NavigationIcon name="profile" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{profile.name}</span>
        {children}
      </span>
    </span>
  );
}
