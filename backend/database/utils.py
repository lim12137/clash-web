from typing import Optional

from fastapi import Header
import logging
from utils.auth_utils import get_current_user_id_from_token



def get_current_user_id(authorization: Optional[str] = None) -> tuple[str, str]:
    DEFAULT_USER_ID = "user_id"
    DEFAULT_TENANT_ID = "tenant_id"
    
    if authorization is None or authorization == Header(None):
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID
        
    try:
        user_id = get_current_user_id_from_token(str(authorization))
        tenant_id = user_id
        return user_id, tenant_id
    except Exception as e:
        logging.error(f"获取用户ID失败: {str(e)}")
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID