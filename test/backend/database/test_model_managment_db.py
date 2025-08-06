import sys
import pytest
from unittest.mock import patch, MagicMock

# Patch the Minio client (and boto3, which it relies on) *before* importing the
# module under test.  This prevents any real network calls from being executed
# when the global `minio_client` instance is created during import time.

# Provide a stub for the `boto3` module so that it can be imported safely even
# if the testing environment does not have it available.
boto3_mock = MagicMock()
sys.modules['boto3'] = boto3_mock

# Replace the `MinioClient` class with a mock that returns another mock
# instance.  All methods/properties invoked on it inside the code under test
# will therefore be harmless no-ops.
with patch('backend.database.client.MinioClient', return_value=MagicMock()):
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
