import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h3>{title}</h3>
      <p className="text-text-muted">{description}</p>
      {action}
    </div>
  );
}
