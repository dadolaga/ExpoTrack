import type { ComponentProps } from "react";

type StatusChipProps = ComponentProps<"span"> & {
  tone?: "neutral" | "success" | "warning" | "danger";
};

const tones = {
  neutral: "border-text-muted bg-text-muted",
  success: "border-success bg-success",
  warning: "border-warning bg-warning",
  danger: "border-danger bg-danger",
};

export function StatusChip({ tone = "neutral", className = "", ...props }: StatusChipProps) {
  return (
    <span
      {...props}
      className={`inline-flex max-w-full items-center rounded-input border px-3 py-1 text-label font-medium text-on-primary ${tones[tone]} ${className}`}
    />
  );
}
