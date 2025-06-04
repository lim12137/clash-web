"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

// New StaticScrollArea component that prevents auto-scrolling
const StaticScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div 
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div
        className="h-full w-full overflow-y-auto overflow-x-hidden pr-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db transparent',
        }}
      >
        <div className="pr-2">
          {children}
        </div>
      </div>
      
      {/* Custom scrollbar styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .overflow-y-auto::-webkit-scrollbar {
            width: 10px;
          }
          .overflow-y-auto::-webkit-scrollbar-track {
            background: transparent;
            border-left: 1px solid transparent;
            padding: 1px;
          }
          .overflow-y-auto::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 9999px;
            transition: background-color 0.2s;
          }
          .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }
          @media (prefers-color-scheme: dark) {
            .overflow-y-auto::-webkit-scrollbar-thumb {
              background: #4b5563;
            }
            .overflow-y-auto::-webkit-scrollbar-thumb:hover {
              background: #6b7280;
            }
          }
        `
      }} />
    </div>
  )
})
StaticScrollArea.displayName = "StaticScrollArea"

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-gray-300 dark:bg-gray-700 transition-colors hover:bg-gray-400 dark:hover:bg-gray-600" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, StaticScrollArea, ScrollBar }
