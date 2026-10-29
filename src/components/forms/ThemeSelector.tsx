"use client";

import { useId, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import {
  getServerThemePreference,
  getThemePreference,
  saveThemePreference,
  subscribeToTheme,
} from "@/lib/theme";

const options = [
  {
    value: "system",
    label: "Automatico",
  },
  {
    value: "light",
    label: "Chiaro",
  },
  {
    value: "dark",
    label: "Scuro",
  },
] as const;

export function ThemeSelector() {
  const id = useId();
  const preference = useSyncExternalStore(subscribeToTheme, getThemePreference, getServerThemePreference);
  const [saveFailed, setSaveFailed] = useState(false);

  return (
    <fieldset
      aria-describedby={`${id}-hint`}
      className="flex min-w-0 flex-col gap-3"
    >
      <legend className="mb-3 text-label font-medium">Tema</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-touch cursor-pointer items-center gap-2 rounded-input border border-text-muted bg-surface px-3 py-2 text-label has-checked:border-primary has-checked:bg-surface-muted has-checked:font-medium"
          >
            <input
              type="radio"
              name={`${id}-theme`}
              value={option.value}
              disabled={preference === null}
              checked={preference === option.value}
              onChange={() => {
                setSaveFailed(!saveThemePreference(option.value));
              }}
              className="accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
      <p
        id={`${id}-hint`}
        className="text-caption text-text-muted"
      >
        Automatico segue il tema del dispositivo. La scelta viene ricordata solo in questo browser.
      </p>
      <p
        role="status"
        aria-atomic="true"
        className="text-label text-danger"
      >
        {saveFailed && "Tema applicato per questa sessione. Impossibile ricordare la scelta: consenti l’archiviazione nel browser e riprova."}
      </p>
      {saveFailed && (
        <Button
          variant="secondary"
          onClick={() => {
            setSaveFailed(!saveThemePreference(preference ?? "system"));
          }}
        >
          Riprova a ricordare il tema
        </Button>
      )}
    </fieldset>
  );
}
