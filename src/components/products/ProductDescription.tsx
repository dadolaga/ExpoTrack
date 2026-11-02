"use client";

import { SaveStatus } from "@/components/feedback/SaveStatus";
import { Button } from "@/components/ui/Button";

import type { SaveState } from "@/components/feedback/SaveStatus";

export function ProductDescription({
  value, status, onChange, onRetry, onBack,
}: {
  value: string;
  status: SaveState;
  onChange: (text: string) => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="product-fields">
      <label className="product-description-label">
        Descrizione personale del prodotto
        <textarea
          rows={12}
          className="product-description-text"
          value={value}
          placeholder="Scrivi qui le tue impressioni…"
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </label>
      <SaveStatus
        status={status}
        onRetry={onRetry}
      />
      <Button
        variant="secondary"
        onClick={onBack}
      >Torna al prodotto
      </Button>
    </div>
  );
}
