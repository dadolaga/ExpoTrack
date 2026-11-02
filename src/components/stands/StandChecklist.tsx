"use client";

import { useState } from "react";

import { createLocalId } from "@/lib/offline/identity";

import type { ChecklistSeedItem } from "@/types/catalog";
import type { StandPreferencesPatch } from "@/types/offline";

export function StandChecklist({
  items, completed, saving, onSave,
}: {
  items: (ChecklistSeedItem & {
    checked: boolean;
  })[];
  completed: number;
  saving: boolean;
  onSave: (changes: StandPreferencesPatch) => Promise<boolean>;
}) {
  const [text, setText] = useState("");

  async function add() {
    if (text.trim().length > 0 && await onSave({
      addChecklistItem: {
        id: createLocalId(),
        text,
      },
    })) {
      setText("");
    }
  }

  return (
    <section
      className="stand-detail-card"
      aria-labelledby="checklist-title"
    >
      <div className="stand-section-heading">
        <h2 id="checklist-title">Cose da vedere</h2>
        <span
          className="stand-count"
          role="status"
          aria-label={`${completed} di ${items.length} completate`}
        >{completed}/{items.length}
        </span>
      </div>
      {items.length === 0 && <p className="text-label text-text-muted">Nessuna cosa da vedere pianificata.</p>}
      <ul className="stand-checklist">
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.checked}
                disabled={saving}
                onChange={(event) => {
                  void onSave({
                    checklistChange: {
                      id: item.id,
                      checked: event.target.checked,
                    },
                  });
                }}
              />
              <span>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <form
        className="stand-checklist-add"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <label
          className="sr-only"
          htmlFor="new-checklist-item"
        >Nuova cosa da vedere
        </label>
        <input
          id="new-checklist-item"
          placeholder="Aggiungi elemento"
          value={text}
          disabled={saving}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <button
          type="submit"
          disabled={saving || text.trim().length === 0}
          aria-label="Aggiungi elemento alla checklist"
        >+
        </button>
      </form>
    </section>
  );
}
