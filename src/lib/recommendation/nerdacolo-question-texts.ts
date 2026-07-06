export type QuestionTextOverlay = {
  text: string;
  subtitle?: string;
  options: Record<string, { label: string; funnyReaction: string }>;
};
export type QuestionTextCatalog = Record<string, QuestionTextOverlay>;
