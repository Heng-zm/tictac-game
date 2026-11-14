/** The app ships English and Khmer copy; everything else falls back to English. */
export function isKhmer(languageCode?: string | null): boolean {
  return (languageCode ?? '').toLowerCase().startsWith('km');
}
