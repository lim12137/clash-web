'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { authService } from '@/services/authService';
import { EVENTS } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';

/**
 * 会话管理组件
 * 处理会话过期、会话刷新等功能
 */
export function SessionListeners() {
  const router = useRouter();
  const pathname = usePathname();
  const { confirm } = Modal;
  const { openLoginModal, setIsFromSessionExpired } = useAuth();
  const modalShownRef = useRef<boolean>(false);

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

      // 防止多次显示弹窗
      if (modalShownRef.current) return;
      
      // 首页不显示会话过期弹窗
      if (pathname === '/' || pathname?.startsWith('/?')) {
        return;
      }
      
      modalShownRef.current = true;

      // 显示确认对话框
      confirm({
        title: '登录已过期',
        icon: <ExclamationCircleOutlined />,
        content: '您的登录信息已过期，请重新登录以继续使用。',
        okText: '立即登录',
        cancelText: '返回首页',
        closable: false,
        onOk() {
          // 标记来源为会话过期
          setIsFromSessionExpired(true);
          openLoginModal();
          // 重置标记，允许下次再显示
          setTimeout(() => {
            modalShownRef.current = false;
          }, 500);
        },
        onCancel() {
          router.push('/');
          // 重置标记，允许下次再显示
          setTimeout(() => {
            modalShownRef.current = false;
          }, 500);
        }
      });
    };

    // 添加事件监听
    window.addEventListener(EVENTS.SESSION_EXPIRED, handleSessionExpired as EventListener);

    // 清理函数
    return () => {
      window.removeEventListener(EVENTS.SESSION_EXPIRED, handleSessionExpired as EventListener);
    };
  }, [router, confirm, pathname, openLoginModal, setIsFromSessionExpired]);

  // 会话状态检查
  useEffect(() => {
    // 首次加载时检查会话状态
    const checkSession = async () => {
      try {
        // 尝试获取当前会话
        const session = await authService.getSession();
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