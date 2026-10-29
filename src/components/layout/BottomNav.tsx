"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { destinations, isDestinationActive } from "./navigation";
import { NavigationIcon } from "./NavigationIcon";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className="app-bottom-nav border-t border-border bg-surface"
    >
      <ul className="mx-auto grid w-full max-w-2xl grid-cols-4 gap-1 px-2 py-2">
        {destinations.map((destination) => {
          const active = isDestinationActive(pathname, destination.href);
          const activeClasses = active
            ? "bg-primary font-medium text-on-primary"
            : "text-text-muted hover:bg-surface-muted hover:text-text";

          return (
            <li key={destination.href}>
              <Link
                href={destination.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-touch min-w-touch flex-col items-center justify-center gap-1 rounded-input px-1 py-2 text-center text-caption ${activeClasses}`}
              >
                <NavigationIcon name={destination.icon} />
                <span className="max-w-full">{destination.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
