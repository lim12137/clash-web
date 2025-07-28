export const languageOptions = [
  { label: '简体中文', value: 'zh' },
  { label: 'English', value: 'en' },
];

export const SUPPORTED_LOCALES = ['zh', 'en'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]; 