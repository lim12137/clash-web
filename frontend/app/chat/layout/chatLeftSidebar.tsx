import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu"
import {
  Clock,
  Settings,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react"
import { ConversationListItem } from "@/types/chat" // 需要创建这个类型文件
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useConfig } from "@/hooks/useConfig"
import { useResponsiveTextSize } from "@/hooks/useResponsiveTextSize"
import { Spin, Tag, ConfigProvider } from "antd"
import { getRoleColor, getRoleText } from "@/lib/auth"
import { useAuth } from "@/hooks/useAuth"
import { extractColorsFromUri } from "@/lib/avatar"

interface ChatSidebarProps {
  conversationList: ConversationListItem[]
  selectedConversationId: number | null
  openDropdownId: string | null
  onNewConversation: () => void
  onDialogClick: (dialog: ConversationListItem) => void
  onRename: (dialogId: number, title: string) => void
  onDelete: (dialogId: number) => void
  onSettingsClick: () => void
  onDropdownOpenChange: (open: boolean, id: string | null) => void
  onToggleSidebar: () => void
  expanded: boolean
}

// 辅助函数 - 对话分类
const categorizeDialogs = (dialogs: ConversationListItem[]) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000
  
  const todayDialogs: ConversationListItem[] = []
  const weekDialogs: ConversationListItem[] = []
  const olderDialogs: ConversationListItem[] = []
  
  dialogs.forEach(dialog => {
    const dialogTime = dialog.update_time || dialog.create_time
    
    if (dialogTime >= today) {
      todayDialogs.push(dialog)
    } else if (dialogTime >= weekAgo) {
      weekDialogs.push(dialog)
    } else {
      olderDialogs.push(dialog)
    }
  })
  
  return {
    today: todayDialogs,
    week: weekDialogs,
    older: olderDialogs
  }
}

