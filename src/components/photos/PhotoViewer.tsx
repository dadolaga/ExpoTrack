"use client";

import {
  useEffect, useId, useRef, useState,
} from "react";

import { NavigationIcon } from "@/components/layout/NavigationIcon";
import { Button } from "@/components/ui/Button";

import { PhotoImage } from "./PhotoImage";

import type { PhotoAsset, PhotoItem } from "@/types/photos";
import type { ReactNode } from "react";

export function PhotoViewer({
  items, selected, asset, primaryId, busy, error, feedback, onSelect, onClose, onPrimary, onDelete, onRetry,
}: {
  feedback: ReactNode;
  items: PhotoItem[];
  selected: PhotoItem | undefined;
  asset: PhotoAsset | undefined;
  primaryId: string | undefined;
  busy: boolean;
  error: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPrimary: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [zoom, setZoom] = useState(false);
  const [original, setOriginal] = useState(false);
  const open = selected !== undefined;
  const index = items.findIndex((photo) => photo.id === selected?.id);

  useEffect(() => {
    const dialog = ref.current;

    if (open && dialog?.open === false) {
      dialog.showModal();
    }
    if (!open && dialog?.open === true) {
      dialog.close();
    }
  }, [open]);

  function select(photoId: string) {
    setZoom(false);
    setOriginal(false);
    onSelect(photoId);
  }

  return (
    <dialog
      ref={ref}
      className="photo-viewer"
      aria-labelledby={id}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" && index > 0) {
          select(items[index - 1].id);
        }
        if (event.key === "ArrowRight" && index + 1 < items.length) {
          select(items[index + 1].id);
        }
      }}
    >
      {selected !== undefined && (
        <div className="photo-viewer-content">
          <header className="photo-viewer-header">
            <button
              type="button"
              aria-label="Chiudi foto"
              disabled={busy}
              onClick={onClose}
            ><NavigationIcon name="back" />
            </button>
            <h2 id={id}>{index + 1} di {items.length}</h2>
            <details className="photo-actions">
              <summary aria-label="Azioni foto">•••</summary>
              <div>
                <Button
                  variant="secondary"
                  disabled={busy || selected.id === primaryId}
                  onClick={() => {
                    onPrimary(selected.id);
                  }}
                >Imposta come principale
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    onDelete(selected.id);
                  }}
                >Elimina foto
                </Button>
              </div>
            </details>
          </header>
          <div
            className="photo-viewer-image"
            data-zoom={zoom}
          >
            {error ? (
              <div role="alert"><p>Immagine non disponibile sul dispositivo.</p><Button onClick={onRetry}>Riprova</Button></div>
            ) : (
              <PhotoImage
                key={selected.id}
                blob={original ? asset?.original : asset?.preview}
                alt={`Foto ${index + 1}: ${selected.filename}`}
                width={selected.width}
                height={selected.height}
              />
            )}
          </div>
          <div className="photo-viewer-tools">
            <Button
              variant="secondary"
              disabled={asset === undefined}
              onClick={() => {
                setZoom((value) => !value);
              }}
            >{zoom ? "Adatta allo schermo" : "Ingrandisci"}
            </Button>
            <Button
              variant="secondary"
              disabled={asset === undefined}
              onClick={() => {
                setOriginal((value) => !value);
              }}
            >{original ? "Mostra anteprima" : "Mostra originale"}
            </Button>
          </div>
          <div
            className="photo-filmstrip"
            aria-label="Seleziona foto"
          >
            {items.map((photo, photoIndex) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`Foto ${photoIndex + 1}`}
                aria-pressed={photo.id === selected.id}
                onClick={() => {
                  select(photo.id);
                }}
              >
                <PhotoImage
                  blob={photo.thumbnail}
                  alt=""
                  width={80}
                  height={80}
                />
              </button>
            ))}
          </div>
          <div className="photo-viewer-feedback">{feedback}</div>
          <p
            className="text-caption text-center"
            role="status"
          >{selected.id === primaryId ? "Foto principale · " : ""}Salvata sul dispositivo
          </p>
        </div>
      )}
    </dialog>
  );
}
