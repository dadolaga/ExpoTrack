import type { ComponentProps } from "react";

type CardProps = ComponentProps<"div">;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-section ${className}`}
    />
  );
}
