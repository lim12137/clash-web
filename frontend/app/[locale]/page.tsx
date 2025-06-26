"use client"
import "./i18n"
import { useState, useEffect } from "react"
import { Bot, Globe, Zap, FileSearch, Shield, MessagesSquare, Microchip, AlertTriangle } from "lucide-react"
import { useTranslation, Trans } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { AvatarDropdown } from "@/components/auth/avatarDropdown"
import { LoginModal } from "@/components/auth/loginModal"
import { RegisterModal } from "@/components/auth/registerModal"
import { useAuth } from "@/hooks/useAuth"
import { Modal, ConfigProvider } from "antd"
import { useRouter, usePathname } from 'next/navigation';
import { Select } from "antd"

const languageOptions = [
  { label: '简体中文', value: 'zh' },
  { label: 'English', value: 'en' },
];

export default function Home() {
  const [mounted, setMounted] = useState(false)
  
  // Prevent hydration errors
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <ConfigProvider getPopupContainer={() => document.body}>
      <FrontpageContent />
    </ConfigProvider>
  )
}

function FrontpageContent() {
  const { t, i18n } = useTranslation('common');
  const [lang, setLang] = useState(i18n.language || 'zh');
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: userLoading, openLoginModal, openRegisterModal } = useAuth()
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [adminRequiredPromptOpen, setAdminRequiredPromptOpen] = useState(false)

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

  // 处理需要登录的操作
  const handleAuthRequired = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault()
      setLoginPromptOpen(true)
    }
  }

  // 确认登录对话框
  const handleCloseLoginPrompt = () => {
    setLoginPromptOpen(false)
  }

  // 处理登录按钮点击
  const handleLoginClick = () => {
    setLoginPromptOpen(false)
    openLoginModal()
  }

  // 处理注册按钮点击
  const handleRegisterClick = () => {
    setLoginPromptOpen(false)
    openRegisterModal()
  }

  // 处理需要管理员权限的操作
  const handleAdminRequired = (e: React.MouseEvent) => {
    if (user?.role !== 'admin') {
      e.preventDefault()
      setAdminRequiredPromptOpen(true)
    }
  }

  // 关闭管理员提示框
  const handleCloseAdminPrompt = () => {
    setAdminRequiredPromptOpen(false)
  }

  // 重构：风格被嵌入在组件内
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
          {/* Github 按钮 */}
          <Link
            href="https://github.com/ModelEngine-Group/nexent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            <svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path></svg>
            Github
          </Link>
          {/* ModelEngine 链接始终显示 */}
          <Link
            href="http://modelengine-ai.net"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            ModelEngine
          </Link>
          {/* 登录状态切换显示 */}
          {userLoading ? (
            <span className="text-sm font-medium text-slate-600">
              {t("common.loading")}...
            </span>
          ) : user ? (
            <span className="text-sm font-medium text-slate-600">
              {user.email}
            </span>
          ) : null}
          <AvatarDropdown />
        </div>
        {/* 重构：链接是否合理 */}
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
            <Link href={user ? "/chat" : "#"} onClick={handleAuthRequired}>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                <Bot className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                {t('page.startChat')}
              </Button>
            </Link>

            <Link href={user?.role === 'admin' ? "/setup" : "#"} onClick={handleAdminRequired}>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                {t('page.quickConfig')}
              </Button>
            </Link>
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <AlertTriangle className="h-4 w-4" />
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

      {/* 登录提示对话框 */}
      <Modal
        title={t("page.loginPrompt.title")}
        open={loginPromptOpen}
        onCancel={handleCloseLoginPrompt}
        footer={[
          <Button
            key="register"
            variant="link"
            onClick={handleRegisterClick}
            className="bg-white mr-2"
          >
            {t("page.loginPrompt.register")}
          </Button>,
          <Button
            key="login"
            onClick={handleLoginClick}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {t("page.loginPrompt.login")}
          </Button>,
        ]}
        centered
      >
        <div className="py-2">
          <h3 className="text-base font-medium mb-2">{t("page.loginPrompt.header")}</h3>
          <p className="text-gray-600 mb-3">{t("page.loginPrompt.intro")}</p>

          <div className="rounded-md mb-6 mt-3">
            <h3 className="text-base font-medium mb-1">{t("page.loginPrompt.benefitsTitle")}</h3>
            <ul className="text-gray-600 pl-5 list-disc">
              {(t('page.loginPrompt.benefits', { returnObjects: true }) as string[]).map((benefit, i) => (
                <li key={i}>{benefit}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <p className="text-base font-medium">
              <Trans i18nKey="page.loginPrompt.githubSupport">
                ⭐️ Nexent is still growing, please help me by starring on <a
                  href="https://github.com/ModelEngine-Group/nexent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-bold"
                >
                  GitHub
                </a>, thank you.
              </Trans>
            </p>
          </div>
          <br />

          <p className="text-gray-500 text-xs">{t("page.loginPrompt.noAccount")}</p>
        </div>
      </Modal>

      {/* 登录和注册模态框 */}
      <LoginModal />
      <RegisterModal />

      {/* 管理员提示对话框 */}
      <Modal
        title={t("page.adminPrompt.title")}
        open={adminRequiredPromptOpen}
        onCancel={handleCloseAdminPrompt}
        footer={[
          <Button
            key="close"
            onClick={handleCloseAdminPrompt}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {t("page.adminPrompt.close")}
          </Button>,
        ]}
        centered
      >
        <div className="py-2">
          <p className="text-gray-600">{t("page.adminPrompt.intro")}</p>
        </div>
        <div className="py-2">
          <h3 className="text-base font-medium mb-2">{t("page.adminPrompt.unlockHeader")}</h3>
          <p className="text-gray-600 mb-3">{t("page.adminPrompt.unlockIntro")}</p>
          <div className="rounded-md mb-6 mt-3">
            <h3 className="text-base font-medium mb-1">{t("page.adminPrompt.permissionsTitle")}</h3>
            <ul className="text-gray-600 pl-5 list-disc">
              {(t('page.adminPrompt.permissions', { returnObjects: true }) as string[]).map((permission, i) => (
                <li key={i}>{permission}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <p className="text-base font-medium">
              <Trans i18nKey="page.adminPrompt.githubSupport">
                ⭐️ Nexent is still growing, please help me by starring on <a
                  href="https://github.com/ModelEngine-Group/nexent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-bold"
                >
                  GitHub
                </a>, thank you.
              </Trans>
              <br />
              <br />
              <Trans i18nKey="page.adminPrompt.becomeAdmin">
                💡 Want to become an administrator? Please visit the <a
                  href="http://nexent.tech/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-bold"
                >
                  official contact page
                </a> to apply for an administrator account.
              </Trans>
            </p>
          </div>
          <br />
        </div>
      </Modal>
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