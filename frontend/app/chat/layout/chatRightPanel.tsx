import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink, Database, X } from "lucide-react"
import { ChatMessageType } from "@/types/chat"
import { API_ENDPOINTS } from "@/services/api"

interface ImageItem {
  base64Data: string;
  contentType: string;
  isLoading: boolean;
  error?: string;
  loadAttempts?: number; // 加载尝试次数
}

interface SearchResult {
  title: string
  url: string
  text: string
  published_date: string
  source_type?: string
  filename?: string
  score?: number
  score_details?: any
  isExpanded?: boolean
}

interface ChatRightPanelProps {
  messages: ChatMessageType[]
  onImageError: (imageUrl: string) => void
  maxInitialImages?: number
  isVisible?: boolean
  toggleRightPanel?: () => void
  selectedMessageId?: string
}

export function ChatRightPanel({
  messages,
  onImageError,
  maxInitialImages = 4,
  isVisible = false,
  toggleRightPanel,
  selectedMessageId
}: ChatRightPanelProps) {
  // 本地状态
  const [expandedImages, setExpandedImages] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [processedImages, setProcessedImages] = useState<string[]>([])
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [imageData, setImageData] = useState<Record<string, ImageItem>>({})
  
  // 用来防止重复加载的引用
  const loadingImages = useRef<Set<string>>(new Set());

  // 获取当前选中的消息
  const currentMessage = messages.find(msg => msg.id === selectedMessageId);
  
  // 处理图片加载失败
  const handleImageLoadFail = useCallback((imageUrl: string) => {
    // 标记图片加载失败
    setImageData(prev => ({
      ...prev,
      [imageUrl]: {
        ...(prev[imageUrl] || {}),
        error: '图片加载失败',
        isLoading: false
      }
    }));
    
    // 从处理过的图片列表中移除
    setProcessedImages(prev => prev.filter(url => url !== imageUrl));
    
    // 调用错误处理函数
    onImageError(imageUrl);
  }, [onImageError]);

  // 加载图片
  const loadImage = async (imageUrl: string) => {
    // 如果已经在缓存中且不是加载中状态，直接返回
    if (imageData[imageUrl] && !imageData[imageUrl].isLoading) {
      return Promise.resolve();
    }
    
    // 如果正在加载中，防止重复请求
    if (loadingImages.current.has(imageUrl)) {
      return Promise.resolve();
    }
    
    // 标记为正在加载
    loadingImages.current.add(imageUrl);
    
    // 获取当前加载尝试次数
    const currentAttempts = imageData[imageUrl]?.loadAttempts || 0;
    
    // 如果尝试次数过多，不再继续尝试
    if (currentAttempts >= 3) {
      handleImageLoadFail(imageUrl);
      loadingImages.current.delete(imageUrl);
      return Promise.resolve();
    }
    
    // 标记为加载中
    setImageData(prev => ({
      ...prev,
      [imageUrl]: {
        base64Data: '',
        contentType: 'image/jpeg',
        isLoading: true,
        loadAttempts: currentAttempts + 1
      }
    }));
    
    try {
      // 使用代理服务获取图片
      const response = await fetch(API_ENDPOINTS.proxy.image(imageUrl));
      const data = await response.json();
      
      if (data.success) {
        setImageData(prev => ({
          ...prev,
          [imageUrl]: {
            base64Data: data.base64,
            contentType: data.content_type || 'image/jpeg',
            isLoading: false,
            loadAttempts: currentAttempts + 1
          }
        }));
      } else {
        // 如果加载失败，直接从列表中移除
        handleImageLoadFail(imageUrl);
      }
    } catch (error) {
      console.error('请求图片代理服务失败:', error);
      // 如果加载失败，直接从列表中移除
      handleImageLoadFail(imageUrl);
    } finally {
      // 无论成功失败，都移除正在加载标记
      loadingImages.current.delete(imageUrl);
    }
    
    return Promise.resolve();
  };

  // 监听消息变化，更新搜索结果和图片
  useEffect(() => {
    // 处理搜索结果
    if (currentMessage?.searchResults && Array.isArray(currentMessage.searchResults)) {
      try {
        const results = currentMessage.searchResults.map(result => {
          return {
            title: result.title || "未知标题",
            url: result.url || "#",
            text: result.text || "无内容描述",
            published_date: result.published_date || "",
            source_type: result.source_type || "url",
            filename: result.filename || "",
            score: typeof result.score === 'number' ? result.score : undefined,
            score_details: result.score_details || {},
            isExpanded: false
          };
        });
        setSearchResults(results);
      } catch (error) {
        console.error("处理搜索结果时出错:", error);
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
    
    // 处理图片
    if (currentMessage?.images && Array.isArray(currentMessage.images)) {
      // 获取并去重图片
      const allImages = currentMessage.images;
      
      // 过滤掉已经标记为加载失败的图片
      const validImages = allImages.filter(imageUrl => {
        return !(imageData[imageUrl] && imageData[imageUrl].error);
      });
      
      setProcessedImages(validImages);
      
      // 预加载图片，但只加载尚未加载的图片
      const loadPromises = validImages.map(imageUrl => {
        if (!imageData[imageUrl] || (imageData[imageUrl].error === undefined && !imageData[imageUrl].isLoading)) {
          return loadImage(imageUrl);
        }
        return Promise.resolve();
      });
      
      // 并行加载所有图片
      Promise.all(loadPromises).catch(error => {
        console.error('并行加载图片时出错:', error);
      });
    } else {
      setProcessedImages([]);
    }
  }, [currentMessage?.searchResults, currentMessage?.images, selectedMessageId]);

  // 辅助函数 - 格式化日期
  // 重构：通用服务函数，是否归纳到utils中
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return ""
      }
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      })
    } catch (error) {
      return ""
    }
  }

  // 辅助函数 - 格式化URL显示
  // 重构：通用服务函数，是否归纳到utils中
  const formatUrl = (result: SearchResult) => {
    try {
      if (!result.source_type) return ""
      
      if (result.source_type === "url") {
        if (!result.url || result.url === "#") return ""
        return result.url.replace(/(^\w+:|^)\/\//, '').split('/')[0]
      } else if (result.source_type === "file") {
        if (!result.filename) return ""
        return result.filename
      }
      return ""
    } catch (error) {
      return ""
    }
  }

  // 处理图片点击
  const handleImageClick = (imageUrl: string) => {
    setViewingImage(imageUrl);
  };

  // 搜索结果项组件
  const SearchResultItem = ({ result, index }: { result: SearchResult, index: number }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    // 确保所有必需的字段都有值
    const title = result.title || "未知标题";
    const url = result.url || "#";
    const text = result.text || "无内容描述";
    const published_date = result.published_date || "";
    const source_type = result.source_type || "url";

    return (
      <div className="p-3 rounded-lg border border-gray-200 text-xs hover:bg-gray-50 transition-colors">
        <div className="flex flex-col">
          <div>
            {source_type === "url" ? (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-medium text-blue-600 hover:underline block text-base"
              >
                {title}
              </a>
            ) : (
              <span className="font-medium block text-base">
                {title}
              </span>
            )}
            
            {published_date && (
              <div className="text-gray-500 mt-1 text-sm">
                {formatDate(published_date)}
              </div>
            )}
          </div>

          <div>
            <p className={`text-gray-700 mt-1 text-sm ${isExpanded ? '' : 'line-clamp-3'}`}>
              {text}
            </p>
          </div>

          <div className="mt-2 text-sm flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 flex-shrink-0 mr-1">
                {source_type === "url" ? (
                  <ExternalLink className="w-full h-full" />
                ) : source_type === "file" ? (
                  <Database className="w-full h-full" />
                ) : null}
              </div>
              <span className="text-gray-500 break-all">
                {formatUrl(result)}
              </span>
            </div>
            
            {text.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm text-gray-500 hover:text-gray-700 flex-shrink-0 ml-2 transition-colors"
              >
                {isExpanded ? "收起" : "展开"}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 渲染图片组件
  const renderImage = (imageUrl: string, index: number) => {
    const item = imageData[imageUrl];
    
    // 如果图片正在加载中
    if (!item || item.isLoading) {
      return (
        <div className="flex items-center justify-center w-full h-32 bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }
    
    // 如果图片加载失败，我们不应该显示它，但由于前面已经过滤，这里只是为了安全
    if (item.error || !item.base64Data) {
      return null;
    }
    
    // 返回base64图片
    return (
      <img
        src={`data:${item.contentType};base64,${item.base64Data}`}
        alt={`图片 ${index + 1}`}
        className="w-full h-32 object-cover"
        onError={(e) => {
          // 标记为图片加载失败并从列表中移除
          handleImageLoadFail(imageUrl);
        }}
      />
    );
  };

  // 重构：风格被嵌入在组件内
  return (
    <div className={`transition-all duration-300 ease-in-out ${
      isVisible ? 'lg:block w-[400px]' : 'lg:block w-0 opacity-0'
    } hidden border-l bg-background relative`}>
      {/* 图片查看器模态框 */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setViewingImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 z-50 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setViewingImage(null);
              }}
            >
              <X className="h-5 w-5" />
            </Button>
            {viewingImage && imageData[viewingImage] && !imageData[viewingImage].isLoading && imageData[viewingImage].base64Data ? (
              <img 
                src={`data:${imageData[viewingImage].contentType};base64,${imageData[viewingImage].base64Data}`}
                alt="查看大图" 
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              />
            ) : (
              <div className="flex items-center justify-center bg-black p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-none sticky top-0 z-20 flex items-center justify-between border-b p-2 bg-gray-50">
        <div className="flex items-center space-x-1">
          <h3 className="text-sm font-semibold text-gray-800 pl-2">
            网页 · 知识库搜索 
          </h3>
        </div>
        
        {toggleRightPanel && (
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-7 w-7 rounded hover:bg-gray-200"
            onClick={toggleRightPanel}
            title="关闭侧边栏"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
        <Tabs defaultValue="sources">
          <TabsList className="w-full">
            <TabsTrigger value="sources" className="flex-1">
            来源 
            {searchResults.length > 0 && (
              <span className="ml-1 bg-gray-200 inline-flex items-center justify-center rounded px-1 text-xs font-medium min-w-[20px] h-[18px]">
                {searchResults.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="images" className="flex-1">
            图片
            {processedImages.length > 0 && (
              <span className="ml-1 bg-gray-200 inline-flex items-center justify-center rounded px-1 text-xs font-medium min-w-[20px] h-[18px]">
                {processedImages.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto h-[calc(100vh-3rem)]">
        <TabsContent value="sources" className="p-4">
          <div className="space-y-2">
            {searchResults.length > 0 ? (
              <>
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <SearchResultItem 
                      key={`result-${index}`} 
                      result={result} 
                      index={index} 
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-4 text-base">
                暂无搜索结果
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="images" className="p-4">
          {processedImages.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {processedImages
                  .slice(0, expandedImages ? undefined : maxInitialImages)
                  .map((imageUrl: string, index: number) => (
                    <div
                      key={`img-${index}`}
                      className="relative border rounded-md overflow-hidden hover:border-blue-500 transition-colors cursor-pointer"
                      onClick={() => handleImageClick(imageUrl)}
                    >
                      {renderImage(imageUrl, index)}
                    </div>
                  ))}
              </div>
              
              {processedImages.length > maxInitialImages && (
                <div className="mt-4 text-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setExpandedImages(!expandedImages)}
                    className="w-full"
                  >
                    {expandedImages 
                      ? "收起图片" 
                      : `查看全部 ${processedImages.length} 张图片`}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
              <Database className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium mb-2">暂无图片</p>
              <p className="text-sm text-muted-foreground">
                这条消息没有关联的图片内容
              </p>
            </div>
          )}
        </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}