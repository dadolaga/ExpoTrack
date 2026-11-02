import { LocalInputError } from "./product-input";

import type { ChecklistSeedItem } from "../../types/catalog";
import type { StandPreferencesData, StandPreferencesPatch } from "../../types/offline";

export function applyStandPatch(
  previous: StandPreferencesData,
  seedChecklist: ChecklistSeedItem[],
  changes: StandPreferencesPatch,
): StandPreferencesData {
  if (Object.keys(changes).length === 0 || Object.keys(changes).some((key) => ![
    "interested", "priority", "visitStatus", "checklistChange", "addChecklistItem",
  ].includes(key))) {
    throw new LocalInputError("Modifica stand non valida.");
  }
  const next = structuredClone(previous);

  if (Object.hasOwn(changes, "interested")) {
    if (typeof changes.interested !== "boolean") {
      throw new LocalInputError("L’interesse deve essere un valore booleano.");
    }
    next.interested = changes.interested;
  }
  if (Object.hasOwn(changes, "priority")) {
    if (changes.priority !== null && (typeof changes.priority !== "number"
      || !Number.isInteger(changes.priority) || changes.priority < 1 || changes.priority > 10)) {
      throw new LocalInputError("La priorità deve essere un intero da 1 a 10 oppure non impostata.");
    }
    next.priority = changes.priority;
  }
  if (Object.hasOwn(changes, "visitStatus")) {
    if (changes.visitStatus !== "to_visit" && changes.visitStatus !== "visited"
      && changes.visitStatus !== "to_revisit") {
      throw new LocalInputError("Stato visita non valido.");
    }
    next.visitStatus = changes.visitStatus;
  }
  if (changes.addChecklistItem !== undefined) {
    const item = changes.addChecklistItem;
    const checklist = next.checklist ?? seedChecklist;

    if (typeof item.id !== "string" || item.id.trim().length === 0 || typeof item.text !== "string"
      || item.text.trim().length === 0 || checklist.some((entry) => entry.id === item.id)) {
      throw new LocalInputError("Voce checklist vuota o identificativo già utilizzato.");
    }
    next.checklist = [
      ...checklist, {
        id: item.id,
        text: item.text.trim(),
      },
    ];
  }
  if (changes.checklistChange !== undefined) {
    const change = changes.checklistChange;

    if (typeof change.checked !== "boolean" || !(next.checklist ?? seedChecklist).some((item) => item.id === change.id)) {
      throw new LocalInputError("Voce checklist non disponibile.");
    }
    next.checklistDone = {
      ...next.checklistDone,
      [change.id]: change.checked,
    };
  }

  return next;
}
