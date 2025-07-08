# DataProcessCore 使用指南

## 概述

`DataProcessCore` 是一个统一的文件处理核心类，支持多种文件格式的自动检测和处理，提供灵活的分块策略和多种输入源支持。

## 主要功能

### 1. 核心处理方法：`file_process()`

**函数签名：**
```python
def file_process(self, 
                file_path_or_url: Optional[str] = None, 
                file_data: Optional[bytes] = None, 
                chunking_strategy: str = "basic", 
                destination: str = "local", 
                filename: Optional[str] = None, 
                **params) -> List[Dict]
```

**参数说明：**

| 参数名 | 类型 | 必需 | 描述 | 可选值 |
|--------|------|------|------|--------|
| `file_path_or_url` | `str` | 否* | 本地文件路径或远程URL | 任何有效的文件路径或URL |
| `file_data` | `bytes` | 否* | 文件的字节数据（用于内存处理） | 任何有效的字节数据 |
| `chunking_strategy` | `str` | 否 | 分块策略 | `"basic"`, `"by_title"`, `"none"` |
| `destination` | `str` | 否 | 目标类型，指示文件来源 | `"local"`, `"minio"`, `"url"` |
| `filename` | `str` | 否** | 文件名 | 任何有效的文件名 |
| `**params` | `dict` | 否 | 额外的处理参数 | 见下方参数详情 |

*注：`file_path_or_url` 和 `file_data` 必须提供其中一个
**注：使用 `file_data` 时，`filename` 为必需参数

**分块策略 (`chunking_strategy`) 详解：**

| 策略值 | 描述 | 适用场景 | 输出特点 |
|--------|------|----------|----------|
| `"basic"` | 基础分块策略 | 大多数文档处理场景 | 根据内容长度自动分块 |
| `"by_title"` | 按标题分块 | 结构化文档（如技术文档、报告） | 以标题为界限进行分块 |
| `"none"` | 不分块 | 短文档或需要完整内容的场景 | 返回单个包含全部内容的块 |

**目标类型 (`destination`) 详解：**

| 目标值 | 描述 | 使用场景 | 要求 |
|--------|------|----------|------|
| `"local"` | 本地文件 | 处理本地存储的文件 | 提供有效的本地文件路径 |
| `"minio"` | MinIO存储 | 处理云存储中的文件 | 需要数据库依赖 |
| `"url"` | 远程URL | 处理网络资源 | 需要数据库依赖 |

**额外参数 (`**params`) 详解：**

| 参数名 | 类型 | 默认值 | 描述 | 适用处理器 |
|--------|------|--------|------|-----------|
| `max_characters` | `int` | `1500` | 每个块的最大字符数 | Generic |
| `new_after_n_chars` | `int` | `1200` | 达到此字符数后开始新块 | Generic |
| `strategy` | `str` | `"fast"` | 处理策略 | Generic |
| `skip_infer_table_types` | `list` | `[]` | 跳过推断的表格类型 | Generic |
| `task_id` | `str` | `""` | 任务标识符 | Generic |

**返回值格式：**

返回 `List[Dict]`，每个字典包含以下字段：

**通用字段：**
| 字段名 | 类型 | 描述 | 示例 |
|--------|------|------|------|
| `content` | `str` | 文本内容 | `"这是文档的第一段..."` |
| `path_or_url` | `str` | 文件路径或URL | `"/path/to/file.pdf"` |
| `filename` | `str` | 文件名 | `"document.pdf"` |

**Excel文件额外字段：**
| 字段名 | 类型 | 描述 | 示例 |
|--------|------|------|------|
| `metadata` | `dict` | 元数据信息 | `{"chunk_index": 0, "file_type": "xlsx"}` |

**Generic文件额外字段：**
| 字段名 | 类型 | 描述 | 示例 |
|--------|------|------|------|
| `language` | `str` | 语言标识（可选） | `"en"` |
| `metadata` | `dict` | 元数据信息（可选） | `{"chunk_index": 0}` |

## 支持的文件类型

### Excel文件
- `.xlsx` - Excel 2007及更高版本
- `.xls` - Excel 97-2003版本

