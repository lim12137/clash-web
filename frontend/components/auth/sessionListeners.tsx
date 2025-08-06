'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { authService } from '@/services/authService';
import { EVENTS } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

/**
 * 会话管理组件
 * 处理会话过期、会话刷新等功能
 */
export function SessionListeners() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation('common');
  const { openLoginModal, setIsFromSessionExpired, logout } = useAuth();
  const modalShownRef = useRef<boolean>(false);

  /**
   * 显示"登录已过期"确认弹窗
   * 该函数负责防抖逻辑，避免弹窗重复出现
   */
  const showSessionExpiredModal = () => {
    // 若已显示过，则直接返回
    if (modalShownRef.current) return;
    
    // 修复：在首页不显示过期弹窗
    if (pathname === '/' || pathname?.startsWith('/?') || 
        pathname?.startsWith('/zh') || pathname?.startsWith('/en')) {
      return;
    }

    modalShownRef.current = true;

    Modal.confirm({
      title: t('login.expired.title'),
      icon: <ExclamationCircleOutlined />,
      content: t('login.expired.content'),
      okText: t('login.expired.okText'),
      cancelText: t('login.expired.cancelText'),
      closable: false,
      async onOk() {
        try {
          await logout(); // Log out first
        } finally {
          // Mark the source as session expired
          setIsFromSessionExpired(true);
          openLoginModal();
          setTimeout(() => (modalShownRef.current = false), 500);
        }
      },
      async onCancel() {
        try {
          await logout();
        } finally {
          router.push('/');
          setTimeout(() => (modalShownRef.current = false), 500);
        }
      }
    });
  };

  // 监听登录成功后的事件，重置modalShown状态
  useEffect(() => {
    const handleModalClosed = () => {
      modalShownRef.current = false;
    };

    // 添加事件监听
    document.addEventListener('modalClosed', handleModalClosed);

    // 清理函数
    return () => {
      document.removeEventListener('modalClosed', handleModalClosed);
    };
  }, []);

  // 监听会话过期事件
  useEffect(() => {
    const handleSessionExpired = (event: CustomEvent) => {
      // 修复：在首页不处理会话过期事件
      if (pathname === '/' || pathname?.startsWith('/?') || 
          pathname?.startsWith('/zh') || pathname?.startsWith('/en')) {
        return;
      }

      // 直接调用封装函数
      showSessionExpiredModal();
    };

    // 添加事件监听
    window.addEventListener(EVENTS.SESSION_EXPIRED, handleSessionExpired as EventListener);

    // 清理函数
    return () => {
      window.removeEventListener(EVENTS.SESSION_EXPIRED, handleSessionExpired as EventListener);
    };
  // 依赖数组中去掉 confirm，避免因函数引用变化导致重复注册
  }, [router, pathname, openLoginModal, setIsFromSessionExpired]);

  // 组件初次挂载时，如果发现本地已经没有 session，也立即弹窗
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const localSession = localStorage.getItem('session');
      // 修复：只在非首页且没有session时才弹窗
      if (!localSession && pathname && 
          pathname !== '/' && 
          !pathname.startsWith('/?') && 
          !pathname.startsWith('/zh') && 
          !pathname.startsWith('/en')) {
        showSessionExpiredModal();
      }
    }
    // 该副作用只需在首次渲染时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 会话状态检查
  useEffect(() => {
    // 首次加载时检查会话状态
    const checkSession = async () => {
      try {
        // 尝试获取当前会话
        const session = await authService.getSession();
        // 修复：只在chat路径且没有session时才触发过期事件
        if (!session && pathname?.startsWith('/chat')) {
          window.dispatchEvent(new CustomEvent(EVENTS.SESSION_EXPIRED, {
            detail: { message: "登录已过期，请重新登录" }
          }));
        }
      } catch (error) {
        console.error('检查会话状态出错:', error);
      }
    };

    checkSession();
  }, [pathname]);

  // 此组件不渲染UI元素
  return null;
} 