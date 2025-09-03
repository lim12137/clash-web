"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { I18nextProvider } from "react-i18next";

import i18n from "@/app/i18n";

export default function I18nProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize i18n language according to the URL
  useEffect(() => {
    if (!mounted) return;

    const segments = pathname.split("/").filter(Boolean);
    const urlLocale = segments[0];

    if (urlLocale === "zh" || urlLocale === "en") {
      if (i18n.language !== urlLocale) {
        i18n.changeLanguage(urlLocale);
      }
      document.cookie = `NEXT_LOCALE=${urlLocale}; path=/; max-age=31536000`;
    }
  }, [pathname, i18n, mounted]);

  if (!mounted) {
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
