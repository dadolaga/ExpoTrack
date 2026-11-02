"use client";

import { useId } from "react";

export function RatingSlider({ label, value, onChange }: {
  label: string;
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  const id = useId();

  return (
    <div className="product-rating">
      <label htmlFor={id}>{label}</label>
      {value === null ? (
        <button
          id={id}
          type="button"
          aria-label={`Aggiungi voto: ${label}`}
          className="product-rating-empty"
          onClick={() => {
            onChange(1);
          }}
        >
          <strong>—/10</strong><span>Aggiungi voto</span>
        </button>
      ) : (
        <>
          <div className="product-rating-control">
            <input
              id={id}
              type="range"
              min={1}
              max={10}
              step={1}
              value={value}
              aria-label={label}
              aria-valuetext={`${value} su 10`}
              onChange={(event) => {
                onChange(Number(event.target.value));
              }}
            />
            <output htmlFor={id}><strong>{value}</strong>/10</output>
          </div>
          <button
            type="button"
            className="product-text-action text-caption"
            onClick={() => {
              onChange(null);
            }}
          >Rimuovi valutazione
          </button>
        </>
      )}
    </div>
  );
}
