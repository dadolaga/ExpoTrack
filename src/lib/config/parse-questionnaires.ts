import {
  array,
  ConfigValidationError,
  document,
  freeText,
  id,
  integer,
  number,
  object,
  optional,
  slug,
  text,
  unique,
} from "./validation";

import type { Question, Questionnaire } from "../../types/catalog";

function parseQuestion(value: unknown, path: string): Question {
  // The legacy alias is accepted only while reading; the snapshot is canonical.
  const header = object(value, path, [
    "id", "label", "type",
  ], [
    "helpText", "placeholder", "min", "max", "step", "options",
  ]);
  const type = header.type === "rating" ? "rating_1_10" : header.type;
  const base = {
    id: id(header.id, `${path}.id`),
    label: text(header.label, `${path}.label`),
    helpText: optional(header, "helpText", path, freeText),
  };
  const fields = [
    "id", "label", "type",
  ];

  switch (type) {
    case "text": {
      const item = object(value, path, fields, ["helpText", "placeholder"]);

      return {
        ...base,
        type,
        placeholder: optional(item, "placeholder", path, freeText),
      };
    }
    case "number": {
      const item = object(value, path, fields, [
        "helpText", "min", "max", "step",
      ]);
      const min = optional(item, "min", path, number);
      const max = optional(item, "max", path, number);
      const step = optional(item, "step", path, number);

      if (min !== undefined && max !== undefined && min > max) {
        throw new ConfigValidationError(`${path}.max`, "deve essere maggiore o uguale a min");
      }
      if (step !== undefined && step <= 0) {
        throw new ConfigValidationError(`${path}.step`, "deve essere positivo");
      }

      return {
        ...base,
        type,
        min,
        max,
        step,
      };
    }
    case "boolean":
    case "rating_1_10":
      object(value, path, fields, ["helpText"]);

      return {
        ...base,
        type,
      };
    case "single_choice":
    case "multiple_choice": {
      const item = object(value, path, [...fields, "options"], ["helpText"]);
      const options = unique(array(item.options, `${path}.options`, (entry, entryPath) => {
        const option = object(entry, entryPath, ["id", "label"]);

        return {
          id: id(option.id, `${entryPath}.id`),
          label: text(option.label, `${entryPath}.label`),
        };
      }), `${path}.options`, (option) => option.id);

      if (options.length < 2) {
        throw new ConfigValidationError(`${path}.options`, "servono almeno due opzioni distinte");
      }

      return {
        ...base,
        type,
        options,
      };
    }
    default:
      throw new ConfigValidationError(`${path}.type`, "tipo di domanda non supportato");
  }
}

export function parseQuestionnaires(value: unknown, profileId: string, path: string): Questionnaire[] {
  const root = document(value, path, ["profileId", "questionnaires"]);

  if (root.profileId !== profileId) {
    throw new ConfigValidationError(`${path}.profileId`, `profilo atteso: ${profileId}`);
  }

  const questionnaires = array(root.questionnaires, `${path}.questionnaires`, (entry, entryPath) => {
    const item = object(
      entry,
      entryPath,
      [
        "id", "categoryId", "version", "title", "questions",
      ],
      ["description"],
    );
    const version = integer(item.version, `${entryPath}.version`);
    const questions = unique(
      array(item.questions, `${entryPath}.questions`, parseQuestion),
      `${entryPath}.questions`,
      (question) => question.id,
    );

    if (version < 1) {
      throw new ConfigValidationError(`${entryPath}.version`, "atteso intero positivo");
    }
    if (questions.length === 0) {
      throw new ConfigValidationError(`${entryPath}.questions`, "serve almeno una domanda");
    }

    return {
      id: slug(item.id, `${entryPath}.id`),
      profileId,
      categoryId: slug(item.categoryId, `${entryPath}.categoryId`),
      version,
      title: text(item.title, `${entryPath}.title`),
      description: optional(item, "description", entryPath, freeText),
      questions,
    };
  });

  unique(questionnaires, `${path}.questionnaires`, (questionnaire) => questionnaire.id);

  return unique(questionnaires, `${path}.questionnaires`, (questionnaire) => questionnaire.categoryId);
}
