"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/Button";

import { destinations, isDestinationActive } from "./navigation";

import type { ReactNode } from "react";

type TopBarProps = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
};

export function TopBar({
  title, subtitle = "ExpoTrack", onBack, actions,
}: TopBarProps) {
  const pathname = usePathname();
  const destination = destinations.find((item) => isDestinationActive(pathname, item.href));

  return (
    <header className="app-top-bar border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 p-page">
        {onBack !== undefined && (
          <Button
            variant="secondary"
            onClick={onBack}
          >
            Indietro
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-primary">{subtitle}</p>
          <h1>{title ?? destination?.label ?? "ExpoTrack"}</h1>
        </div>
        {actions}
      </div>
    </header>
  );
}
