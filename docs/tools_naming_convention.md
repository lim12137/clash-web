# 工具类命名规范

## 文件命名规范

1. 工具类文件命名采用小写字母，单词之间用下划线连接
2. 文件名应该以 `_tool.py` 结尾
3. 文件名应该清晰表达工具的功能
4. 示例：
   - `exa_search_tool.py`
   - `knowledge_base_search_tool.py`

## 类命名规范

1. 类名采用大驼峰命名法（PascalCase）
2. 类名应该以 `Tool` 结尾
3. 类名应该清晰表达工具的功能
4. 示例：
   - `EXASearchTool`
   - `KnowledgeBaseSearchTool`

## 类属性命名规范

1. 类属性采用小写字母，单词之间用下划线连接
2. 必须包含以下属性：
   - `name`: 工具的唯一标识符，采用小写字母和下划线
   - `description`: 工具的功能描述
   - `inputs`: 输入参数的格式定义
   - `output_type`: 输出类型定义

## 方法命名规范

1. 公共方法采用小写字母，单词之间用下划线连接
2. 必须实现的方法：
   - `forward`: 工具的主要执行方法
3. 私有方法（如果存在）以下划线开头

## 示例

```python
class ExampleTool(Tool):
    name = "example_tool"
    description = "这是一个示例工具的描述"
    inputs = {
        "param1": {"type": "string", "description": "参数1的描述"}
    }
    output_type = "string"

    def forward(self, param1: str) -> str:
        # 实现工具的主要逻辑
        pass
```

## 注意事项

1. 所有工具类必须继承自 `Tool` 基类
2. 工具类应该专注于单一功能
3. 工具类的实现应该包含适当的错误处理
4. 工具类应该提供清晰的文档字符串
5. 工具类应该遵循 Python 的 PEP 8 编码规范
