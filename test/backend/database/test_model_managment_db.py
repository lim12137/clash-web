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

# 将模拟的client模块添加到sys.modules中
sys.modules['backend.database.client'] = client_mock

# 现在可以安全地导入被测试的模块
from backend.database.model_management_db import get_models_by_tenant_factory_type

@pytest.fixture
def mock_session():
    # mock scalars().all() return value
    mock_model = MagicMock()
    mock_model.__dict__ = {
        "model_id": 1,
        "model_factory": "openai",
        "model_type": "chat",
        "tenant_id": "tenant1",
        "delete_flag": "N"
    }
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [mock_model]
    mock_session = MagicMock()
    mock_session.scalars.return_value = mock_scalars
    return mock_session

def test_get_models_by_tenant_factory_type(monkeypatch, mock_session):
    # patch get_db_session
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_session
    mock_ctx.__exit__.return_value = None
    monkeypatch.setattr("backend.database.model_management_db.get_db_session", lambda: mock_ctx)
    # patch as_dict
    monkeypatch.setattr("backend.database.model_management_db.as_dict", lambda obj: obj.__dict__)

    tenant_id = "tenant1"
    model_factory = "openai"
    model_type = "chat"
    result = get_models_by_tenant_factory_type(tenant_id, model_factory, model_type)
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["model_factory"] == model_factory
    assert result[0]["model_type"] == model_type
    assert result[0]["tenant_id"] == tenant_id
