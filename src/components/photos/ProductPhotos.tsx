"use client";

import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { SaveStatus } from "@/components/feedback/SaveStatus";
import { Button } from "@/components/ui/Button";

import { PhotoGrid } from "./PhotoGrid";
import { PhotoViewer } from "./PhotoViewer";

import type { useProductPhotos } from "@/features/photos/use-product-photos";

export function ProductPhotos({ workflow, onBack }: {
  workflow: ReturnType<typeof useProductPhotos>;
  onBack: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pickerMessage, setPickerMessage] = useState<string | null>(null);
  const primaryId = (workflow.items.find((photo) => photo.isPrimary) ?? workflow.items.at(0))?.id;
  const feedback = (
    <>
      {workflow.error !== null && (
        <p
          role="alert"
          className="text-danger"
        >{workflow.error}
        </p>
      )}
      <SaveStatus
        status={workflow.status}
        onRetry={() => {
          void workflow.retry();
        }}
      />
      {workflow.status === "error" && (
        <Button
          variant="secondary"
          onClick={workflow.dismissError}
        >Ignora operazione non salvata
        </Button>
      )}
    </>
  );

  function pick(source: "camera" | "gallery") {
    setPickerMessage(null);
    try {
      (source === "camera" ? camera : gallery).current?.click();
    } catch {
      setPickerMessage("Impossibile aprire la fotocamera o la galleria. Controlla i permessi del browser e riprova.");
    }
  }

  useEffect(() => {
    const inputs = [camera.current, gallery.current];

    function cancelled() {
      setPickerMessage("Nessuna foto ricevuta. Puoi riprovare o scegliere dalla galleria; se la fotocamera non si apre, controlla i permessi del browser.");
    }

    for (const picker of inputs) {
      picker?.addEventListener("cancel", cancelled);
    }

    return () => {
      for (const picker of inputs) {
        picker?.removeEventListener("cancel", cancelled);
      }
    };
  }, []);

  function closeViewer() {
    workflow.select(null);
    if (trigger.current?.isConnected === true) {
      trigger.current.focus();
    } else {
      container.current?.focus();
    }
  }

  return (
    <div
      ref={container}
      className="product-photos"
      tabIndex={-1}
    >
      <p
        className="photo-count"
        role="status"
      >{workflow.items.length} foto
      </p>
      {workflow.loading && <p role="status">Caricamento fotografie…</p>}
      {workflow.loadError && <div role="alert"><p>Impossibile leggere le foto.</p><Button onClick={workflow.reload}>Riprova</Button></div>}
      {!workflow.loading && !workflow.loadError && (
        <>
          {workflow.items.length === 0 && <p className="text-text-muted">Nessuna fotografia. Aggiungila dalla fotocamera o dalla galleria.</p>}
          <PhotoGrid
            items={workflow.items}
            primaryId={primaryId}
            busy={workflow.busy}
            onOpen={(id, button) => {
              trigger.current = button;
              workflow.select(id);
            }}
            onAdd={() => {
              pick("gallery");
            }}
          />
        </>
      )}
      <input
        ref={camera}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(event) => {
          workflow.add(Array.from(event.target.files ?? []));
          const picker = event.target;

          picker.value = "";
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          workflow.add(Array.from(event.target.files ?? []));
          const picker = event.target;

          picker.value = "";
        }}
      />
      <div className="photo-capture-actions">
        <Button
          variant="secondary"
          disabled={workflow.busy}
          onClick={() => {
            pick("camera");
          }}
        >Scatta foto
        </Button>
        <Button
          variant="secondary"
          disabled={workflow.busy}
          onClick={() => {
            pick("gallery");
          }}
        >Dalla galleria
        </Button>
      </div>
      {pickerMessage !== null && <p role="status">{pickerMessage}</p>}
      {workflow.progress !== "" && <p role="status">{workflow.progress}</p>}
      {feedback}
      <p className="text-caption text-text-muted">Originali conservati sul dispositivo, anche con prodotto incompleto. Le anteprime sono separate; l’originale può contenere metadati EXIF.</p>
      <Button
        variant="secondary"
        disabled={workflow.busy}
        onClick={onBack}
      >Torna al prodotto
      </Button>
      <PhotoViewer
        items={workflow.items}
        selected={workflow.selected}
        asset={workflow.asset}
        primaryId={primaryId}
        busy={workflow.busy}
        error={workflow.assetError}
        feedback={feedback}
        onSelect={workflow.select}
        onClose={closeViewer}
        onPrimary={(id) => {
          workflow.changePhoto(id, "primary");
        }}
        onDelete={(id) => {
          setDeleting(id);
        }}
        onRetry={workflow.reload}
      />
      <ConfirmDialog
        open={deleting !== null && workflow.items.some((photo) => photo.id === deleting)}
        title="Eliminare la foto?"
        description="La foto verrà rimossa dal prodotto. I file necessari alle operazioni pendenti resteranno conservati fino alla sincronizzazione."
        confirmLabel="Elimina foto"
        busy={workflow.busy}
        error={workflow.error}
        onConfirm={() => {
          if (deleting !== null) {
            workflow.changePhoto(deleting, "delete");
          }
        }}
        onCancel={() => {
          setDeleting(null);
        }}
      />
    </div>
  );
}
