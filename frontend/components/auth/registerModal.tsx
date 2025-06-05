"use client"

import { useAuth } from "@/hooks/useAuth"
import { useAuthForm, AuthFormValues } from "@/hooks/useAuthForm"
import { Modal, Form, Input, Button, Typography, Space, Alert } from "antd"
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons"
import { STATUS_CODES } from "@/types/auth"
import { useState } from "react"

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
  const [passwordError, setPasswordError] = useState("")

  const handleSubmit = async (values: AuthFormValues) => {
    setIsLoading(true)
    setEmailError("") // Reset error state
    setPasswordError("") // Reset password error state

    try {
      await register(values.email, values.password)
      
      // Reset form and clear error states
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
        // Handle other registration errors
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
    setPasswordError("")
    closeRegisterModal()
    openLoginModal()
  }

  const handleCancel = () => {
    resetForm()
    setPasswordError("")
    closeRegisterModal()
  }

  // Handle password input change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // First priority: check password length
    if (value && value.length < 6) {
      setPasswordError("密码长度至少为6个字符")
      return // Exit early if password length is invalid
    }
    
    // Only check password match if length requirement is met
    setPasswordError("")
    const confirmPassword = form.getFieldValue("confirmPassword")
    if (confirmPassword && confirmPassword !== value) {
      setPasswordError("两次输入的密码不一致")
    }
  }

  // Handle confirm password input change
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const password = form.getFieldValue("password")
    
    // First check if original password meets length requirement
    if (password && password.length < 6) {
      setPasswordError("密码长度至少为6个字符")
      return
    }
    
    // Then check password match
    if (value && value !== password) {
      setPasswordError("两次输入的密码不一致")
    } else {
      setPasswordError("")
    }
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
      {passwordError && (
        <Alert
          message={passwordError}
          type="error"
          showIcon
          className="mb-4"
        />
      )}
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
            onChange={handlePasswordChange}
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
                const password = getFieldValue("password")
                // First check password length
                if (password && password.length < 6) {
                  setPasswordError("密码长度至少为6个字符")
                  return Promise.reject(new Error("密码长度至少为6个字符"))
                }
                // Then check password match
                if (!value || getFieldValue("password") === value) {
                  setPasswordError("")
                  return Promise.resolve()
                }
                setPasswordError("两次输入的密码不一致")
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
            onChange={handleConfirmPasswordChange}
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