"use client"

import { useState, useEffect } from "react"
import { Bot, Globe, Database, Zap, Mic, FileSearch, Shield, MessagesSquare, Microchip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { AvatarDropdown } from "@/components/auth/avatarDropdown"
import { LoginModal } from "@/components/auth/loginModal"
import { RegisterModal } from "@/components/auth/registerModal"
import { useAuth } from "@/hooks/useAuth"
import { Modal, ConfigProvider } from "antd"

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
  const { user, isLoading: userLoading, openLoginModal, openRegisterModal } = useAuth()
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [adminRequiredPromptOpen, setAdminRequiredPromptOpen] = useState(false)

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
    e.preventDefault()
    setAdminRequiredPromptOpen(true)
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
            <span className="text-blue-600 dark:text-blue-500 ml-2">Nexent 智能体</span>
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {userLoading ? (
            <span className="text-sm font-medium text-slate-600">
              加载中...
            </span>
          ) : user ? (
            <span className="text-sm font-medium text-slate-600">
              欢迎，{user.email}
            </span>
          ) : (
            <Link
              href="#"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
            >
              ModelEngine
            </Link>
          )}
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
          Nexent 智能体<span className="text-blue-600 dark:text-blue-500"> 一个提示词，无限种可能</span>
          </h2>
          <p className="max-w-2xl text-slate-600 dark:text-slate-300 text-lg md:text-xl mb-8">
          无需编排，无需复杂拖拉拽，将数据、模型和工具整合到一个智能中心中。
          </p>

          {/* Two parallel buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {user ? (
              <Link href="/chat">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <Bot className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                  开始问答
                </Button>
              </Link>
            ) : (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
                onClick={handleAuthRequired}
              >
                <Bot className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                开始问答
              </Button>
            )}

            {!user ? (
              // 未登录用户
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
                onClick={handleAuthRequired}
              >
                <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                快速配置
              </Button>
            ) : user.role === "admin" ? (
              // 管理员用户
              <Link href="/setup">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                  快速配置
                </Button>
              </Link>
            ) : (
              // 普通用户
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
                onClick={handleAdminRequired}
              >
                <Zap className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                快速配置
              </Button>
            )}
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Shield className="h-4 w-4" />
            <span>安全可靠的企业级数据保护</span>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-7xl mx-auto px-4 mb-6">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">核心功能</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Bot className="h-8 w-8 text-blue-500" />}
              title="多智能体自主业务决策"
              description="利用ReAct框架实现多智能体间的自主思考、任务规划、决策和执行，自动化MCP生态下的模型、数据与工具集"
            />
             <FeatureCard
              icon={<Zap className="h-8 w-8 text-blue-500" />}
              title="高效数据准备"
              description="企业级别的 Scalable 处理、切片、向量化数据框架，支撑构建基于不同文件格式、数据来源的高质量多模态知识库。"
            />
            <FeatureCard
              icon={<Globe className="h-8 w-8 text-emerald-500" />}
              title="多源知识获取与溯源"
              description="多种知识库、互联网等数据来源连接的MCP工具，基于业务决策数据获取方式，同时具备完整的多模态知识溯源与解释能力。"
            />
            <FeatureCard
              icon={<Microchip className="h-8 w-8 text-amber-500" />}
              title="MCP工具支持"
              description="支持MCP工具接入与调用，帮助实现更复杂的业务逻辑"
            />
            <FeatureCard
              icon={<FileSearch className="h-8 w-8 text-rose-500" />}
              title="知识溯源"
              description="提供完整的信息来源追溯，确保回答的可靠性和可验证性"
            />
            <FeatureCard
              icon={<MessagesSquare className="h-8 w-8 text-purple-500" />}
              title="多模态对话"
              description="基于多模态知识库、数据处理能力，提供多模态的智能体服务，支持文本、图像、音频等多种数据类型的输入输出。"
            />
          </div>
        </section>

        {/* Statistics data */}
        {/* <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">极致体验</h3>
        <section className="bg-slate-50 dark:bg-slate-800/50 py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center">
              <StatCard number="98.5%" label="问答准确率" />
              <StatCard number="100MB / 秒" label="数据处理速度" />
              <StatCard number="3秒内" label="平均响应时间" />
            </div>
          </div>
        </section> */}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                Nexent 智能体 © {new Date().getFullYear()}
              </span>
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="https://github.com/nexent-hub/nexent?tab=License-1-ov-file#readme"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                使用条款
              </Link>
              <Link
                href="http://nexent.tech/contact"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                联系我们
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* 登录提示对话框 */}
      <Modal
        title="登录账号"
        open={loginPromptOpen}
        onCancel={handleCloseLoginPrompt}
        footer={[
          <Button
            key="register"
            variant="link"
            onClick={handleRegisterClick}
            className="bg-white mr-2"
          >
            注册
          </Button>,
          <Button
            key="login"
            onClick={handleLoginClick}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            立即登录
          </Button>,
        ]}
        centered
      >
        <div className="py-2">
          <h3 className="text-base font-medium mb-2">🚀 准备启航！</h3>
          <p className="text-gray-600 mb-3">登录您的账户，开启智能问答之旅~</p>

          <div className="rounded-md mb-6 mt-3">
            <h3 className="text-base font-medium mb-1">✨ 登录后您将获得：</h3>
            <ul className="text-gray-600 pl-5 list-disc">
              <li>专属的对话历史记录</li>
              <li>个性化的智能推荐</li>
              <li>企业知识库完整访问权限</li>
              <li>更精准的问答体验</li>
            </ul>
          </div>

          <p className="text-gray-500 text-xs">还没有账号？点击"注册"按钮创建您的专属账号~</p>
        </div>
      </Modal>

      {/* 登录和注册模态框 */}
      <LoginModal />
      <RegisterModal />

      {/* 管理员提示对话框 */}
      <Modal
        title="啊哦，您不是管理员"
        open={adminRequiredPromptOpen}
        onCancel={handleCloseAdminPrompt}
        footer={[
          <Button
            key="close"
            onClick={handleCloseAdminPrompt}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            好的
          </Button>,
        ]}
        centered
      >
        <div className="py-2">
          <p className="text-gray-600">只有管理员可以调整配置，请先登录为管理员账号~</p>
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