### 通用文件
- `.txt` - 纯文本文件
- `.pdf` - PDF文档
- `.docx` - Word 2007及更高版本
- `.doc` - Word 97-2003版本
- `.html`, `.htm` - HTML文档
- `.md` - Markdown文件
- `.rtf` - 富文本格式
- `.odt` - OpenDocument文本
- `.pptx` - PowerPoint 2007及更高版本
- `.ppt` - PowerPoint 97-2003版本

## 使用示例

### 示例1：处理本地文本文件
```python
from nexent.data_process import DataProcessCore

core = DataProcessCore()

# 基础处理
result = core.file_process(
    file_path_or_url="/path/to/document.txt",
    destination="local",
    chunking_strategy="basic"
)

print(f"处理得到 {len(result)} 个块")
for i, chunk in enumerate(result):
    print(f"块 {i}: {chunk['content'][:100]}...")
```

### 示例2：处理Excel文件
```python
# 处理Excel文件
result = core.file_process(
    file_path_or_url="/path/to/spreadsheet.xlsx",
    destination="local",
    chunking_strategy="none"  # Excel通常不需要分块
)

for chunk in result:
    print(f"文件: {chunk['filename']}")
    print(f"内容: {chunk['content']}")
    print(f"元数据: {chunk['metadata']}")
```

### 示例3：处理内存中的文件
```python
# 读取文件到内存
with open("/path/to/document.pdf", "rb") as f:
    file_bytes = f.read()

# 处理内存中的文件
result = core.file_process(
    file_data=file_bytes,
    filename="document.pdf",
    chunking_strategy="by_title",
    max_characters=2000  # 自定义参数
)
```

### 示例4：处理远程文件（需要数据库依赖）
```python
# 处理MinIO中的文件
result = core.file_process(
    file_path_or_url="minio://bucket/path/to/file.docx",
    destination="minio",
    filename="file.docx",
    chunking_strategy="basic"
)
```

## 辅助方法

### 1. 获取支持的文件类型
```python
core = DataProcessCore()
supported_types = core.get_supported_file_types()
print("Excel文件:", supported_types["excel"])
print("通用文件:", supported_types["generic"])
```

### 2. 验证文件类型
```python
is_supported = core.validate_file_type("document.pdf")
print(f"PDF文件是否支持: {is_supported}")
```

### 3. 获取处理器信息
```python
info = core.get_processor_info("spreadsheet.xlsx")
print(f"处理器类型: {info['processor_type']}")
print(f"文件扩展名: {info['file_extension']}")
print(f"是否支持: {info['is_supported']}")
```

### 4. 获取支持的策略和目标类型
```python
strategies = core.get_supported_strategies()
destinations = core.get_supported_destinations()
print(f"支持的分块策略: {strategies}")
print(f"支持的目标类型: {destinations}")
```

## 错误处理

### 常见异常

| 异常类型 | 触发条件 | 解决方案 |
|----------|----------|----------|
| `ValueError` | 参数无效（如同时提供file_path_or_url和file_data） | 检查参数组合 |
| `FileNotFoundError` | 本地文件不存在或远程文件无法获取 | 验证文件路径 |
| `ImportError` | 处理远程文件时缺少数据库依赖 | 安装相关依赖 |

### 错误处理示例
```python
try:
    result = core.file_process(
        file_path_or_url="/nonexistent/file.txt",
        destination="local"
    )
except FileNotFoundError as e:
    print(f"文件未找到: {e}")
except ValueError as e:
    print(f"参数错误: {e}")
except Exception as e:
    print(f"处理失败: {e}")
```

## 性能优化建议

1. **选择合适的分块策略**：
   - 小文件使用 `"none"`
   - 大文件使用 `"basic"`
   - 结构化文档使用 `"by_title"`

2. **调整分块参数**：
   - 根据下游处理需求调整 `max_characters`
   - 平衡处理速度和内存使用

3. **文件类型优化**：
   - Excel文件通常不需要分块
   - PDF文件建议使用较大的 `max_characters`

4. **批量处理**：
   - 复用 `DataProcessCore` 实例
   - 避免重复初始化