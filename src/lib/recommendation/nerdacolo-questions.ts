import type { Locale } from "@/lib/i18n";
import { normalizeLocale } from "@/lib/i18n";
import type { NerdacoloQuestion } from "./nerdacolo-types";
import { NERDACOLO_QUESTIONS_IT } from "./nerdacolo-questions.it";
import type { QuestionTextCatalog } from "./nerdacolo-question-texts";
import { NERDACOLO_QUESTION_TEXTS_DE } from "./nerdacolo-question-texts.de";
import { NERDACOLO_QUESTION_TEXTS_EN } from "./nerdacolo-question-texts.en";
import { NERDACOLO_QUESTION_TEXTS_ES } from "./nerdacolo-question-texts.es";
import { NERDACOLO_QUESTION_TEXTS_FR } from "./nerdacolo-question-texts.fr";

const TEXTS_BY_LOCALE: Record<Locale, QuestionTextCatalog | null> = {
  it: null,
  en: NERDACOLO_QUESTION_TEXTS_EN,
  es: NERDACOLO_QUESTION_TEXTS_ES,
  fr: NERDACOLO_QUESTION_TEXTS_FR,
  de: NERDACOLO_QUESTION_TEXTS_DE,
};

function applyTextOverlay(base: NerdacoloQuestion[], texts: QuestionTextCatalog): NerdacoloQuestion[] {
  return base.map(q => {
    const t = texts[q.id];
    if (!t) return q;
    return {
      ...q,
      text: t.text,
      subtitle: t.subtitle ?? q.subtitle,
      options: q.options.map(opt => {
        const ot = t.options[opt.id];
        if (!ot) return opt;
        return { ...opt, label: ot.label, funnyReaction: ot.funnyReaction };
      }),
    };
  });
}

const CACHE = new Map<Locale, NerdacoloQuestion[]>();

export function getNerdacoloQuestions(locale: Locale): NerdacoloQuestion[] {
  const loc = normalizeLocale(locale);
  const cached = CACHE.get(loc);
  if (cached) return cached;

  const texts = TEXTS_BY_LOCALE[loc];
  const questions = texts ? applyTextOverlay(NERDACOLO_QUESTIONS_IT, texts) : NERDACOLO_QUESTIONS_IT;
  CACHE.set(loc, questions);
  return questions;
}

export function questionById(locale: Locale, id: string): NerdacoloQuestion | undefined {
  return getNerdacoloQuestions(locale).find(q => q.id === id);
}

export function questionsForMode(
  mode: "movie" | "tv" | "surprise",
  locale: Locale = "it",
): NerdacoloQuestion[] {
  return getNerdacoloQuestions(locale).filter(q => {
    if (q.appliesTo === "both") return true;
    if (mode === "surprise") return true;
    return q.appliesTo === mode;
  });
}

/** @deprecated use questionById(locale, id) */
export function nerdacoloQuestionById(locale: Locale): Record<string, NerdacoloQuestion> {
  return Object.fromEntries(getNerdacoloQuestions(locale).map(q => [q.id, q]));
}
