"use client"

import i18n from "@/app/i18n"
import { I18nextProvider } from "react-i18next"
import { ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export default function I18nProviderWrapper({
  children,
}: {
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true)
  }, [])

  // 根据 URL 同步 i18n 语言
  useEffect(() => {
    if (!mounted) return;
    
    const segments = pathname.split('/').filter(Boolean);
    const urlLocale = segments[0];

    if (urlLocale === 'zh' || urlLocale === 'en') {
      if (i18n.language !== urlLocale) {
        i18n.changeLanguage(urlLocale);
      }
      document.cookie = `NEXT_LOCALE=${urlLocale}; path=/; max-age=31536000`;
    }
  }, [pathname, i18n, mounted]);
  
  if (!mounted) {
    return null
  }
  
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
} 