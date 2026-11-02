"use client";

import {
  getAnswer, questionnaireKey, resolveQuestionnaire, sameDefinition,
} from "@/lib/offline/questionnaire-input";

import { QuestionRenderer } from "./QuestionRenderer";

import type { CatalogSnapshot, Questionnaire } from "@/types/catalog";
import type { AnswerValue, QuestionnaireInput } from "@/types/questionnaires";

export function ProductQuestionnaire({
  catalog, profileId, categoryId, inputs, onChange,
}: {
  catalog: CatalogSnapshot;
  profileId: string;
  categoryId: string | null;
  inputs: QuestionnaireInput[];
  onChange: (inputs: QuestionnaireInput[]) => void;
}) {
  const current = resolveQuestionnaire(catalog, profileId, categoryId);
  const saved = inputs.filter((entry) => entry.definitionSnapshot.profileId === profileId
    && entry.definitionSnapshot.categoryId === categoryId);
  const active = current === undefined ? undefined
    : saved.find((entry) => sameDefinition(entry.definitionSnapshot, current));
  const history = saved.filter((entry) => !sameDefinition(entry.definitionSnapshot, current));
  const changedVersion = current !== undefined && history.some((entry) => questionnaireKey(entry.definitionSnapshot)
    === questionnaireKey(current));

  if (current === undefined && history.length === 0) {
    return null;
  }

  function change(definition: Questionnaire, questionId: string, value: AnswerValue | undefined) {
    const answers = {
      ...active?.answers,
    };

    if (value === undefined) {
      delete answers[questionId];
    } else {
      answers[questionId] = value;
    }
    const entry = {
      definitionSnapshot: definition,
      answers,
    };

    onChange(active === undefined ? [...inputs, entry]
      : inputs.map((item) => item === active ? entry : item));
  }

  return (
    <details
      className="product-questionnaire"
      open
    >
      <summary>Questionario</summary>
      <div className="questionnaire-content">
        {current !== undefined && !changedVersion && (
          <section aria-label={current.title}>
            <h2>{current.title}</h2>
            <p className="text-caption text-text-muted">Versione {current.version} · Tutte le risposte sono facoltative</p>
            {current.description !== undefined && <p>{current.description}</p>}
            <div className="questionnaire-questions">
              {current.questions.map((question) => (
                <QuestionRenderer
                  key={question.id}
                  question={question}
                  value={getAnswer(active?.answers, question.id)}
                  onChange={(value) => {
                    change(current, question.id, value);
                  }}
                />
              ))}
            </div>
          </section>
        )}
        {changedVersion && <p role="status">La definizione di questa versione è cambiata. Le risposte precedenti restano consultabili.</p>}
        {history.map((entry) => (
          <section
            key={questionnaireKey(entry.definitionSnapshot)}
            aria-label={`${entry.definitionSnapshot.title} · Storico`}
          >
            <h2>{entry.definitionSnapshot.title}</h2>
            <p className="text-caption text-text-muted">Versione {entry.definitionSnapshot.version} · Storico in sola lettura</p>
            {entry.definitionSnapshot.description !== undefined && <p>{entry.definitionSnapshot.description}</p>}
            <div className="questionnaire-questions">
              {entry.definitionSnapshot.questions.map((question) => (
                <QuestionRenderer
                  key={question.id}
                  question={question}
                  value={getAnswer(entry.answers, question.id)}
                  readOnly
                  onChange={() => { /* Historical snapshots cannot be edited. */ }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}
