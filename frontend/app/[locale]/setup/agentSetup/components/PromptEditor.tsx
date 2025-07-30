"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react'
import { defaultValueCtx, Editor, editorViewCtx, parserCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { nord } from '@milkdown/theme-nord'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import './milkdown-nord.css'

// Debounce utility function
const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay])
}

export interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function PromptEditor({ value, onChange, placeholder }: PromptEditorProps) {
  const [internalValue, setInternalValue] = useState(value)
  const isUserEditingRef = useRef(false)
  const lastExternalValueRef = useRef(value)
  const debouncedOnChange = useDebounce(onChange, 300)
  
  // Handle user input changes
  const handleUserChange = useCallback((newValue: string) => {
    isUserEditingRef.current = true
    setInternalValue(newValue)
    debouncedOnChange(newValue)
    setTimeout(() => {
      isUserEditingRef.current = false
    }, 500)
  }, [debouncedOnChange])
  
  // Handle external value changes - API streaming output
  useEffect(() => {
    if (value !== lastExternalValueRef.current && !isUserEditingRef.current) {
      setInternalValue(value)
      lastExternalValueRef.current = value
    }
  }, [value])

  const { get } = useEditor((root) => {
    return Editor
      .make()
      .config(ctx => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, value || '')

        // Configure listener for content changes
        const listenerManager = ctx.get(listenerCtx)
        listenerManager.markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            handleUserChange(markdown)
          }
        })
      })
      .config(nord)
      .use(commonmark)
      .use(listener)
  }, []) // Only create once when component mounts

  // When external value changes, directly update editor content without recreating editor
  useEffect(() => {
    const editor = get()
  
    if (editor && value !== internalValue && !isUserEditingRef.current) {
      try {
        editor.action(ctx => {
          const parser = ctx.get(parserCtx);
          const parsedNode = parser(value || '') || '';
          const newFragment = parsedNode.content; 

          const view = ctx.get(editorViewCtx);
          view.dispatch(
            view.state.tr.replaceWith(
              0,
              view.state.doc.content.size,
              newFragment
            )
          );
        })
        setInternalValue(value || '')
        lastExternalValueRef.current = value || ''
      } catch (error) {
        console.warn('Failed to update editor content directly:', error)
        setInternalValue(value || '')
        lastExternalValueRef.current = value || ''
      }
    }
  }, [value, internalValue, get])

  return (
    <div className="milkdown-editor-container h-full" style={{ overflow: 'hidden', height: '100%' }}>
      <Milkdown />
    </div>
  )
} 