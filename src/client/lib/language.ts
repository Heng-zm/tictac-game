/** The app ships English and Khmer copy; everything else falls back to English. */
export type SupportedLanguage = 'en' | 'km';

export function isKhmer(languageCode?: string | null): boolean {
  return (languageCode ?? '').toLowerCase().startsWith('km');
}

export function normalizeLanguage(languageCode?: string | null): SupportedLanguage {
  return isKhmer(languageCode) ? 'km' : 'en';
}

export function getNextLanguage(currentLanguage?: string | null): SupportedLanguage {
  return isKhmer(currentLanguage) ? 'en' : 'km';
}

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  englishLabel: string;
  flagAlt: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  {
    code: 'km',
    label: 'ភាសាខ្មែរ',
    nativeLabel: 'ភាសាខ្មែរ',
    englishLabel: 'Khmer',
    flagAlt: 'Cambodia flag',
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    englishLabel: 'English',
    flagAlt: 'United Kingdom flag',
  },
] as const;

