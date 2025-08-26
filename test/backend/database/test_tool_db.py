import sys
import pytest
from unittest.mock import patch, MagicMock

# 首先模拟consts模块，避免ModuleNotFoundError
consts_mock = MagicMock()
consts_mock.const = MagicMock()
# 设置consts.const中需要的常量
consts_mock.const.MINIO_ENDPOINT = "http://localhost:9000"
consts_mock.const.MINIO_ACCESS_KEY = "test_access_key"
consts_mock.const.MINIO_SECRET_KEY = "test_secret_key"
consts_mock.const.MINIO_REGION = "us-east-1"
consts_mock.const.MINIO_DEFAULT_BUCKET = "test-bucket"
consts_mock.const.POSTGRES_HOST = "localhost"
consts_mock.const.POSTGRES_USER = "test_user"
consts_mock.const.NEXENT_POSTGRES_PASSWORD = "test_password"
consts_mock.const.POSTGRES_DB = "test_db"
consts_mock.const.POSTGRES_PORT = 5432
consts_mock.const.DEFAULT_TENANT_ID = "default_tenant"

# 将模拟的consts模块添加到sys.modules中
sys.modules['consts'] = consts_mock
sys.modules['consts.const'] = consts_mock.const

# 模拟utils模块
utils_mock = MagicMock()
utils_mock.auth_utils = MagicMock()
utils_mock.auth_utils.get_current_user_id_from_token = MagicMock(return_value="test_user_id")

# 将模拟的utils模块添加到sys.modules中
sys.modules['utils'] = utils_mock
sys.modules['utils.auth_utils'] = utils_mock.auth_utils

# Provide a stub for the `boto3` module so that it can be imported safely even
# if the testing environment does not have it available.
boto3_mock = MagicMock()
sys.modules['boto3'] = boto3_mock

# 模拟整个client模块
client_mock = MagicMock()
client_mock.MinioClient = MagicMock()
client_mock.PostgresClient = MagicMock()
client_mock.db_client = MagicMock()
client_mock.get_db_session = MagicMock()
client_mock.as_dict = MagicMock()
client_mock.filter_property = MagicMock()

# 将模拟的client模块添加到sys.modules中
sys.modules['database.client'] = client_mock
sys.modules['backend.database.client'] = client_mock

# 模拟db_models模块
db_models_mock = MagicMock()
db_models_mock.ToolInstance = MagicMock()
db_models_mock.ToolInfo = MagicMock()

# 将模拟的db_models模块添加到sys.modules中
sys.modules['database.db_models'] = db_models_mock
sys.modules['backend.database.db_models'] = db_models_mock

# 模拟agent_db模块
agent_db_mock = MagicMock()
agent_db_mock.logger = MagicMock()

# 将模拟的agent_db模块添加到sys.modules中
sys.modules['database.agent_db'] = agent_db_mock
sys.modules['backend.database.agent_db'] = agent_db_mock

# 现在可以安全地导入被测试的模块
from backend.database.tool_db import (
    create_tool,
    create_or_update_tool_by_tool_info,
    query_all_tools,
    query_tool_instances_by_id,
    query_tools_by_ids,
    query_all_enabled_tool_instances,
    update_tool_table_from_scan_tool_list,
    add_tool_field,
    search_tools_for_sub_agent,
    check_tool_is_available,
    delete_tools_by_agent_id
)

class MockToolInstance:
    def __init__(self):
        self.tool_instance_id = 1
        self.tool_id = 1
        self.agent_id = 1
        self.tenant_id = "tenant1"
        self.user_id = "user1"
        self.enabled = True
        self.delete_flag = "N"
        self.__dict__ = {
            "tool_instance_id": 1,
            "tool_id": 1,
            "agent_id": 1,
            "tenant_id": "tenant1",
            "user_id": "user1",
            "enabled": True,
            "delete_flag": "N"
        }

