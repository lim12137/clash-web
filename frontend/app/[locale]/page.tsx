"use client"
import "./i18n"
import { useState, useEffect } from "react"
import { useTranslation } from 'react-i18next'
import { Bot, Globe, Database, Zap, Mic, FileSearch, Shield, MessagesSquare, Microchip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { useRouter, usePathname } from 'next/navigation';
import { Select } from "antd"

const languageOptions = [
  { label: '简体中文', value: 'zh' },
  { label: 'English', value: 'en' },
];

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const { t, i18n } = useTranslation('common');
  const [lang, setLang] = useState(i18n.language || 'zh');
  const router = useRouter();
  const pathname = usePathname();

  // Prevent hydration errors
  useEffect(() => {
    setMounted(true)
    setLang(i18n.language || 'zh')
  }, [])

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    const urlLocale = segments[0];
    if ((urlLocale === 'en' || urlLocale === 'zh') && i18n.language !== urlLocale) {
      i18n.changeLanguage(urlLocale);
    }
  }, [pathname, i18n]);

  // Language switch handler for dropdown
  const handleLangChange = (newLang: string) => {
    i18n.changeLanguage(newLang);
    setLang(newLang);
    document.cookie = `NEXT_LOCALE=${newLang}; path=/; max-age=31536000`;
    // Compute new path: replace the first segment (locale) with newLang
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && (segments[0] === 'zh' || segments[0] === 'en')) {
      segments[0] = newLang;
    } else {
      segments.unshift(newLang);
    }
    const newPath = '/' + segments.join('/');
    router.push(newPath);
  };

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Top navigation bar */}
      <header className="w-full py-4 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm fixed top-0 z-10">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-start">
            <img src="/modelengine-logo2.png" alt="ModelEngine" className="h-6" />
            <span className="text-blue-600 dark:text-blue-500 ml-2">{t("assistant.name")}</span>
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="http://nexent.tech"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            Nexent
          </Link>
          <Link
            href="http://modelengine-ai.net"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            ModelEngine
          </Link>
          <Link
            href="http://nexent.tech/contact"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            {t('page.contactUs')}
          </Link>
          <Link
            href="http://nexent.tech/about"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            {t('page.aboutUs')}
          </Link>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-32 pb-32">
        {/* Hero area */}
        <section className="relative w-full py-16 flex flex-col items-center justify-center text-center px-4">
          <div className="absolute inset-0 bg-grid-slate-200 dark:bg-grid-slate-800 [mask-image:radial-gradient(ellipse_at_center,white_20%,transparent_75%)] -z-10"></div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
          {t('page.title')}<span className="text-blue-600 dark:text-blue-500"> {t('page.subtitle')}</span>
          </h2>
          <p className="max-w-2xl text-slate-600 dark:text-slate-300 text-lg md:text-xl mb-8">
          {t('page.description')}
          </p>

          {/* Two parallel buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/chat">
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                <Bot className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                {t('page.startChat')}
              </Button>
            </Link>
            <Link href="/setup">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group">
                <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                {t('page.quickConfig')}
              </Button>
            </Link>
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Shield className="h-4 w-4" />
            <span>{t('page.dataProtection')}</span>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-7xl mx-auto px-4 mb-6">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">{t('page.coreFeatures')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(t('page.features', { returnObjects: true }) as Array<{title: string, description: string}>).map((feature, index: number) => {
              const icons = [
                <Bot key={0} className="h-8 w-8 text-blue-500" />,
                <Zap key={1} className="h-8 w-8 text-blue-500" />,
                <Globe key={2} className="h-8 w-8 text-emerald-500" />,
                <Microchip key={3} className="h-8 w-8 text-amber-500" />,
                <FileSearch key={4} className="h-8 w-8 text-rose-500" />,
                <MessagesSquare key={5} className="h-8 w-8 text-purple-500" />
              ];
              
              return (
                <FeatureCard
                  key={index}
                  icon={icons[index] || <Bot className="h-8 w-8 text-blue-500" />}
                  title={feature.title}
                  description={feature.description}
                />
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {t('page.copyright', { year: new Date().getFullYear() })}
              </span>
              <Select
                value={lang}
                onChange={handleLangChange}
                options={languageOptions}
                style={{ width: 98, border: 'none', boxShadow: 'none' }}
                variant={'borderless'}
              />
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="https://github.com/nexent-hub/nexent?tab=License-1-ov-file#readme"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                {t('page.termsOfUse')}
              </Link>
              <Link
                href="http://nexent.tech/contact"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                {t('page.contactUs')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="overflow-hidden border border-slate-200 dark:border-slate-700 transition-all duration-300 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 group">
      <CardContent className="p-6">
        <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-full w-fit group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
          {icon}
        </div>
        <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h4>
        <p className="text-slate-600 dark:text-slate-300">{description}</p>
      </CardContent>
    </Card>
  )
}

// Statistic card component
interface StatCardProps {
  number: string;
  label: string;
}

function StatCard({ number, label }: StatCardProps) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-500 mb-2">{number}</span>
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
    </div>
  )
}