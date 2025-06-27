"use client"
import "../../app/[locale]/i18n"
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false)
  const { t, i18n } = useTranslation('common');
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true)
  }, [])

  // 根据 URL 同步 i18n 语言
  useEffect(() => {
    if (!mounted) return;
    
    const segments = pathname.split('/').filter(Boolean);
    const urlLocale = segments[0];
    
    if ((urlLocale === 'zh' || urlLocale === 'en') && i18n.language !== urlLocale) {
      i18n.changeLanguage(urlLocale);
    }
  }, [pathname, i18n, mounted]);
  
  if (!mounted) {
    return null
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

