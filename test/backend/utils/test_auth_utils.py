import time
import sys
from unittest.mock import MagicMock
import types
import pytest

# ---------------------------------------------------------------------------
# Pre-mock heavy dependencies BEFORE importing the module under test.
# This avoids side-effects such as Minio/S3 network calls that are triggered
# during import time of database.client when auth_utils is imported.
# ---------------------------------------------------------------------------

# Stub out the database package hierarchy expected by auth_utils
sys.modules['database'] = MagicMock()

# Provide a lightweight module for database.client with the attributes used
# by auth_utils so that any direct attribute access works as expected.
db_client_stub = types.ModuleType("database.client")
db_client_stub.MinioClient = MagicMock()
db_client_stub.get_db_session = MagicMock()
db_client_stub.as_dict = MagicMock()
sys.modules['database.client'] = db_client_stub

# Stub database.user_tenant_db to avoid real DB interactions
sys.modules['database.user_tenant_db'] = MagicMock(get_user_tenant_by_user_id=MagicMock(return_value=None))

from utils import auth_utils as au

# After auth_utils import succeeds, bring in real exception classes for clarity.
from backend.consts.exceptions import UnauthorizedError, SignatureValidationError

# Pre-mock nexent core dependency pulled by consts.model
sys.modules['consts'] = MagicMock()
sys.modules['consts.const'] = MagicMock()
sys.modules['consts.exceptions'] = MagicMock()
sys.modules['nexent'] = MagicMock()
sys.modules['nexent.core'] = MagicMock()
sys.modules['nexent.core.agents'] = MagicMock()
sys.modules['nexent.core.agents.agent_model'] = MagicMock()
sys.modules['supabase'] = MagicMock()
sys.modules['boto3'] = MagicMock()
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()
sys.modules['botocore'] = MagicMock()
sys.modules['botocore.client'] = MagicMock()
sys.modules['botocore.exceptions'] = MagicMock()


# Ensure exceptions in module under test are real exception classes, not mocks
au.UnauthorizedError = UnauthorizedError
au.SignatureValidationError = SignatureValidationError


def test_calculate_hmac_signature_stability():
    sig1 = au.calculate_hmac_signature("secret", "access", "1234567890", "body")
    sig2 = au.calculate_hmac_signature("secret", "access", "1234567890", "body")
    assert sig1 == sig2
    assert len(sig1) == 64  # sha256 hex


def test_validate_timestamp_window(monkeypatch):
    now = int(time.time())
    assert au.validate_timestamp(str(now))
    # Too old/new should fail
    old = now - (au.TIMESTAMP_VALIDITY_WINDOW + 10)
    assert not au.validate_timestamp(str(old))


def test_extract_aksk_headers_success():
    access_key, ts, sig = au.extract_aksk_headers({
        "X-Access-Key": "ak",
        "X-Timestamp": "123",
        "X-Signature": "sig",
    })
    assert access_key == "ak" and ts == "123" and sig == "sig"


def test_extract_aksk_headers_missing():
    with pytest.raises(UnauthorizedError):
        au.extract_aksk_headers({})


def test_verify_aksk_signature_success(monkeypatch):
    # Arrange matching ak and computed signature
    monkeypatch.setattr(au, "get_aksk_config", lambda tenant_id: ("ak", "sk"))
    ts = str(int(time.time()))
    expected = au.calculate_hmac_signature("sk", "ak", ts, "body")
    ok = au.verify_aksk_signature("ak", ts, expected, "body")
    assert ok is True


def test_verify_aksk_signature_invalid(monkeypatch):
    monkeypatch.setattr(au, "get_aksk_config", lambda tenant_id: ("ak", "sk"))
    ts = str(int(time.time()))
    assert au.verify_aksk_signature("wrong", ts, "sig", "") is False


def test_validate_aksk_authentication(monkeypatch):
    monkeypatch.setattr(au, "verify_aksk_signature", lambda a, b, c, d: True)
    ok = au.validate_aksk_authentication({
        "X-Access-Key": "ak",
        "X-Timestamp": str(int(time.time())),
        "X-Signature": "sig",
    }, "body")
    assert ok is True


def test_validate_aksk_authentication_invalid(monkeypatch):
    monkeypatch.setattr(au, "verify_aksk_signature", lambda a, b, c, d: False)
    with pytest.raises(SignatureValidationError):
        au.validate_aksk_authentication({
            "X-Access-Key": "ak",
            "X-Timestamp": str(int(time.time())),
            "X-Signature": "sig",
        }, "body")


def test_generate_test_jwt_and_get_expiry_seconds(monkeypatch):
    token = au.generate_test_jwt("user-1", expires_in=1234)
    # ensure not in speed mode for this test
    monkeypatch.setattr(au, "IS_SPEED_MODE", False)
    seconds = au.get_jwt_expiry_seconds(token)
    assert seconds == 1234


def test_calculate_expires_at_speed_mode(monkeypatch):
    monkeypatch.setattr(au, "IS_SPEED_MODE", True)
    exp = au.calculate_expires_at("irrelevant")
    # far future (> 1 year)
    assert exp > int(time.time()) + 3600 * 24 * 365


def test_extract_user_id_from_jwt_token(monkeypatch):
    monkeypatch.setattr(au, "IS_SPEED_MODE", False)
    token = au.generate_test_jwt("user-xyz", expires_in=3600)
    uid = au._extract_user_id_from_jwt_token("Bearer " + token)
    assert uid == "user-xyz"


def test_get_current_user_id_speed_mode(monkeypatch):
    monkeypatch.setattr(au, "IS_SPEED_MODE", True)
    uid, tid = au.get_current_user_id("Bearer anything")
    assert uid == au.DEFAULT_USER_ID and tid == au.DEFAULT_TENANT_ID


def test_get_current_user_id_with_mapping(monkeypatch):
    monkeypatch.setattr(au, "IS_SPEED_MODE", False)
    token = au.generate_test_jwt("user-a", 1000)
    # user->tenant mapping
    monkeypatch.setattr(au, "get_user_tenant_by_user_id", lambda u: {"tenant_id": "tenant-a"})
    uid, tid = au.get_current_user_id(token)
    assert uid == "user-a" and tid == "tenant-a"


def test_get_user_language_from_cookie():
    class Req:
        cookies = {"NEXT_LOCALE": "en"}

    assert au.get_user_language(Req()) == "en"
    assert au.get_user_language(None) == "zh"

