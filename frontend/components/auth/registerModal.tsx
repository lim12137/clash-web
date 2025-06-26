"use client"

import { useAuth } from "@/hooks/useAuth"
import { useAuthForm, AuthFormValues } from "@/hooks/useAuthForm"
import { Modal, Form, Input, Button, Typography, Space, Alert } from "antd"
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons"
import { STATUS_CODES } from "@/types/auth"
import { useState } from "react"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation('common');

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
        setEmailError(t('auth.emailExists'))
        form.setFields([
          {
            name: "email",
            errors: [t('auth.emailExists')],
            value: values.email
          },
        ]);
      } else {
        // Handle other registration errors
        setEmailError(t('auth.registrationFailed'))
        form.setFields([
          {
            name: "email",
            errors: [t('auth.registrationFailed')],
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
      setPasswordError(t('auth.passwordMinLength'))
      return // Exit early if password length is invalid
    }
    
    // Only check password match if length requirement is met
    setPasswordError("")
    const confirmPassword = form.getFieldValue("confirmPassword")
    if (confirmPassword && confirmPassword !== value) {
      setPasswordError(t('auth.passwordsDoNotMatch'))
    }
  }

  // Handle confirm password input change
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const password = form.getFieldValue("password")
    
    // First check if original password meets length requirement
    if (password && password.length < 6) {
      setPasswordError(t('auth.passwordMinLength'))
      return
    }
    
    // Then check password match
    if (value && value !== password) {
      setPasswordError(t('auth.passwordsDoNotMatch'))
    } else {
      setPasswordError("")
    }
  }

  return (
    <Modal
      title={<div className="text-center text-xl font-bold">{t('auth.registerTitle')}</div>}
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
          label={t('auth.emailLabel')}
          validateStatus={emailError ? "error" : ""}
          help={emailError}
          rules={[
            { required: true, message: t('auth.emailRequired') }
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
          label={t('auth.passwordLabel')}
          help={authServiceUnavailable ? t('auth.authServiceUnavailable') : ""}
          rules={[
            { required: true, message: t('auth.passwordRequired') },
            { min: 6, message: t('auth.passwordMinLength') },
          ]}
          hasFeedback
        >
          <Input.Password 
            id="register-password"
            prefix={<LockOutlined className="text-gray-400" />} 
            placeholder={t('auth.passwordRequired')} 
            size="large"
            onChange={handlePasswordChange}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={t('auth.confirmPasswordLabel')}
          help={authServiceUnavailable ? t('auth.authServiceUnavailable') : ""}
          dependencies={["password"]}
          hasFeedback
          rules={[
            { required: true, message: t('auth.confirmPasswordRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                const password = getFieldValue("password")
                // First check password length
                if (password && password.length < 6) {
                  setPasswordError(t('auth.passwordMinLength'))
                  return Promise.reject(new Error(t('auth.passwordMinLength')))
                }
                // Then check password match
                if (!value || getFieldValue("password") === value) {
                  setPasswordError("")
                  return Promise.resolve()
                }
                setPasswordError(t('auth.passwordsDoNotMatch'))
                return Promise.reject(new Error(t('auth.passwordsDoNotMatch')))
              },
            }),
          ]}
        >
          <Input.Password 
            id="register-confirm-password"
            prefix={<SafetyOutlined className="text-gray-400" />} 
            placeholder={t('auth.confirmPasswordRequired')} 
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
            {isLoading ? t('auth.registering') : t('auth.register')}
          </Button>
        </Form.Item>

        <div className="text-center">
          <Space>
            <Text type="secondary">{t('auth.hasAccount')}</Text>
            <Button type="link" onClick={handleLoginClick} className="p-0">
              {t('auth.loginNow')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  )
} 