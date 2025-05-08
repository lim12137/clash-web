import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Share,
  Bookmark,
  MoreHorizontal,
  Zap,
  LayoutDashboard
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ChatHeaderProps {
  title: string
  onShare?: () => void
  onRename?: (newTitle: string) => void
}

export function ChatHeader({
  title,
  onShare,
  onRename
}: ChatHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当title属性变化时更新editTitle
  useEffect(() => {
    setEditTitle(title);
  }, [title]);

  // 处理双击事件
  const handleDoubleClick = () => {
    setIsEditing(true);
    // 延迟聚焦以确保DOM已更新
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 10);
  };

  // 处理提交编辑
  const handleSubmit = () => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle && onRename && trimmedTitle !== title) {
      onRename(trimmedTitle);
    } else {
      setEditTitle(title); // 如果为空或未变更，恢复原标题
    }
    setIsEditing(false);
  };

  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setEditTitle(title);
      setIsEditing(false);
    }
  };

  // 重构：风格被嵌入在组件内
  return (
    <header className="border-b border-transparent bg-background z-10">
      <div className="p-3 pb-1">
        <div className="relative flex flex-1">
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
            {/* 左侧按钮区域 */}
          </div>

          <div className="w-full flex justify-center">
            <div className="max-w-3xl w-full flex justify-center mt-2 mb-0">
              {isEditing ? (
                <Input
                  ref={inputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSubmit}
                  className="text-xl font-bold text-center h-9 max-w-xs"
                  autoFocus
                />
              ) : (
                <h1 
                  className="text-xl font-bold cursor-pointer px-2 py-1 rounded border border-transparent hover:border-slate-200"
                  onDoubleClick={handleDoubleClick}
                  title="双击修改标题"
                >
                  {title}
                </h1>
              )}
            </div>
          </div>
          
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="cursor-pointer">
                  <Bookmark className="mr-2 h-4 w-4" />
                  <span>收藏</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={onShare}>
                  <Share className="mr-2 h-4 w-4" />
                  <span>分享</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
} 