class MockToolInfo:
    def __init__(self):
        self.tool_id = 1
        self.name = "test_tool"
        self.description = "test description"
        self.source = "test_source"
        self.author = "tenant1"
        self.is_available = True
        self.delete_flag = "N"
        self.params = [{"name": "param1", "default": "value1"}]
        self.usage = "test usage"
        self.inputs = "test inputs"
        self.output_type = "test output"
        self.class_name = "TestTool"
        self.__dict__ = {
            "tool_id": 1,
            "name": "test_tool",
            "description": "test description",
            "source": "test_source",
            "author": "tenant1",
            "is_available": True,
            "delete_flag": "N",
            "params": [{"name": "param1", "default": "value1"}],
            "usage": "test usage",
            "inputs": "test inputs",
            "output_type": "test output",
            "class_name": "TestTool"
        }

@pytest.fixture
def mock_session():
    """创建模拟的数据库会话"""
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    return mock_session, mock_query

def test_create_tool_success(monkeypatch, mock_session):
    """测试成功创建工具"""
    session, query = mock_session
    session.add = MagicMock()
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    monkeypatch.setattr("backend.database.tool_db.filter_property", lambda data, model: data)
    monkeypatch.setattr("backend.database.tool_db.ToolInstance", lambda **kwargs: MagicMock())
    
    tool_info = {"tool_id": 1, "agent_id": 1, "tenant_id": "tenant1"}
    create_tool(tool_info)
    
    session.add.assert_called_once()

def test_create_or_update_tool_by_tool_info_update_existing(monkeypatch, mock_session):
    """测试更新已存在的工具实例"""
    session, query = mock_session
    mock_tool_instance = MockToolInstance()
    
    mock_first = MagicMock()
    mock_first.return_value = mock_tool_instance
    mock_filter = MagicMock()
    mock_filter.first = mock_first
    query.filter.return_value = mock_filter
    
    session.flush = MagicMock()
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    
    tool_info = MagicMock()
    tool_info.__dict__ = {"agent_id": 1, "tool_id": 1}
    
    result = create_or_update_tool_by_tool_info(tool_info, "tenant1", "user1")
    
    assert result == mock_tool_instance
    session.flush.assert_called_once()

def test_create_or_update_tool_by_tool_info_create_new(monkeypatch, mock_session):
    """测试创建新的工具实例"""
    session, query = mock_session
    mock_first = MagicMock()
    mock_first.return_value = None
    mock_filter = MagicMock()
    mock_filter.first = mock_first
    query.filter.return_value = mock_filter
    
    session.flush = MagicMock()
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    monkeypatch.setattr("backend.database.tool_db.create_tool", MagicMock())
    
    tool_info = MagicMock()
    tool_info.__dict__ = {"agent_id": 1, "tool_id": 1}
    
    result = create_or_update_tool_by_tool_info(tool_info, "tenant1", "user1")
    
    assert result is None
    session.flush.assert_called_once()

def test_query_all_tools(monkeypatch, mock_session):
    """测试查询所有工具"""
    session, query = mock_session
    mock_tool_info = MockToolInfo()
    
    mock_all = MagicMock()
    mock_all.return_value = [mock_tool_info]
    mock_filter = MagicMock()
    mock_filter.all = mock_all
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    monkeypatch.setattr("backend.database.tool_db.as_dict", lambda obj: obj.__dict__)
    
    result = query_all_tools("tenant1")
    
    assert len(result) == 1
    assert result[0]["tool_id"] == 1
    assert result[0]["name"] == "test_tool"

def test_query_tool_instances_by_id_found(monkeypatch, mock_session):
    """测试成功查询工具实例"""
    session, query = mock_session
    mock_tool_instance = MockToolInstance()
    
    mock_first = MagicMock()
    mock_first.return_value = mock_tool_instance
    mock_filter = MagicMock()
    mock_filter.first = mock_first
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    monkeypatch.setattr("backend.database.tool_db.as_dict", lambda obj: obj.__dict__)
    
    result = query_tool_instances_by_id(1, 1, "tenant1")
    
    assert result["tool_instance_id"] == 1
    assert result["tool_id"] == 1

def test_query_tool_instances_by_id_not_found(monkeypatch, mock_session):
    """测试查询不存在的工具实例"""
    session, query = mock_session
    mock_first = MagicMock()
    mock_first.return_value = None
    mock_filter = MagicMock()
    mock_filter.first = mock_first
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    
    result = query_tool_instances_by_id(1, 1, "tenant1")
    
    assert result is None

