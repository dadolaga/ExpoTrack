"use client";

import { useEffect, useId, useRef } from "react";

import { NavigationIcon } from "@/components/layout/NavigationIcon";

import type { ReactNode } from "react";

export function Sheet({
  open, title, onClose, children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    if (open && ref.current?.open === false) {
      ref.current.showModal();
    }
    if (!open && ref.current?.open === true) {
      ref.current.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className="selection-sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="selection-sheet-header">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
        ><NavigationIcon name="close" />
        </button>
        <h2 id={id}>{title}</h2>
      </div>
      {children}
    </dialog>
  );
}
