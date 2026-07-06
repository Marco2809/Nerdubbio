import type { Locale } from '@/lib/i18n';
import { api } from '@/lib/php/client';

export interface TranslateResult {
  text: string;
  provider: string;
  target: string;
  source: string | null;
}

export const translateApi = {
  translate(
    text: string,
    target: Locale,
    source?: Locale,
  ): Promise<TranslateResult> {
    return api<TranslateResult>('/api/translate.php?action=translate', 'POST', {
      text,
      target,
      source,
    });
  },
};
