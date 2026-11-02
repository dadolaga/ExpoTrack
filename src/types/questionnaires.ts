import type { Questionnaire } from "./catalog";

export type AnswerValue = string | number | boolean | string[];

// Numeric input stays textual locally, including an unfinished or invalid value.
export type QuestionnaireInput = {
  definitionSnapshot: Questionnaire;
  answers: Record<string, AnswerValue>;
};

export type QuestionnaireAnswers = QuestionnaireInput;

export type QuestionnaireIssues = Record<string, Record<string, string>>;
