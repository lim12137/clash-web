import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import i18n from 'i18next';

// Utility function to get current language outside React components
export const getCurrentLanguage = (): string => {
  // Try to get from i18n first
  if (i18n.language) {
    return i18n.language;
  }
  
  // Fallback: try to get from cookie
  if (typeof document !== 'undefined') {
    const cookieMatch = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (cookieMatch) {
      return cookieMatch[1];
    }
  }
  
  // Fallback: try to get from URL if we're in browser
  if (typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const urlLocale = segments[0];
    if (urlLocale === 'zh' || urlLocale === 'en') {
      return urlLocale;
    }
  }
  
  // Default fallback
  return 'zh';
};

export const useLanguageSwitch = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { i18n } = useTranslation();

  const handleLanguageChange = (newLang: string) => {
    document.cookie = `NEXT_LOCALE=${newLang}; path=/; max-age=31536000`;
    
    // Compute new path: replace the first segment (locale) with newLang
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && (segments[0] === 'zh' || segments[0] === 'en')) {
      segments[0] = newLang;
    } else {
      segments.unshift(newLang);
    }
    const newPath = '/' + segments.join('/');
    
    // Force a full page reload to ensure proper language switching and component refresh
    window.location.href = newPath;
  };

  // Get the opposite language for switching (used in main page)
  const getOppositeLanguage = () => {
    return i18n.language === 'zh' ? { lang: 'en', label: 'English' } : { lang: 'zh', label: '中文' };
  };

  return {
    currentLanguage: i18n.language,
    handleLanguageChange,
    getOppositeLanguage
  };
}; 