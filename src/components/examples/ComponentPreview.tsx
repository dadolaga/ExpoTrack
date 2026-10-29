"use client";

import { useRef, useState } from "react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";

import type { FormEvent } from "react";

export function ComponentPreview() {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasError = checked && value.trim().length === 0;

  function checkField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecked(true);

    if (value.trim().length === 0) {
      inputRef.current?.focus();
    }
  }

  function resetExample() {
    setValue("");
    setChecked(false);
  }

  function fillExample() {
    setValue("Testo di esempio");
    setChecked(false);
    inputRef.current?.focus();
  }

  return (
    <>
      <Card>
        <h2>Campi e pulsanti</h2>
        <form
          noValidate
          onSubmit={checkField}
          className="flex flex-col gap-4"
        >
          <TextField
            ref={inputRef}
            label="Testo di prova"
            name="example"
            required
            hint="Lascia il campo vuoto e premi Verifica campo per provare l’errore."
            error={hasError ? "Inserisci un testo diverso da soli spazi." : undefined}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setChecked(false);
            }}
          />
          <TextField
            label="Campo disabilitato"
            hint="Non modificabile: esempio dello stato disabilitato."
            value="Solo dimostrazione"
            disabled
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Verifica campo</Button>
            <Button
              variant="secondary"
              onClick={resetExample}
            >
              Azzera la prova
            </Button>
            <Button
              disabled
              aria-describedby="disabled-button-hint"
            >
              Azione non disponibile
            </Button>
          </div>
          <p
            id="disabled-button-hint"
            className="text-caption text-text-muted"
          >
            Il terzo pulsante è disabilitato per mostrarne lo stato.
          </p>
          <p
            role="status"
            aria-atomic="true"
          >
            {checked && (
              <StatusChip tone={hasError ? "danger" : "success"}>
                {hasError ? "Verifica non riuscita: correggi il campo." : "Testo valido nella prova locale."}
              </StatusChip>
            )}
          </p>
        </form>
      </Card>

      <Card>
        <h2>Indicatori di stato</h2>
        <p className="text-text-muted">Esempi grafici con testo esplicito, indipendenti dai dati dell’app.</p>
        <div className="flex flex-wrap items-start gap-3">
          <StatusChip>Neutro · esempio</StatusChip>
          <StatusChip tone="success">Completato · esempio</StatusChip>
          <StatusChip tone="warning">Attenzione · esempio</StatusChip>
          <StatusChip tone="danger">Errore · esempio</StatusChip>
        </div>
      </Card>

      <Card>
        <h2>Stato vuoto</h2>
        <EmptyState
          title="Nessun elemento di esempio"
          description="Questo è un esempio di stato vuoto. Puoi inserire un testo nel campo di prova."
          action={(
            <Button
              variant="secondary"
              onClick={fillExample}
            >
              Compila il campo di prova
            </Button>
          )}
        />
      </Card>
    </>
  );
}
