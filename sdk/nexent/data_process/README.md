# 数据清洗模块

这是一个基于Unstructured IO功能构建的数据清洗模块。该模块允许您处理和清洗各种类型的文档，包括PDF、docx、HTML、电子邮件等，提取干净的文本和元数据。

## 功能特点

- 处理文件、URL和原始文本内容
- 支持多源的批量处理
- 维护任务队列以实现并行处理
- 多线程并行清洗能力
- 任务状态跟踪和检索
- 任务信息持久化
- 标准化日志格式和状态管理

## 核心组件

### 1. DataProcessCore
核心组件，负责协调整个数据清洗流程：
- 管理任务创建和批量处理
- 维护任务状态
- 提供任务查询接口

### 2. AsyncTaskManager
异步任务管理器，负责：
- 创建和管理异步任务
- 处理任务状态更新
- 定期清理已完成任务

### 3. ProcessWorkerPool
工作池组件，负责：
- 多线程并行处理任务
- 数据清洗和转换
- 结果转发

### 4. TaskStore
任务存储组件，负责：
- 存储任务信息和状态
- 按索引和状态组织任务
- 提供任务查询接口

### 5. ExcelProcessor
Excel处理组件，负责：
- 处理Excel文件
- 提取表格内容
- 转换为结构化数据

## 支持的文档格式

| 文档类型 | 表格支持 | 策略选项 | 其他选项 |
|---------|---------|---------|---------|
| CSV文件 (.csv) | 是 | 无 | 无 |
| 电子邮件 (.eml) | 否 | 无 | 编码; 包含头信息; 最大分区; 处理附件 |
| 电子邮件 (.msg) | 否 | 无 | 编码; 最大分区; 处理附件 |
| 电子书 (.epub) | 是 | 无 | 包含分页符 |
| Excel文档 (.xlsx/.xls) | 是 | 无 | 无 |
| HTML页面 (.html/.htm) | 否 | 无 | 编码; 包含分页符 |
| 图像 (.png/.jpg/.jpeg/.tiff/.bmp/.heic) | 是 | "auto", "hi_res", "ocr_only" | 编码; 包含分页符; 推断表格结构; OCR语言, 策略 |
| Markdown (.md) | 是 | 无 | 包含分页符 |
| Org Mode (.org) | 是 | 无 | 包含分页符 |
| OpenOffice文档 (.odt) | 是 | 无 | 无 |
| PDF文档 (.pdf) | 是 | "auto", "fast", "hi_res", "ocr_only" | 编码; 包含分页符; 推断表格结构; 最大分区; OCR语言, 策略 |
| 纯文本 (.txt/.text/.log) | 否 | 无 | 编码; 最大分区; 段落分组 |
| PowerPoint (.ppt) | 是 | 无 | 包含分页符 |
| PowerPoint (.pptx) | 是 | 无 | 包含分页符 |
| ReStructured Text (.rst) | 是 | 无 | 包含分页符 |
| 富文本 (.rtf) | 是 | 无 | 包含分页符 |
| TSV文件 (.tsv) | 是 | 无 | 无 |
| Word文档 (.doc) | 是 | 无 | 包含分页符 |
| Word文档 (.docx) | 是 | 无 | 包含分页符 |
| XML文档 (.xml) | 否 | 无 | 编码; 最大分区; XML保留标签 |
| 代码文件 (.js/.py/.java/.cpp/.cc/.cxx/.c/.cs/.php/.rb/.swift/.ts/.go) | 否 | 无 | 编码; 最大分区; 段落分组 |

## 安装

```bash
# 安装依赖
pip install -r requirements.txt

# 或单独安装包
pip install unstructured fastapi uvicorn pydantic httpx python-dotenv
```

## 使用方法

### 程序化使用

```python
from nexent.data_process.core import DataProceeCore

# 初始化核心组件
core = DataProceeCore(num_workers=3)

# 启动核心组件
await core.start()

# 创建单个任务
task_id = await core.create_task(
    source="path/to/file.pdf",
    source_type="file",
    chunking_strategy="basic"
)

# 创建批量任务
sources = [
    {"source": "path/to/doc1.pdf", "source_type": "file"},
    {"source": "path/to/doc2.docx", "source_type": "file"}
]
task_ids = await core.create_batch_tasks(sources)

# 获取任务状态
task = core.get_task(task_id)
print(f"任务状态: {task['status']}")

# 获取所有任务
all_tasks = core.get_all_tasks()

# 获取特定索引的任务
index_tasks = core.get_index_tasks("my_index")

# 完成后停止服务
await core.stop()
```

## 任务状态

数据清洗任务的完整工作流包括以下状态:

- `WAITING`: 任务已创建但尚未处理
- `PROCESSING`: 任务正在进行数据清洗
- `FORWARDING`: 数据清洗完成，正在将结果转发
- `COMPLETED`: 任务已完成
- `FAILED`: 任务失败，检查error字段了解失败原因

## 日志系统

模块使用自定义的日志格式化输出：

```
LEVEL    - SOURCE  - TASK ID                         - STAGE      - MESSAGE
```

例如:
```
INFO    - core    - TASK f47ac10b-58cc-4372-a567-0e02b2c3d479 - PROCESSING - Processing source: example.pdf (file)
```

## unstructured依赖安装
``` shell
pip install "unstructured[all-docs]"
```
安装完成之后，还需要安装以下系统依赖libmagic, poppler, libreoffice, pandoc, tesseract.
### poppler安装
```shell
conda install -c conda-forge poppler
pip install pdftotext
```
### tesseract windows安装
1. 下载并安装tesseract-ocr-*.exe
```
https://tesseract-ocr.github.io/tessdoc/Installation.html
```
2. 配置系统环境变量
```
C:\Program Files\Tesseract-OCR
```
3. 新建系统变量

变量名：
```
TESSDATA_PREFIX
```
变量值：
```
C:\Program Files\Tesseract-OCR\tessdata
```
4. 重启电脑
