"use client"

import { useState } from "react"

import { Form } from "antd"
import { AuthFormValues } from "@/types/auth"

export function useAuthForm() {
  const [form] = Form.useForm<AuthFormValues>()
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState(false)

  // Reset all errors
  const resetErrors = () => {
    setEmailError("")
    setPasswordError(false)
  }

  // Handle email input change
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

  // Handle password input change  
  const handlePasswordChange = () => {
    if (passwordError) {
      setPasswordError(false)
    }
  }

  // Reset form
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