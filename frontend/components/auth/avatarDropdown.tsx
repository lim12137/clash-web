"use client"

import { useAuth } from "@/hooks/useAuth"
import { Dropdown, Avatar, Spin, Button, Tag, ConfigProvider } from "antd"
import { UserOutlined, SettingOutlined, LogoutOutlined, UserSwitchOutlined, LoginOutlined, UserAddOutlined } from "@ant-design/icons"
import { getRoleColor, getRoleText } from "@/lib/auth"
import type { ItemType, MenuItemType } from "antd/es/menu/interface"
import { useState } from "react"

export function AvatarDropdown() {
  const { user, isLoading, logout, openLoginModal, openRegisterModal } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (isLoading) {
    return <Spin size="small" />
  }

  if (!user) {
    const items: ItemType[] = [
      {
        key: 'not-logged-in',
        label: (
          <div className="py-1">
            <div className="font-medium text-gray-500">您尚未登录</div>
          </div>
        ),
        className: 'cursor-default hover:bg-transparent',
        style: { 
          backgroundColor: 'transparent',
          cursor: 'default'
        }
      },
      {
        type: 'divider',
      },
      {
        key: 'login',
        icon: <LoginOutlined />,
        label: '登录',
        onClick: () => {
          setDropdownOpen(false);
          openLoginModal();
        }
      },
      {
        key: 'register',
        icon: <UserAddOutlined />,
        label: '注册',
        onClick: () => {
          setDropdownOpen(false);
          openRegisterModal();
        }
      }
    ]

    return (
      <ConfigProvider getPopupContainer={() => document.body}>
        <Dropdown 
          menu={{ items }} 
          placement="bottomRight" 
          arrow 
          trigger={['click']}
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          dropdownRender={(menu) => (
            <div style={{ minWidth: '120px' }}>
              {menu}
            </div>
          )}
          getPopupContainer={() => document.body}
        >
          <Button type="text" icon={<UserOutlined />} shape="circle" />
        </Dropdown>
      </ConfigProvider>
    )
  }

  // 用户已登录，展示用户菜单
  const menuItems: ItemType[] = [
    {
      key: 'user-info',
      label: (
        <div className="py-1">
          <div className="font-medium">{user.email}</div>
          <div className="mt-1">
            <Tag color={getRoleColor(user.role)}>{getRoleText(user.role)}</Tag>
          </div>
        </div>
      ),
      className: 'cursor-default hover:bg-transparent',
      style: { 
        backgroundColor: 'transparent',
        cursor: 'default'
      }
    },
    {
      type: 'divider',
    },
    {
      key: 'account',
      icon: <UserSwitchOutlined />,
      label: '账号信息',
    },
    ...(user.role === "admin"
      ? [
          {
            key: 'admin',
            icon: <SettingOutlined />,
            label: '管理设置',
          } as MenuItemType
        ]
      : []),
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {logout()},
    },
  ]

  return (
    <ConfigProvider getPopupContainer={() => document.body}>
      <Dropdown 
        menu={{ items: menuItems }} 
        placement="bottomRight" 
        arrow 
        trigger={['click']}
        getPopupContainer={() => document.body}
        dropdownRender={(menu) => (
          <div style={{ minWidth: '180px' }}>
            {menu}
          </div>
        )}
      >
        <Avatar 
          src={user.avatar_url} 
          className="cursor-pointer" 
          size="default" 
          icon={<UserOutlined />} 
        />
      </Dropdown>
    </ConfigProvider>
  )
} 