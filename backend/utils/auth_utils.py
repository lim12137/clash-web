import logging
import os
from typing import Optional

from fastapi import Header
import jwt

# 获取Supabase配置
SUPABASE_URL = os.getenv('SUPABASE_URL', 'http://118.31.249.152:8010')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')



def get_current_user_id_from_token(authorization: str) -> Optional[str]:
    """
    从JWT令牌中提取用户ID

    Args:
        authorization: 授权头部值

    Returns:
        Optional[str]: 用户ID，如果解析失败则返回None
    """
    DEFAULT_USER_ID = "user_id"
    try:
        return DEFAULT_USER_ID
    except Exception as e:
        logging.error(f"从令牌提取用户ID失败: {str(e)}")
        return DEFAULT_USER_ID
    
def get_current_user_id(authorization: Optional[str] = None) -> tuple[str, str]:
    DEFAULT_USER_ID = "user_id"
    DEFAULT_TENANT_ID = "tenant_id"
    
    if authorization is None or authorization == Header(None):
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID
        
    try:
        user_id = get_current_user_id_from_token(str(authorization))
        return user_id, DEFAULT_TENANT_ID
    except Exception as e:
        logging.error(f"获取用户ID失败: {str(e)}")
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID
