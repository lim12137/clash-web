# 后端测试套件

## 运行测试

`run_all_test.py` 脚本允许您运行所有后端测试并生成覆盖率报告。

### 如何运行

```bash
python test/backend/run_all_test.py
```

或者从 test/backend 目录中运行：

```bash
python run_all_test.py
```

### 包含内容

测试套件自动执行以下操作：

1. 发现并运行所有符合 `test_*.py` 模式的测试文件，位于：
   - `test/backend/app/` 目录
   - `test/backend/services/` 目录

2. 为后端代码生成代码覆盖率报告：
   - 控制台输出，包含逐行覆盖率详情
   - HTML 覆盖率报告，位于 `test/backend/coverage_html/`
   - XML 覆盖率报告，位于 `test/backend/coverage.xml`

3. 提供测试结果摘要：
   - 运行的测试总数
   - 通过/失败的测试数量
   - 整体通过率
   - 代码覆盖率百分比

### 依赖项

脚本会自动安装所需的包（如果尚未安装）：
- `pytest-cov`
- `coverage`

## 测试框架和方法

### 测试框架

后端测试主要使用：
- **unittest**：Python 标准单元测试框架，用于测试组织和断言
- **unittest.mock**：用于模拟依赖项和隔离组件
- **TestClient**（来自 FastAPI）：用于测试 API 端点，无需运行实际服务器

### 测试策略

测试文件遵循以下关键原则：

1. **依赖隔离**：
   - 在导入前模拟外部模块，以避免真实连接
   - 模拟数据库连接、ElasticSearch 和其他外部服务
   - 测试过程中不执行实际的数据库操作

2. **基于模拟的测试**：
   - 使用 FastAPI 的 TestClient 模拟 HTTP 请求
   - 拦截外部服务调用，替换为模拟对象
   - 不进行实际的网络连接或端口绑定

3. **测试组织**：
   - 测试被组织为继承自 `unittest.TestCase` 的类
   - 每个 API 端点或函数有多个测试用例（成功、失败、异常场景）
   - 应用全面的补丁以隔离被测试的代码

4. **API 测试**：
   - 测试 API 端点的正确响应代码、负载结构和错误处理
   - 覆盖同步和异步端点
   - 通过专门的测试用例测试流式响应

这种方法确保测试可以在任何环境中运行，而不会影响真实基础设施、数据库或服务。

## 模块补丁示例

测试套件中使用的一项关键技术是在导入模块之前对其进行补丁处理。这可以防止与外部服务建立任何真实连接。以下是来自 `test_file_management_app.py` 的示例：

```python
# 动态确定后端路径
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)

# 在导入模块之前设置依赖项的补丁
patches = [
    patch('botocore.client.BaseClient._make_api_call', return_value={}),
    patch('backend.database.client.MinioClient', MagicMock()),
    patch('backend.database.client.db_client', MagicMock()),
    patch('backend.utils.auth_utils.get_current_user_id', MagicMock(return_value=('test_user', 'test_tenant'))),
    patch('backend.utils.attachment_utils.convert_image_to_text', 
          MagicMock(side_effect=lambda query, image_input, tenant_id, language='zh': 'mocked image text')),
    patch('backend.utils.attachment_utils.convert_long_text_to_text', 
          MagicMock(side_effect=lambda query, file_context, tenant_id, language='zh': 'mocked text content')),
    patch('httpx.AsyncClient', MagicMock())
]

# 启动所有补丁
for p in patches:
    p.start()

# 补丁应用后再导入模块
from fastapi.testclient import TestClient
from fastapi import UploadFile, HTTPException
from fastapi import FastAPI
from backend.apps.file_management_app import router

# 创建 FastAPI 应用和用于测试的路由
app = FastAPI()
app.include_router(router)
client = TestClient(app)
```

### 代码解释

1. **路径配置**：
   - 代码动态确定后端目录的路径
   - 使用 `sys.path.append()` 将其添加到 Python 的模块搜索路径中
   - 这允许测试使用相对路径导入后端模块

2. **补丁创建**：
   - 创建针对特定模块和函数的补丁列表
   - `patch('botocore.client.BaseClient._make_api_call', return_value={})` 防止任何 AWS API 调用
   - `patch('backend.database.client.MinioClient', MagicMock())` 替换文件存储客户端
   - `patch('backend.database.client.db_client', MagicMock())` 模拟数据库客户端
   - 认证功能被模拟以返回可预测的测试值
   - 文件处理的实用函数被模拟为简单的返回值
   - HTTP 客户端被模拟以防止网络调用

3. **应用补丁**：
   - 所有补丁在导入发生之前通过 `p.start()` 激活
   - 这一点至关重要：模块在被导入前就被打上补丁
   - 当模块被导入时，它将使用模拟的依赖项而非真实依赖项

4. **模块导入**：
   - 只有在所有补丁都激活后，代码才导入必要的模块
   - 这些导入的模块将使用模拟的依赖项而非真实依赖项
   - 被测试的路由从后端应用中导入

5. **测试客户端设置**：
   - 创建 FastAPI 测试应用并包含路由
   - 设置 TestClient 以模拟 HTTP 请求，无需启动真实服务器
   - 客户端将使用所有模拟的依赖项进行测试

### 这种方法的优势

这种"导入前补丁"策略确保：

1. **完全隔离**：从不接触真实外部服务
2. **无副作用**：测试不会修改生产数据库或服务
3. **更快的测试**：无网络延迟或外部服务处理时间
4. **可预测结果**：测试使用受控的模拟数据，结果一致
5. **无端口绑定**：FastAPI 应用程序从不绑定到真实网络端口

整个测试套件都使用这种技术，确保测试可以在任何环境中安全运行，而不会影响真实基础设施。

## 详细测试示例

以下是示例测试函数（`test_list_tools_api_success`）的详细分析，用于展示测试方法：

```python
@patch("utils.auth_utils.get_current_user_id")
@patch("database.agent_db.query_all_tools")
async def test_list_tools_api_success(self, mock_query_all_tools, mock_get_current_user_id):
    # 设置
    mock_get_current_user_id.return_value = ("user123", "tenant456")
    expected_tools = [{"id": 1, "name": "Tool1"}, {"id": 2, "name": "Tool2"}]
    mock_query_all_tools.return_value = expected_tools
    
    # 执行
    result = await list_tools_api(authorization="Bearer fake_token")
    
    # 断言
    mock_get_current_user_id.assert_called_once_with("Bearer fake_token")
    mock_query_all_tools.assert_called_once_with(tenant_id="tenant456")
    self.assertEqual(result, expected_tools)
```

### 逐行解释

1. **装饰器**：
   ```python
   @patch("utils.auth_utils.get_current_user_id")
   @patch("database.agent_db.query_all_tools")
   ```
   - 这些 `@patch` 装饰器临时将真实函数替换为模拟对象
   - 补丁函数按照相反的顺序（从下到上）替换
   - 这防止代码访问真实的外部服务，如认证和数据库

2. **函数声明**：
   ```python
   async def test_list_tools_api_success(self, mock_query_all_tools, mock_get_current_user_id):
   ```
   - 这是一个使用 Python 的 `async/await` 语法的异步测试方法
   - 模拟对象按照装饰器的相反顺序自动作为参数传递
   - `self` 指的是测试类实例（TestCase）

3. **测试设置**：
   ```python
   mock_get_current_user_id.return_value = ("user123", "tenant456")
   expected_tools = [{"id": 1, "name": "Tool1"}, {"id": 2, "name": "Tool2"}]
   mock_query_all_tools.return_value = expected_tools
   ```
   - 设置模拟对象的行为
   - 定义这些模拟函数调用时应返回的内容
   - 创建模拟数据库预期结果的测试数据

4. **测试执行**：
   ```python
   result = await list_tools_api(authorization="Bearer fake_token")
   ```
   - 调用被测试的实际函数（`list_tools_api`）
   - 传递一个假的授权令牌
   - 使用 `await` 是因为 `list_tools_api` 是一个异步函数

5. **测试断言**：
   ```python
   mock_get_current_user_id.assert_called_once_with("Bearer fake_token")
   ```
   - 验证认证函数是否恰好被调用一次
   - 确保它是用预期的参数（令牌）调用的

   ```python
   mock_query_all_tools.assert_called_once_with(tenant_id="tenant456")
   ```
   - 验证数据库查询函数是否被调用一次
   - 确认它是用正确的租户 ID（从认证中提取）调用的

   ```python
   self.assertEqual(result, expected_tools)
   ```
   - 验证函数的返回值是否与预期结果匹配
   - 确保 API 正确地从数据库返回工具

### 测试哲学

这个示例展示了核心测试哲学：

1. **隔离单元**：模拟所有外部依赖
2. **控制环境**：设置精确的测试条件
3. **测试接口**：关注输入和输出
4. **验证行为**：检查结果和交互

通过遵循这种模式，测试可靠、快速，且不会影响真实系统或数据。
