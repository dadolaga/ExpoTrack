import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadCatalog } from "../../src/lib/config/load-catalog";
import {
  answerLabel, parseAnswer, parseQuestionnaireInputs, resolveQuestionnaire,
} from "../../src/lib/offline/questionnaire-input";

import type { Question } from "../../src/types/catalog";

void test("questionari risolti soltanto per profilo e categoria esatti, senza fallback", async () => {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const me = resolveQuestionnaire(catalog, "me", "bags");
  const father = resolveQuestionnaire(catalog, "father", "bags");

  assert.ok(me);
  assert.ok(father);
  assert.notEqual(me.id, father.id);
  assert.notDeepEqual(me.questions, father.questions);
  assert.equal(resolveQuestionnaire(catalog, "personal", "bags"), undefined);
  assert.equal(resolveQuestionnaire(catalog, "me", null), undefined);
  assert.equal(resolveQuestionnaire(catalog, "me", "equipment"), undefined);
  assert.equal(resolveQuestionnaire(catalog, "me", "lights"), undefined);
  const childCatalog = structuredClone(catalog);

  childCatalog.categories.push({
    id: "small-bags",
    name: "Borse piccole",
    parentId: "bags",
  });
  assert.equal(resolveQuestionnaire(childCatalog, "me", "small-bags"), undefined);
});

void test("testo integro, No distinto da assente e numeri italiani con min/max/step", () => {
  const text: Question = {
    id: "notes",
    label: "Note",
    type: "text",
  };
  const boolean: Question = {
    ...text,
    type: "boolean",
  };
  const number: Question = {
    ...text,
    type: "number",
    min: -1,
    max: 2,
    step: 0.1,
  };
  const longText = "È utile? <script>test</script>\n".repeat(1000);

  assert.equal(parseAnswer(text, longText).value, longText);
  assert.equal(parseAnswer(text, "  ").value, undefined);
  assert.equal(parseAnswer(boolean, undefined).value, undefined);
  assert.equal(parseAnswer(boolean, false).value, false);
  assert.equal(answerLabel(boolean, undefined), "Non compilato");
  assert.equal(answerLabel(boolean, false), "No");
  assert.equal(answerLabel(boolean, true), "Sì");
  assert.notEqual(parseAnswer(boolean, "false").error, undefined);
  assert.equal(parseAnswer(number, "0").value, 0);
  assert.equal(parseAnswer(number, " -0,5 ").value, -0.5);
  assert.equal(parseAnswer(number, "0.3").value, 0.3);
  assert.equal(parseAnswer(number, "").value, undefined);
  for (const input of [
    "abc", "Infinity", "NaN", "1,000.2", "1e2", "1,", "--1", "2.1", "-1.1", "0.15",
  ]) {
    assert.notEqual(parseAnswer(number, input).error, undefined, input);
  }
  assert.notEqual(parseAnswer(number, true).error, undefined);
  const unconstrained: Question = {
    ...text,
    type: "number",
  };

  assert.equal(parseAnswer(unconstrained, "-12,567").value, -12.567);
});

void test("confine input rifiuta snapshot malformati, domande ignote e duplicati", async () => {
  const catalog = await loadCatalog(path.join(process.cwd(), "tests/fixtures/catalog"));
  const definitionSnapshot = resolveQuestionnaire(catalog, "me", "bags");

  assert.ok(definitionSnapshot);
  const input = {
    definitionSnapshot,
    answers: {
      waterproof: false,
      capacity_litres: "1,5",
    },
  };

  assert.deepEqual(parseQuestionnaireInputs([input])[0]?.answers, input.answers);
  assert.throws(() => parseQuestionnaireInputs([input, input]));
  assert.throws(() => parseQuestionnaireInputs([
    {
      ...input,
      answers: {
        unknown: "Risposta",
      },
    },
  ]));
  assert.throws(() => parseQuestionnaireInputs([
    {
      ...input,
      definitionSnapshot: {
        ...definitionSnapshot,
        version: 0,
      },
    },
  ]));
  assert.throws(() => parseQuestionnaireInputs([
    {
      ...input,
      answers: {
        capacity_litres: Infinity,
      },
    },
  ]));
});
