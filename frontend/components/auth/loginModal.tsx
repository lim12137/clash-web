"use client"

import { useAuth } from "@/hooks/useAuth"
import { useAuthForm } from "@/hooks/useAuthForm"
import { Modal, Form, Input, Button, Typography, Space } from "antd"
import { UserOutlined, LockOutlined } from "@ant-design/icons"
import { EVENTS, STATUS_CODES } from "@/types/auth"

const { Text } = Typography

export function LoginModal() {
  const { isLoginModalOpen, closeLoginModal, openRegisterModal, login, isFromSessionExpired, setIsFromSessionExpired, authServiceUnavailable } = useAuth()
  const {
    form,
    isLoading,
    setIsLoading,
    emailError,
    passwordError,
    setEmailError,
    setPasswordError,
    handleEmailChange,
    handlePasswordChange,
    resetForm
  } = useAuthForm()

  const handleSubmit = async (values: { email: string; password: string }) => {
    setEmailError("")
    setPasswordError(false)
    setIsLoading(true)

    try {
      await login(values.email, values.password)
      // 登录成功后重置会话过期标记
      setIsFromSessionExpired(false)
      // 重置弹窗控制状态，阻止登录成功后再次触发会话过期弹窗
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('modalClosed'))
      }, 200)
    } catch (error: any) {
      setEmailError("")
      setPasswordError(true)

      // 判断是否为服务器超时错误
      if (error?.code === STATUS_CODES.SERVER_ERROR || error?.code === STATUS_CODES.AUTH_SERVICE_UNAVAILABLE) {
        form.setFields([
          {
            name: "password",
            errors: ["认证服务当前不可用，请稍后重试"],
            value: values.password
          }
        ]);
      } else {
        form.setFields([
          {
            name: "email",
            errors: [""],
            value: values.email
          },
          {
            name: "password",
            errors: ["账号或密码错误，请重新输入"],
            value: values.password
          }
        ]);
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterClick = () => {
    resetForm()
    closeLoginModal()
    openRegisterModal()
  }

  const handleCancel = () => {
    resetForm()
    closeLoginModal()

    // 如果是从会话过期弹窗打开的登录框，则再次触发会话过期事件
    if (isFromSessionExpired) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(EVENTS.SESSION_EXPIRED, {
          detail: { message: "登录已过期，请重新登录" }
        }));
      }, 100);
    }
  }

  return (
    <Modal
      title={<div className="text-center text-xl font-bold">登录</div>}
      open={isLoginModalOpen}
      onCancel={handleCancel}
      footer={null}
      width={400}
      centered
      maskClosable={!isFromSessionExpired} // 会话过期场景下不允许点击蒙层关闭
      closable={!isFromSessionExpired} // 会话过期场景下不显示右上角关闭按钮
    >
      <Form 
        id="login-form"
        form={form} 
        layout="vertical" 
        onFinish={handleSubmit} 
        className="mt-6" 
        autoComplete="off"
      >
        <Form.Item
          name="email"
          label="邮箱地址"
          validateStatus={emailError ? "error" : ""}
          help={emailError}
          rules={[
            { required: true, message: "请输入邮箱地址" }
          ]}
        >
          <Input
            prefix={<UserOutlined className="text-gray-400" />}
            placeholder="your@email.com"
            onChange={handleEmailChange}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          validateStatus={passwordError ? "error" : ""}
          help={passwordError || authServiceUnavailable ? (authServiceUnavailable ? "认证服务当前不可用，请稍后重试" : "账号或密码错误，请重新输入") : ""}
          rules={[{ required: true, message: "请输入密码" }]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-gray-400" />}
            placeholder="请输入密码"
            onChange={handlePasswordChange}
            size="large"
            status={passwordError ? "error" : ""}
          />
        </Form.Item>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={isLoading} 
            block 
            size="large" 
            className="mt-2"
            disabled={authServiceUnavailable}
          >
            {isLoading ? "登录中..." : "登录"}
          </Button>
        </Form.Item>

        <div className="text-center">
          <Space>
            <Text type="secondary">还没有账号？</Text>
            <Button type="link" onClick={handleRegisterClick} className="p-0">
              立即注册
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  )
} 