export function ChatSidebar({
  conversationList,
  selectedConversationId,
  openDropdownId,
  onNewConversation,
  onDialogClick,
  onRename,
  onDelete,
  onSettingsClick,
  onDropdownOpenChange,
  onToggleSidebar,
  expanded,
  userEmail,
  userAvatarUrl,
  userRole = "user",
}: ChatSidebarProps) {
  const { today, week, older } = categorizeDialogs(conversationList)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取用户认证状态
  const { isLoading: userAuthLoading } = useAuth();

  // 添加删除对话框状态
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dialogToDelete, setDialogToDelete] = useState<number | null>(null);
  
  // 使用配置系统获取头像内容
  const { appConfig, getAppAvatarUrl } = useConfig();

  const sidebarAvatarUrl = getAppAvatarUrl(16); // 侧边栏头像大小为16
  const collapsedAvatarUrl = getAppAvatarUrl(16); // 折叠状态的头像大小为16

  // 计算容器宽度 (300px - 图标宽度 - 按钮宽度 - 内边距)
  const containerWidth = 300 - 40 - 40 - 40; // 大约180px可用空间

  // 使用响应式文本大小hook
  const { textRef, fontSize } = useResponsiveTextSize(appConfig.appName, containerWidth);

  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Reset animation state when expanded changes
    setAnimationComplete(false);

    // Set animation complete after the transition duration (200ms)
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 200);

    return () => clearTimeout(timer);
  }, [expanded]);

  // 处理编辑开始
  const handleStartEdit = (dialogId: number, title: string) => {
    setEditingId(dialogId);
    setEditingTitle(title);
    // 关闭任何打开的下拉菜单
    onDropdownOpenChange(false, null);
    
    // 使用 setTimeout 确保 DOM 更新后聚焦输入框
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 10);
  };
  
  // 处理编辑提交
  const handleSubmitEdit = () => {
    if (editingId !== null && editingTitle.trim()) {
      onRename(editingId, editingTitle.trim());
      setEditingId(null);
    }
  };
  
  // 处理编辑取消
  const handleCancelEdit = () => {
    setEditingId(null);
  };
  
  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmitEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // 处理删除点击
  const handleDeleteClick = (dialogId: number) => {
    setDialogToDelete(dialogId);
    setIsDeleteDialogOpen(true);
    // 关闭下拉菜单
    onDropdownOpenChange(false, null);
  };

  // 确认删除
  const confirmDelete = () => {
    if (dialogToDelete !== null) {
      onDelete(dialogToDelete);
      setIsDeleteDialogOpen(false);
      setDialogToDelete(null);
    }
  };

  // 渲染应用图标
  const renderAppIcon = () => {
    return (
      <div className="h-8 w-8 rounded-full overflow-hidden mr-2">
        <img src={sidebarAvatarUrl} alt={appConfig.appName} className="h-full w-full object-cover" />
      </div>
    );
  };

  // 渲染对话列表项
  const renderDialogList = (dialogs: ConversationListItem[], title: string) => {
    if (dialogs.length === 0) return null;

    return (
      <div className="space-y-1">
        <p className="px-2 text-sm font-medium text-gray-500 tracking-wide font-sans sticky top-0 py-1 z-10" style={{ fontWeight:'bold',color:'#4d4d4d',backgroundColor: 'rgb(242 248 255)',fontSize:'16px', whiteSpace: 'nowrap' }}>{title}</p>
        {dialogs.map((dialog) => (
          <div 
            key={dialog.conversation_id} 
            className={`flex items-center group rounded-md ${
              selectedConversationId === dialog.conversation_id ? "bg-blue-100" : "hover:bg-slate-100"
            }`}
          >
            {editingId === dialog.conversation_id ? (
              // 编辑模式
              <div className="flex-1 px-3 py-2">
                <Input
                  ref={inputRef}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSubmitEdit}
                  className="h-8 text-base"
                  autoFocus
                />
              </div>
            ) : (
              // 显示模式
              <>
                <Button
                  variant="ghost"
                  className="flex-1 justify-start text-left hover:bg-transparent min-w-0"
                  onClick={() => onDialogClick(dialog)}
                >
                  <span className="truncate block text-base font-normal text-gray-800 tracking-wide font-sans">{dialog.conversation_title}</span>
                </Button>
                
                <DropdownMenu 
                  open={openDropdownId === dialog.conversation_id.toString()} 
                  onOpenChange={(open) => onDropdownOpenChange(open, dialog.conversation_id.toString())}
                >
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:border hover:border-slate-200 mr-1"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem onClick={() => handleStartEdit(dialog.conversation_id, dialog.conversation_title)}>
                      <Pencil className="mr-2 h-5 w-5" />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteClick(dialog.conversation_id)}
                    >
                      <Trash2 className="mr-2 h-5 w-5" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 渲染收起状态的侧边栏
  const renderCollapsedSidebar = () => {
    return (
      <>
        {/* 应用图标 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-start p-4 cursor-pointer" onClick={onToggleSidebar}>
                <div className="h-8 w-8 rounded-full overflow-hidden">
                  <img src={collapsedAvatarUrl} alt={appConfig.appName} className="h-full w-full object-cover" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {appConfig.appName}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-col flex-1 items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-14 w-14 rounded-full hover:bg-slate-100"
                  onClick={onToggleSidebar}
                >
                  <ChevronRight className="h-6 w-6" style={{height:'28px',width:'28px'}}/>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                展开边栏
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-14 w-14 rounded-full hover:bg-slate-100"
                  onClick={onNewConversation}
                >
                  <Plus className="h-6 w-6" style={{height:'20px',width:'20px'}}/>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                新对话
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 底部区域：用户状态/设置按钮 */}
        {userAuthLoading ? (
          <div className="py-2 flex justify-center">
            <div className="h-8 w-8 flex items-center justify-center">
              <Spin size="default" />
            </div>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="py-2 flex justify-center cursor-pointer">
                  <div className="h-8 w-8 rounded-full overflow-hidden" style={{ backgroundColor: "#f0f2f5" }}>
                    {userAvatarUrl ? (
                      <img src={userAvatarUrl} alt={userEmail || "用户"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              {userEmail && (
                <TooltipContent side="right">
                  {userEmail}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 设置按钮 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full hover:bg-slate-100"
                  onClick={onSettingsClick}
                >
                  <Settings className="h-6 w-6" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              设置
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );
  };

  const colors = extractColorsFromUri(appConfig.avatarUri || '');
  const mainColor = colors.mainColor || '273746';
  const secondaryColor = colors.secondaryColor || mainColor;

  return (
    <>
      <div className="hidden md:flex w-64 flex-col border-r border-transparent bg-primary/5 text-base transition-all duration-300 ease-in-out" style={{width: expanded ? '300px' : '70px'}}>
        {(expanded || !animationComplete) ? (
          <div className="hidden md:flex flex-col h-full">
            <div className="p-2 border-b border-transparent">
              <div className="flex items-center p-2">
                <div className="flex-1 min-w-0 flex items-center justify-start cursor-pointer" onClick={onToggleSidebar}>
                  <div>{renderAppIcon()}</div>
                  <h1
                    ref={textRef}
                    className="font-semibold truncate bg-clip-text text-transparent"
                    style={{ 
                      fontSize: `${fontSize}px`,
                      backgroundImage: `linear-gradient(180deg, #${mainColor} 0%, #${secondaryColor} 100%)`
                    }}
                  >
                    {appConfig.appName}
                  </h1>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 hover:bg-slate-100"
                  onClick={onToggleSidebar}
                >
                  <ChevronLeft className="h-7 w-7" style={{height:'28px',width:'28px'}}/>
                </Button>
              </div>
            </div>

            <div className="p-2">
              <Button variant="outline" className="w-full justify-start text-base overflow-hidden" onClick={onNewConversation}>
                <Plus className="mr-2 flex-shrink-0" style={{height:'20px', width:'20px'}}/>
                <span className="truncate">新对话</span>
              </Button>
            </div>

            <div className="flex-1 overflow-auto m-2 h-fit" >
              <div className="space-y-4">
                {conversationList.length > 0 ? (
                  <>
                    {renderDialogList(today, "今天")}
                    {renderDialogList(week, "7天内")}
                    {renderDialogList(older, "更早")}
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="px-2 text-sm font-medium text-muted-foreground">最近对话</p>
                    <Button variant="ghost" className="w-full justify-start">
                      <Clock className="mr-2 h-5 w-5" />
                      无历史对话
                    </Button>
                  </div>
                )}
              </div>
            </div>

          <div className="mt-auto p-3 border-t border-transparent flex justify-between items-center">
            {userAuthLoading ? (
              <div className="flex items-center">
                <div className="h-8 w-8 mr-2 flex items-center justify-center">
                  <Spin size="default" />
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  加载中...
                </span>
              </div>
            ) : (
              <ConfigProvider getPopupContainer={() => document.body}>
                <div className="flex items-center py-1 px-2">
                  <div className="h-8 w-8 rounded-full overflow-hidden mr-2">
                    {userAvatarUrl ? (
                      <img src={userAvatarUrl} alt={userEmail || "用户"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                            {userEmail || ""}
                          </div>
                        </TooltipTrigger>
                        {userEmail && (
                          <TooltipContent side="top">
                            {userEmail}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    {userRole && (
                      <Tag color={getRoleColor(userRole)} className="mt-1 cursor-auto w-fit">
                        {getRoleText(userRole)}
                      </Tag>
                    )}
                  </div>
                </div>
              </ConfigProvider>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-slate-100" 
              onClick={onSettingsClick}
            >
              <Settings className="h-8 w-8" />
            </Button>
          </div>
          </div>
        ) : (
          renderCollapsedSidebar()
        )}
      </div>
      
      {/* 删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>删除对话</DialogTitle>
            <DialogDescription>
              确定要删除这个对话吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}