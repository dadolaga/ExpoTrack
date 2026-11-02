import { parseQuestionnaires } from "../config/parse-questionnaires";

import type { CatalogSnapshot, Question, Questionnaire } from "../../types/catalog";
import type {
  AnswerValue, QuestionnaireAnswers, QuestionnaireInput, QuestionnaireIssues,
} from "../../types/questionnaires";

export function resolveQuestionnaire(
  catalog: CatalogSnapshot,
  profileId: string,
  categoryId: string | null,
): Questionnaire | undefined {
  return catalog.questionnaires.find((definition) => definition.profileId === profileId
    && definition.categoryId === categoryId);
}

export function questionnaireKey(definition: Questionnaire): string {
  return JSON.stringify([
    definition.profileId, definition.categoryId, definition.id, definition.version,
  ]);
}

export function sameDefinition(first: Questionnaire, second: Questionnaire | undefined): boolean {
  return second !== undefined && JSON.stringify(first) === JSON.stringify(second);
}

export function parseQuestionnaireInputs(value: unknown): QuestionnaireInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Le risposte questionario devono essere un elenco.");
  }
  const result = value.map((entry: unknown): QuestionnaireInput => {
    if (typeof entry !== "object" || entry === null
      || !("definitionSnapshot" in entry) || !("answers" in entry)
      || Object.keys(entry).some((key) => key !== "definitionSnapshot" && key !== "answers")) {
      throw new Error("Risposte questionario non valide.");
    }
    const snapshot = entry.definitionSnapshot;

    if (typeof snapshot !== "object" || snapshot === null
      || !("profileId" in snapshot) || typeof snapshot.profileId !== "string") {
      throw new Error("Definizione questionario non valida.");
    }
    // Reuse the editorial parser at the untrusted input boundary.
    // Domain snapshots include profileId and optional undefined fields absent in JSON files.
    const { profileId, ...definition } = snapshot;
    const jsonDefinition: unknown = JSON.parse(JSON.stringify(definition));
    const definitions = parseQuestionnaires({
      schemaVersion: 1,
      profileId,
      questionnaires: [jsonDefinition],
    }, profileId, "questionnaireInputs");
    const definitionSnapshot = definitions[0];

    if (typeof entry.answers !== "object"
      || entry.answers === null || Array.isArray(entry.answers)) {
      throw new Error("Risposte questionario non valide.");
    }
    const answers = Object.fromEntries(Object.entries(entry.answers).map(([id, answer]: [string, unknown]) => {
      if (!definitionSnapshot.questions.some((question) => question.id === id)
        || !(typeof answer === "string" || typeof answer === "boolean"
          || (typeof answer === "number" && Number.isFinite(answer))
          || (Array.isArray(answer) && answer.every((option: unknown) => typeof option === "string")))) {
        throw new Error("Risposta o identificativo domanda non valido.");
      }

      return [id, Array.isArray(answer) ? [...answer] : answer];
    }));

    return {
      definitionSnapshot,
      answers,
    };
  });

  if (new Set(result.map((entry) => questionnaireKey(entry.definitionSnapshot))).size !== result.length) {
    throw new Error("Versione questionario duplicata.");
  }

  return result;
}

export function checkQuestionnaireInputs(
  inputs: QuestionnaireInput[],
  previous: QuestionnaireInput[],
  catalog: CatalogSnapshot,
  profileId: string,
  categoryId: string | null,
): void {
  for (const saved of previous) {
    if (!inputs.some((entry) => sameDefinition(entry.definitionSnapshot, saved.definitionSnapshot))) {
      throw new Error("Le risposte precedenti devono essere conservate.");
    }
  }
  const current = resolveQuestionnaire(catalog, profileId, categoryId);

  for (const entry of inputs) {
    const definition = entry.definitionSnapshot;
    const saved = previous.find((item) => sameDefinition(item.definitionSnapshot, definition));

    if (definition.profileId !== profileId || (saved === undefined && !sameDefinition(definition, current))) {
      throw new Error("Questionario non disponibile per questo profilo e categoria.");
    }
    if (!sameDefinition(definition, current)
      && JSON.stringify(entry.answers) !== JSON.stringify(saved?.answers)) {
      throw new Error("Il questionario storico è disponibile in sola lettura.");
    }
  }
}

type ParsedAnswer = {
  value?: AnswerValue;
  error?: string;
};

