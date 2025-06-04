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
  const [isHovered, setIsHovered] = React.useState(false)
  const scrollAreaId = React.useId()

  return (
    <>
      {/* Global CSS styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .static-scroll-area-${scrollAreaId.replace(/:/g, '')} {
            height: 100%;
            width: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            padding-right: 16px;
            scrollbar-width: ${isHovered ? 'thin' : 'none'};
            scrollbar-color: ${isHovered ? '#d1d5db transparent' : 'transparent transparent'};
            transition: scrollbar-color 0.3s ease-in-out;
          }
          
          .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar {
            width: 10px;
          }
          
          .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar-thumb {
            background: ${isHovered ? '#d1d5db' : 'transparent'};
            border-radius: 9999px;
            transition: background-color 0.3s ease-in-out;
          }
          
          .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar-thumb:hover {
            background: #9ca3af !important;
          }
          
          .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar-thumb:active {
            background: #9ca3af !important;
          }
          
          @media (prefers-color-scheme: dark) {
            .static-scroll-area-${scrollAreaId.replace(/:/g, '')} {
              scrollbar-color: ${isHovered ? '#4b5563 transparent' : 'transparent transparent'};
            }
            
            .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar-thumb {
              background: ${isHovered ? '#4b5563' : 'transparent'};
            }
            
            .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar-thumb:hover {
              background: #6b7280 !important;
            }
            
            .static-scroll-area-${scrollAreaId.replace(/:/g, '')}::-webkit-scrollbar-thumb:active {
              background: #6b7280 !important;
            }
          }
        `
      }} />
      
      <div 
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <div
          className={`static-scroll-area-${scrollAreaId.replace(/:/g, '')}`}
        >
          <div className="pr-2">
            {children}
          </div>
        </div>
      </div>
    </>
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
