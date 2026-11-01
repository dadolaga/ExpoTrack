"use client";

import { useId } from "react";

import { NavigationIcon } from "@/components/layout/NavigationIcon";

import type { ComponentProps } from "react";

type SelectFieldProps = ComponentProps<"select"> & {
  label: string;
  compact?: boolean;
};

export function SelectField({
  label, compact = false, id, className = "", children, ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={`relative flex min-w-0 flex-col gap-2 ${compact ? "stand-filter-select" : ""}`}>
      <label
        htmlFor={inputId}
        className={compact ? "sr-only" : "text-label font-medium"}
      >{label}
      </label>
      <select
        {...props}
        id={inputId}
        className={`min-h-touch w-full min-w-0 rounded-input border border-text-muted bg-surface px-3 py-3 text-label text-text ${className}`}
      >
        {children}
      </select>
      {compact && <span className="pointer-events-none absolute right-2 top-4"><NavigationIcon name="chevronDown" /></span>}
    </div>
  );
}
