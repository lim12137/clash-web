import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../../public/locales/en/common.json";
import zh from "../../public/locales/zh/common.json";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { common: en },
      zh: { common: zh },
    },
    lng: "zh", // default language
    fallbackLng: "en",
    ns: ["common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
