import Link from "next/link";

import { NavigationIcon } from "@/components/layout/NavigationIcon";
import { standHref, visitLabels } from "@/features/stands/stand-list";

import type { StandListItem } from "@/features/stands/stand-list";

type StandRowProps = {
  stand: StandListItem;
  saving?: boolean;
  onInterestChange?: (interested: boolean) => void;
  origin?: "list" | "dashboard";
};

export function StandRow({
  stand, saving = false, onInterestChange, origin = "list",
}: StandRowProps) {
  let priorityTone = "neutral";

  if (stand.priority !== null && stand.priority >= 9) {
    priorityTone = "high";
  } else if (stand.priority !== null && stand.priority >= 7) {
    priorityTone = "medium";
  }

  return (
    <li className="stand-row">
      <span
        aria-hidden="true"
        className="stand-avatar"
      >{stand.name.slice(0, 2).toLocaleUpperCase("it-IT")}
      </span>
      <div className="stand-row-info">
        <h2>
          <Link
            href={`${standHref(stand)}?from=${origin}`}
            className="stand-row-link"
          >
            {stand.name}
          </Link>
        </h2>
        <p
          className="stand-row-categories"
          title={stand.categoryNames.join(" · ")}
        >{stand.categoryNames.join(" · ")}
        </p>
        <p>{stand.location}</p>
      </div>
      <div className="stand-row-meta">
        <span
          className="stand-priority"
          data-tone={priorityTone}
          aria-label={stand.priority === null ? "Priorità non impostata" : `Priorità ${stand.priority} su 10`}
        >
          {stand.priority === null ? "—" : `${stand.priority}/10`}
        </span>
        <span
          className="stand-visit-status"
          data-status={stand.visitStatus}
        >{visitLabels[stand.visitStatus]}
        </span>
      </div>
      {onInterestChange === undefined ? <span className="stand-row-chevron"><NavigationIcon name="back" /></span> : (
        <StandInterestButton
          name={stand.name}
          interested={stand.interested}
          saving={saving}
          onInterestChange={onInterestChange}
        />
      )}
    </li>
  );
}

export function StandInterestButton({
  name, interested, saving, onInterestChange,
}: {
  name: string;
  interested: boolean;
  saving: boolean;
  onInterestChange: (interested: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Interesse per ${name}`}
      aria-pressed={interested}
      aria-busy={saving}
      disabled={saving}
      onClick={() => {
        onInterestChange(!interested);
      }}
      className="stand-interest"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill={interested ? "currentColor" : "none"}
      >
        <path
          d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
