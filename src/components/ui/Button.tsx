import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
};

const variants = {
  primary: "border-primary bg-primary text-on-primary",
  secondary: "border-text-muted bg-surface text-text",
};

export function Button({
  variant = "primary", type = "button", className = "", ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-input border px-4 py-3 text-label font-medium whitespace-normal enabled:cursor-pointer enabled:hover:underline disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-muted ${variants[variant]} ${className}`}
    />
  );
}