export function getAnswer(
  answers: Record<string, AnswerValue> | undefined,
  questionId: string,
): AnswerValue | undefined {
  return answers !== undefined && Object.hasOwn(answers, questionId) ? answers[questionId] : undefined;
}

export function parseAnswer(question: Question, raw: AnswerValue | undefined): ParsedAnswer {
  if (raw === undefined || raw === ""
    || (question.type === "multiple_choice" && Array.isArray(raw) && raw.length === 0)) {
    return {};
  }
  switch (question.type) {
    case "text":
      return typeof raw === "string" ? {
        value: raw.trim() === "" ? undefined : raw,
      } : {
        error: "Inserisci un testo.",
      };
    case "boolean":
      return typeof raw === "boolean" ? {
        value: raw,
      } : {
        error: "Scegli Sì, No oppure Non compilato.",
      };
    case "number": {
      const text = String(raw).trim();
      const number = Number(text.replace(",", "."));
      const steps = (number - (question.min ?? 0)) / (question.step ?? 1);
      const validStep = question.step === undefined
        || Math.abs(steps - Math.round(steps)) <= 1e-8;

      if (typeof raw === "string" && text === "") {
        return {};
      }
      if ((typeof raw !== "string" && typeof raw !== "number")
        || !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/u.test(text) || !Number.isFinite(number)) {
        return {
          error: "Inserisci un numero valido, usando il punto o la virgola per i decimali.",
        };
      }
      if (question.min !== undefined && number < question.min) {
        return {
          error: `Il valore minimo è ${question.min}.`,
        };
      }
      if (question.max !== undefined && number > question.max) {
        return {
          error: `Il valore massimo è ${question.max}.`,
        };
      }
      if (!validStep) {
        return {
          error: `Usa incrementi di ${question.step} a partire da ${question.min ?? 0}.`,
        };
      }

      return {
        value: number,
      };
    }
    // Validate stored values for all canonical types, including historical snapshots.
    case "rating_1_10":
      return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 10 ? {
        value: raw,
      } : {
        error: "Scegli un voto da 1 a 10 oppure rimuovi la risposta.",
      };
    case "single_choice":
      return typeof raw === "string" && question.options.some((option) => option.id === raw) ? {
        value: raw,
      } : {
        error: "Scegli un’opzione disponibile.",
      };
    case "multiple_choice":
      return Array.isArray(raw) && new Set(raw).size === raw.length
        && raw.every((id) => question.options.some((option) => option.id === id)) ? {
          value: question.options.filter((option) => raw.includes(option.id)).map((option) => option.id),
        } : {
          error: "Scegli opzioni disponibili senza duplicati.",
        };
  }
}

export function validateQuestionnaireAnswers(
  inputs: QuestionnaireInput[],
  previous: QuestionnaireAnswers[],
  categoryId: string | null,
): {
  answers: QuestionnaireAnswers[];
  issues: QuestionnaireIssues;
} {
  const issues: QuestionnaireIssues = {};
  const answers = inputs.filter((entry) => entry.definitionSnapshot.categoryId === categoryId)
    .flatMap((entry): QuestionnaireAnswers[] => {
      const snapshot = entry.definitionSnapshot;
      const old = previous.find((item) => sameDefinition(item.definitionSnapshot, snapshot));
      const errors: Record<string, string> = {};
      const values = Object.fromEntries(snapshot.questions.flatMap((question) => {
        const parsed = parseAnswer(question, getAnswer(entry.answers, question.id));

        if (parsed.error !== undefined) {
          errors[question.id] = parsed.error;
        }
        const value = parsed.error === undefined ? parsed.value : getAnswer(old?.answers, question.id);

        return value === undefined ? [] : [[question.id, value]];
      }));

      if (Object.keys(errors).length > 0) {
        issues[questionnaireKey(snapshot)] = errors;
      }

      // An invalid first input must not create a synchronized answer set.
      return old === undefined && Object.keys(values).length === 0 ? [] : [
        {
          definitionSnapshot: snapshot,
          answers: values,
        },
      ];
    });

  return {
    answers,
    issues,
  };
}

export function answerLabel(question: Question, value: AnswerValue | undefined): string {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return "Non compilato";
  }
  if (typeof value === "boolean") {
    return value ? "Sì" : "No";
  }
  if (question.type === "single_choice" || question.type === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [value];

    return question.options.filter((option) => selected.includes(option.id))
      .map((option) => option.label).join(", ");
  }

  return String(value);
}
