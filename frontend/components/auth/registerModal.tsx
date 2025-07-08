"use client"

import { useAuth } from "@/hooks/useAuth"
import { useAuthForm, AuthFormValues } from "@/hooks/useAuthForm"
import { Modal, Form, Input, Button, Typography, Space, Alert, Switch, Divider, message } from "antd"
import { UserOutlined, LockOutlined, SafetyOutlined, KeyOutlined, CrownOutlined } from "@ant-design/icons"
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
  const [isAdminMode, setIsAdminMode] = useState(false)
  const { t } = useTranslation('common');

  const validateEmail = (email: string): boolean => {
    if (!email) return false;
    
    if (!email.includes('@')) return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return !!(password && password.length >= 6);
  };

  const handleSubmit = async (values: AuthFormValues) => {
    setIsLoading(true)
    setEmailError("") // Reset error state
    setPasswordError("") // Reset password error state

    if (!validateEmail(values.email)) {
      const errorMsg = t('auth.invalidEmailFormat')
      message.error(errorMsg)
      setEmailError(errorMsg)
      setIsLoading(false)
      return;
    }

    if (!validatePassword(values.password)) {
      const errorMsg = t('auth.passwordMinLength')
      message.error(errorMsg)
      setPasswordError(errorMsg)
      setIsLoading(false)
      return;
    }

    try {
      await register(values.email, values.password, isAdminMode, values.inviteCode)
      
      // Reset form and clear error states
      resetForm()
      setIsAdminMode(false)

    } catch (error: any) {
      console.log("Registration error details:", error);

      if (error?.detail && Array.isArray(error.detail)) {
        const validationError = error.detail[0];
        
        if (validationError.loc && validationError.loc.includes('email')) {
          const errorMsg = t('auth.invalidEmailFormat')
          message.error(errorMsg)
          setEmailError(errorMsg)
          form.setFields([
            {
              name: "email",
              errors: [errorMsg],
              value: values.email
            },
          ]);
          setIsLoading(false)
          return;
        }
        
        if (validationError.loc && validationError.loc.includes('password')) {
          const errorMsg = t('auth.passwordMinLength')
          message.error(errorMsg)
          setPasswordError(errorMsg)
          setIsLoading(false)
          return;
        }
      }
      
      const errorType = error?.data?.error_type;
      
      if (error?.code === STATUS_CODES.USER_EXISTS || errorType === "EMAIL_ALREADY_EXISTS") {
        const errorMsg = t('auth.emailAlreadyExists')
        message.error(errorMsg)
        setEmailError(errorMsg)
        form.setFields([
          {
            name: "email",
            errors: [errorMsg],
            value: values.email
          },
        ]);
      } else if (errorType === "INVITE_CODE_NOT_CONFIGURED") {
        const errorMsg = t('auth.inviteCodeNotConfigured')
        message.error(errorMsg)
        setEmailError(errorMsg)
      } else if (errorType === "INVITE_CODE_REQUIRED") {
        const errorMsg = t('auth.inviteCodeRequired')
        message.error(errorMsg)
        form.setFields([
          {
            name: "inviteCode",
            errors: [errorMsg],
            value: values.inviteCode
          },
        ]);
      } else if (errorType === "INVITE_CODE_INVALID") {
        const errorMsg = t('auth.inviteCodeInvalid')
        message.error(errorMsg)
        form.setFields([
          {
            name: "inviteCode",
            errors: [errorMsg],
            value: values.inviteCode
          },
        ]);
      } else if (errorType === "WEAK_PASSWORD") {
        const errorMsg = t('auth.weakPassword')
        message.error(errorMsg)
        setPasswordError(errorMsg)
      } else if (errorType === "INVALID_EMAIL_FORMAT") {
        const errorMsg = t('auth.invalidEmailFormat')
        message.error(errorMsg)
        setEmailError(errorMsg)
        form.setFields([
          {
            name: "email",
            errors: [errorMsg],
            value: values.email
          },
        ]);
      } else if (errorType === "NETWORK_ERROR") {
        const errorMsg = t('auth.networkError')
        message.error(errorMsg)
        setEmailError(errorMsg)
      } else if (errorType === "REGISTRATION_SERVICE_ERROR") {
        const errorMsg = t('auth.registrationServiceError')
        message.error(errorMsg)
        setEmailError(errorMsg)
      } else {
        // 其他未知错误或没有error_type的情况，使用通用错误消息
        const errorMsg = t('auth.unknownError')
        message.error(errorMsg)
        setEmailError(errorMsg)
      }
    }

    setIsLoading(false)
  }

  const handleLoginClick = () => {
    resetForm()
    setPasswordError("")
    setIsAdminMode(false)
    closeRegisterModal()
    openLoginModal()
  }

  const handleCancel = () => {
    resetForm()
    setPasswordError("")
    setIsAdminMode(false)
    closeRegisterModal()
  }

  // 处理邮箱输入变化 - 实时验证邮箱格式
  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // 实时验证邮箱格式
    if (value && !validateEmail(value)) {
      setEmailError(t('auth.invalidEmailFormat'));
    } else {
      setEmailError("");
    }
  };

  // Handle password input change - 使用新的验证逻辑
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // 使用验证函数检查密码强度
    if (value && !validatePassword(value)) {
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

  // Handle confirm password input change - 使用新的验证逻辑
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const password = form.getFieldValue("password")
    
    // First check if original password meets length requirement
    if (password && !validatePassword(password)) {
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
          closable
          onClose={() => setPasswordError("")}
        />
      )}
      
      {emailError && !form.getFieldError("email").length && (
        <Alert
          message={emailError}
          type="error"
          showIcon
          className="mb-4"
          closable
          onClose={() => setEmailError("")}
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
            { required: true, message: t('auth.emailRequired') },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                if (!validateEmail(value)) {
                  return Promise.reject(new Error(t('auth.invalidEmailFormat')));
                }
                return Promise.resolve();
              }
            }
          ]}
        >
          <Input 
            prefix={<UserOutlined className="text-gray-400" />} 
            placeholder="your@email.com" 
            size="large"
            onChange={handleEmailInputChange}
          />
        </Form.Item>

        <Form.Item
          name="password"
          label={t('auth.passwordLabel')}
          help={authServiceUnavailable ? t('auth.authServiceUnavailable') : ""}
          rules={[
            { required: true, message: t('auth.passwordRequired') },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                if (!validatePassword(value)) {
                  return Promise.reject(new Error(t('auth.passwordMinLength')));
                }
                return Promise.resolve();
              }
            }
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
                // First check password length using validation function
                if (password && !validatePassword(password)) {
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

        <Divider />

        <Form.Item className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CrownOutlined className="text-amber-500" />
              <span className="font-medium">{t('auth.adminAccount')}</span>
            </div>
            <Switch 
              checked={isAdminMode}
              onChange={setIsAdminMode}
              checkedChildren={t('auth.admin')}
              unCheckedChildren={t('auth.user')}
            />
          </div>
          <Text type="secondary" className="text-sm mt-1 block">
            {t('auth.adminAccountDescription')}
          </Text>
        </Form.Item>

        {isAdminMode && (
          <>
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <div className="font-medium mb-2">{t('auth.inviteCodeHint.title')}</div>
                <div className="space-y-1">
                  <div>✨ {t('auth.inviteCodeHint.step1')}<a 
                    href="https://github.com/ModelEngine-Group/nexent" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {t('auth.inviteCodeHint.projectLink')}
                  </a>{t('auth.inviteCodeHint.starAction')}</div>
                  <div>🎁 {t('auth.inviteCodeHint.step2')}<a 
                    href="http://nexent.tech/contact" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {t('auth.inviteCodeHint.communityLink')}
                  </a>{t('auth.inviteCodeHint.step2Action')}</div>
                </div>
              </div>
            </div>
            <Form.Item
              name="inviteCode"
              label={t('auth.inviteCodeLabel')}
              rules={[
                { required: isAdminMode, message: t('auth.inviteCodeRequired') }
              ]}
            >
              <Input 
                prefix={<KeyOutlined className="text-gray-400" />} 
                placeholder={t('auth.inviteCodeRequired')} 
                size="large"
              />
            </Form.Item>
          </>
        )}

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
            {isLoading 
              ? (isAdminMode ? t('auth.registeringAdmin') : t('auth.registering'))
              : (isAdminMode ? t('auth.registerAdmin') : t('auth.register'))
            }
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