def test_query_tools_by_ids(monkeypatch, mock_session):
    """测试通过ID列表查询工具"""
    session, query = mock_session
    mock_tool_info = MockToolInfo()
    
    mock_all = MagicMock()
    mock_all.return_value = [mock_tool_info]
    mock_filter2 = MagicMock()
    mock_filter2.all = mock_all
    mock_filter1 = MagicMock()
    mock_filter1.filter.return_value = mock_filter2
    query.filter.return_value = mock_filter1
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    monkeypatch.setattr("backend.database.tool_db.as_dict", lambda obj: obj.__dict__)
    
    result = query_tools_by_ids([1, 2])
    
    assert len(result) == 1
    assert result[0]["tool_id"] == 1

def test_query_all_enabled_tool_instances(monkeypatch, mock_session):
    """测试查询所有启用的工具实例"""
    session, query = mock_session
    mock_tool_instance = MockToolInstance()
    
    mock_all = MagicMock()
    mock_all.return_value = [mock_tool_instance]
    mock_filter = MagicMock()
    mock_filter.all = mock_all
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    monkeypatch.setattr("backend.database.tool_db.as_dict", lambda obj: obj.__dict__)
    
    result = query_all_enabled_tool_instances(1, "tenant1")
    
    assert len(result) == 1
    assert result[0]["tool_instance_id"] == 1

def test_update_tool_table_from_scan_tool_list_exception(monkeypatch, mock_session):
    """测试更新工具表时发生异常"""
    session, query = mock_session
    query.filter.side_effect = Exception("Database error")
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    
    tool_list = []
    update_tool_table_from_scan_tool_list("tenant1", "user1", tool_list)
    
    # 应该不会抛出异常，而是记录错误日志

def test_add_tool_field(monkeypatch, mock_session):
    """测试添加工具字段"""
    session, query = mock_session
    mock_tool_info = MockToolInfo()
    
    mock_first = MagicMock()
    mock_first.return_value = mock_tool_info
    mock_filter = MagicMock()
    mock_filter.first = mock_first
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    
    tool_info = {"tool_id": 1, "params": {"param1": "value1"}}
    result = add_tool_field(tool_info)
    
    assert result["name"] == "test_tool"
    assert result["description"] == "test description"
    assert result["source"] == "test_source"

def test_search_tools_for_sub_agent(monkeypatch, mock_session):
    """测试搜索子agent的工具"""
    session, query = mock_session
    mock_tool_instance = MockToolInstance()
    
    mock_all = MagicMock()
    mock_all.return_value = [mock_tool_instance]
    mock_filter = MagicMock()
    mock_filter.all = mock_all
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    monkeypatch.setattr("backend.database.tool_db.as_dict", lambda obj: obj.__dict__)
    monkeypatch.setattr("backend.database.tool_db.add_tool_field", lambda data: data)
    
    result = search_tools_for_sub_agent(1, "tenant1")
    
    assert len(result) == 1
    assert result[0]["tool_instance_id"] == 1

def test_check_tool_is_available(monkeypatch, mock_session):
    """测试检查工具是否可用"""
    session, query = mock_session
    mock_tool_info = MockToolInfo()
    
    # 直接设置 query.filter().all() 的返回值
    mock_all = MagicMock()
    mock_all.return_value = [mock_tool_info]
    query.filter.return_value.all = mock_all
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    
    result = check_tool_is_available([1, 2])
    
    assert result == [True]

def test_delete_tools_by_agent_id_success(monkeypatch, mock_session):
    """测试成功删除agent的工具"""
    session, query = mock_session
    mock_update = MagicMock()
    mock_filter = MagicMock()
    mock_filter.update = mock_update
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    
    # 函数不返回任何值，只验证执行成功
    delete_tools_by_agent_id(1, "tenant1", "user1")
    
    mock_update.assert_called_once()

def test_delete_tools_by_agent_id_failure(monkeypatch, mock_session):
    """测试删除agent的工具失败"""
    session, query = mock_session
    mock_update = MagicMock(side_effect=Exception("Database error"))
    mock_filter = MagicMock()
    mock_filter.update = mock_update
    query.filter.return_value = mock_filter
    
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.tool_db.get_db_session", lambda: mock_ctx)
    
    # 函数应该抛出异常，因为数据库操作失败
    with pytest.raises(Exception, match="Database error"):
        delete_tools_by_agent_id(1, "tenant1", "user1") 