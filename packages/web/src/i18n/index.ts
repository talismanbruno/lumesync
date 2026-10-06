import { messages, type MessageKey } from './messages';

export type AppLanguage = 'en' | 'pt-BR';

// Migration paused at the user's request. Preserve the existing interface text
// until the remaining surfaces, error messages and both language flows are reviewed.
const translationsEnabled = false;

/** Match supported languages in device preference order; English is the fallback. */
export function resolveLanguage(preferences: readonly string[]): AppLanguage {
  for (const preference of preferences) {
    const language = preference.toLowerCase().split(/[-_]/)[0];
    if (language === 'pt') return 'pt-BR';
    if (language === 'en') return 'en';
  }
  return 'en';
}

export function getLanguage(): AppLanguage {
  const native = typeof window !== 'undefined' ? window.backspace?.preferredLanguages : undefined;
  const browser = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : [];
  return resolveLanguage(native?.length ? native : browser);
}

export function getLocale(): 'en-US' | 'pt-BR' {
  return getLanguage() === 'pt-BR' ? 'pt-BR' : 'en-US';
}

export function createTranslator(language: AppLanguage) {
  return (key: MessageKey, values: readonly unknown[] = []): string => {
    const template = messages[key][language === 'pt-BR' ? 1 : 0];
    return template.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
      const value = values[Number(index)];
      return value === undefined || value === null ? placeholder : String(value);
    });
  };
}

export function t(key: MessageKey, values: readonly unknown[] = []): string {
  if (translationsEnabled) return createTranslator(getLanguage())(key, values);
  const source = key.replaceAll('&rsquo;', '’').replaceAll('&lsquo;', '‘')
    .replaceAll('&bull;', '•').replaceAll('&times;', '×').replaceAll('&middot;', '·');
  return source.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const value = values[Number(index)];
    return value === undefined || value === null ? placeholder : String(value);
  });
}

/** Only translates exact catalog messages; never applies to user content. */
export function knownMessage(text: string): string | null {
  return Object.hasOwn(messages, text) ? t(text as MessageKey) : null;
}

export function initializeLanguage() {
  if (!translationsEnabled) return;
  document.documentElement.lang = getLanguage();
}
