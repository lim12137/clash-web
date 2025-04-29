"use client"

import { useAuth } from "@/hooks/useAuth"
import { useAuthForm, AuthFormValues } from "@/hooks/useAuthForm"
import { Modal, Form, Input, Button, Typography, Space } from "antd"
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons"
import { STATUS_CODES } from "@/types/auth"

const { Text } = Typography

export function RegisterModal() {
  const { isRegisterModalOpen, closeRegisterModal, openLoginModal, register, authServiceUnavailable } = useAuth()
  const { 
    form, 
    isLoading, 
    setIsLoading,
    emailError,
    setEmailError,
    handleEmailChange,
    resetForm
  } = useAuthForm()

  const handleSubmit = async (values: AuthFormValues) => {
    setIsLoading(true)
    setEmailError("") // 重置错误状态

    try {
      await register(values.email, values.password)
      
      // 表单重置和清除错误状态
      resetForm()

    } catch (error: any) {
      if (error?.code === STATUS_CODES.USER_EXISTS) {
        setEmailError("该邮箱已被注册")
        form.setFields([
          {
            name: "email",
            errors: ["该邮箱已被注册"],
            value: values.email
          },
        ]);
      } else {
        // 处理其他注册错误
        setEmailError("注册失败，请稍后重试")
        form.setFields([
          {
            name: "email",
            errors: ["注册失败，请稍后重试"],
            value: values.email
          },
        ]);
      }
    }

    setIsLoading(false)
  }

  const handleLoginClick = () => {
    resetForm()
    closeRegisterModal()
    openLoginModal()
  }

  const handleCancel = () => {
    resetForm()
    closeRegisterModal()
  }

  return (
    <Modal
      title={<div className="text-center text-xl font-bold">注册账号</div>}
      open={isRegisterModalOpen}
      onCancel={handleCancel}
      footer={null}
      width={400}
      centered
    >
      <Form 
        id="register-form"
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
            size="large"
            onChange={handleEmailChange}
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          help={authServiceUnavailable ? "认证服务当前不可用，请稍后重试" : ""}
          rules={[
            { required: true, message: "请输入密码" },
            { min: 6, message: "密码长度至少为6个字符" },
          ]}
          hasFeedback
        >
          <Input.Password 
            id="register-password"
            prefix={<LockOutlined className="text-gray-400" />} 
            placeholder="请输入密码" 
            size="large" 
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="确认密码"
          help={authServiceUnavailable ? "认证服务当前不可用，请稍后重试" : ""}
          dependencies={["password"]}
          hasFeedback
          rules={[
            { required: true, message: "请确认密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error("两次输入的密码不一致"))
              },
            }),
          ]}
        >
          <Input.Password 
            id="register-confirm-password"
            prefix={<SafetyOutlined className="text-gray-400" />} 
            placeholder="请确认密码" 
            size="large" 
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
            {isLoading ? "注册中..." : "注册"}
          </Button>
        </Form.Item>

        <div className="text-center">
          <Space>
            <Text type="secondary">已有账号？</Text>
            <Button type="link" onClick={handleLoginClick} className="p-0">
              立即登录
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  )
} 