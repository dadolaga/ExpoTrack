"use client";

import { useId } from "react";

import { RatingSlider } from "@/components/forms/RatingSlider";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { answerLabel, parseAnswer } from "@/lib/offline/questionnaire-input";

import type { Question } from "@/types/catalog";
import type { AnswerValue } from "@/types/questionnaires";

export function QuestionRenderer({
  question, value, readOnly = false, onChange,
}: {
  question: Question;
  value: AnswerValue | undefined;
  readOnly?: boolean;
  onChange: (value: AnswerValue | undefined) => void;
}) {
  const id = useId();
  const parsed = parseAnswer(question, value);
  const describedBy = question.helpText === undefined ? undefined : `${id}-hint`;

  if (readOnly) {
    return (
      <div className="questionnaire-answer">
        <p className="text-label font-medium">{question.label}</p>
        {question.helpText !== undefined && <p className="text-caption text-text-muted">{question.helpText}</p>}
        <p className="questionnaire-answer-value">{answerLabel(question, value)}</p>
        {parsed.error !== undefined && <p className="text-caption text-danger">Input conservato da correggere: {parsed.error}</p>}
      </div>
    );
  }
  if (question.type === "rating_1_10") {
    return (
      <div className="questionnaire-answer">
        {question.helpText !== undefined && <p className="text-caption text-text-muted">{question.helpText}</p>}
        <RatingSlider
          label={question.label}
          value={typeof value === "number" ? value : null}
          onChange={(rating) => {
            onChange(rating ?? undefined);
          }}
        />
      </div>
    );
  }
  if (question.type === "single_choice" || question.type === "multiple_choice") {
    const multiple = question.type === "multiple_choice";

    return (
      <fieldset
        className="questionnaire-answer"
        aria-describedby={describedBy}
      >
        <legend className="text-label font-medium">{question.label}</legend>
        {question.helpText !== undefined && (
          <p
            id={`${id}-hint`}
            className="text-caption text-text-muted"
          >{question.helpText}
          </p>
        )}
        {question.options.map((option) => (
          <label
            key={option.id}
            className="question-option"
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={id}
              value={option.id}
              checked={multiple ? Array.isArray(value) && value.includes(option.id) : value === option.id}
              onChange={(event) => {
                if (!multiple) {
                  onChange(option.id);

                  return;
                }
                const chosen = Array.isArray(value) ? value : [];
                const next = event.target.checked ? [...chosen, option.id]
                  : chosen.filter((entry) => entry !== option.id);

                onChange(next.length === 0 ? undefined : next);
              }}
            />
            {option.label}
          </label>
        ))}
        {value !== undefined && (
          <button
            type="button"
            className="product-text-action"
            onClick={() => {
              onChange(undefined);
            }}
          >Rimuovi risposta
          </button>
        )}
        {parsed.error !== undefined && (
          <p
            role="alert"
            className="text-caption text-danger"
          >{parsed.error}
          </p>
        )}
      </fieldset>
    );
  }
  if (question.type === "number") {
    return (
      <TextField
        label={question.label}
        hint={question.helpText}
        inputMode="decimal"
        value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
        error={parsed.error}
        onChange={(event) => {
          onChange(event.target.value === "" ? undefined : event.target.value);
        }}
      />
    );
  }
  if (question.type === "boolean") {
    let selected = "";

    if (value === true) {
      selected = "yes";
    } else if (value === false) {
      selected = "no";
    }

    return (
      <div className="questionnaire-answer">
        <SelectField
          label={question.label}
          aria-describedby={describedBy}
          value={selected}
          onChange={(event) => {
            const next = event.target.value;

            onChange(next === "" ? undefined : next === "yes");
          }}
        >
          <option value="">Non compilato</option>
          <option value="yes">Sì</option>
          <option value="no">No</option>
        </SelectField>
        {question.helpText !== undefined && (
          <p
            id={`${id}-hint`}
            className="text-caption text-text-muted"
          >{question.helpText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="questionnaire-answer">
      <label
        htmlFor={id}
        className="text-label font-medium"
      >{question.label}
      </label>
      {question.helpText !== undefined && (
        <p
          id={`${id}-hint`}
          className="text-caption text-text-muted"
        >{question.helpText}
        </p>
      )}
      <textarea
        id={id}
        rows={3}
        value={typeof value === "string" ? value : ""}
        placeholder={question.placeholder}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(event.target.value === "" ? undefined : event.target.value);
        }}
      />
    </div>
  );
}
