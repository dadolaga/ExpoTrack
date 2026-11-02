"use client";

import { useId } from "react";

import type { ComponentProps } from "react";

type TextFieldProps = Omit<ComponentProps<"input">, "children" | "type"> & {
  label: string;
  labelClassName?: string;
  requiredIndicator?: "text" | "asterisk";
  hint?: string;
  error?: string;
  type?: "text" | "email" | "password" | "search" | "tel" | "url" | "number";
};

export function TextField({
  label,
  labelClassName = "",
  requiredIndicator = "text",
  hint,
  error,
  id,
  type = "text",
  className = "",
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasHint = hint !== undefined && hint.length > 0;
  const hasError = error !== undefined && error.length > 0;
  const descriptionIds = [
    describedBy,
    hasHint ? `${inputId}-hint` : undefined,
    hasError ? `${inputId}-error` : undefined,
  ].filter(Boolean).join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label
        htmlFor={inputId}
        className={`text-label font-medium ${labelClassName}`}
      >
        {label}
        {props.required === true && (requiredIndicator === "asterisk" ? (
          <span>
            <span
              aria-hidden="true"
              className="text-danger"
            > *
            </span>
            <span className="sr-only"> (obbligatorio)</span>
          </span>
        ) : " (obbligatorio)")}
      </label>
      {hasHint && (
        <p
          id={`${inputId}-hint`}
          className="text-caption text-text-muted"
        >
          {hint}
        </p>
      )}
      <input
        {...props}
        id={inputId}
        type={type}
        aria-invalid={hasError ? true : invalid}
        aria-describedby={descriptionIds.length > 0 ? descriptionIds : undefined}
        className={`min-h-touch w-full min-w-0 rounded-input border bg-surface px-3 py-3 text-body text-text placeholder:text-text-muted aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted ${hasError ? "border-danger" : "border-text-muted"} ${className}`}
      />
      {hasError && (
        <p
          id={`${inputId}-error`}
          className="text-label text-danger"
        >
          Errore: {error}
        </p>
      )}
    </div>
  );
}
