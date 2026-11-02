"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  open, title, description, busy, error, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    if (open && ref.current?.open === false) {
      ref.current.showModal();
    } else if (!open && ref.current?.open === true) {
      ref.current.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-description`}>{description}</p>
        {error !== null && (
          <p
            role="alert"
            className="text-danger"
          >{error}
          </p>
        )}
        {busy && <p role="status">Operazione in corso…</p>}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >Annulla
        </Button>
        <Button
          disabled={busy}
          onClick={onConfirm}
        >Elimina stand
        </Button>
      </div>
    </dialog>
  );
}
