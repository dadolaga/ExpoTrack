"use client";

import { PhotoImage } from "./PhotoImage";

import type { PhotoItem } from "@/types/photos";

export function PhotoGrid({
  items, primaryId, busy, onOpen, onAdd,
}: {
  items: PhotoItem[];
  primaryId: string | undefined;
  busy: boolean;
  onOpen: (id: string, trigger: HTMLButtonElement) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="photo-grid"
      aria-label="Fotografie del prodotto"
    >
      {items.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          className="photo-tile"
          aria-label={`Apri foto ${index + 1}: ${photo.filename}`}
          onClick={(event) => {
            onOpen(photo.id, event.currentTarget);
          }}
        >
          <PhotoImage
            blob={photo.thumbnail}
            alt=""
            width={480}
            height={480}
          />
          {photo.id === primaryId && <span className="photo-primary-badge">♛ Principale</span>}
          <span
            className="photo-tile-menu"
            aria-hidden="true"
          >•••
          </span>
        </button>
      ))}
      <button
        type="button"
        className="photo-add-tile"
        disabled={busy}
        onClick={onAdd}
      >
        <span aria-hidden="true">＋</span>Aggiungi foto
      </button>
    </div>
  );
}
