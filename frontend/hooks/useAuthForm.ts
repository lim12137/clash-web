"use client"

import { useState } from "react"
import { Form } from "antd"

export interface AuthFormValues {
  email: string;
  password: string;
  confirmPassword: string;  // 移除可选标记，因为注册表单需要这个字段
  inviteCode?: string;
}

export function useAuthForm() {
  const [form] = Form.useForm<AuthFormValues>()
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState(false)

  // 重置所有错误
  const resetErrors = () => {
    setEmailError("")
    setPasswordError(false)
    form.setFields([
      {
        name: "email",
        errors: []
      },
      {
        name: "password",
        errors: []
      }
    ]);
  }

  // 处理邮箱输入变化
  const handleEmailChange = () => {
    if (emailError) {
      setEmailError("") 
      form.setFields([
        {
          name: "email",
          errors: []
        },
      ]);
    }
  }

  // 处理密码输入变化  
  const handlePasswordChange = () => {
    if (passwordError) {
      setPasswordError(false)
    }
  }

  // 重置表单
  const resetForm = () => {
    resetErrors()
    form.resetFields()
  }

  return {
    form,
    isLoading,
    setIsLoading,
    emailError,
    setEmailError,
    passwordError,
    setPasswordError,
    resetErrors,
    handleEmailChange,
    handlePasswordChange,
    resetForm
  }
} 