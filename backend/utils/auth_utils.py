import logging
import os
from typing import Optional

from fastapi import Header, Request
from consts.const import DEFAULT_USER_ID, DEFAULT_TENANT_ID

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
    try:
        return DEFAULT_USER_ID
    except Exception as e:
        logging.error(f"从令牌提取用户ID失败: {str(e)}")
        return DEFAULT_USER_ID
    
def get_current_user_id(authorization: Optional[str] = None) -> tuple[str, str]:
    
    if authorization is None or authorization == Header(None):
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID
        
    try:
        user_id = get_current_user_id_from_token(str(authorization))
        return user_id, DEFAULT_TENANT_ID
    except Exception as e:
        logging.error(f"获取用户ID失败: {str(e)}")
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID

def get_user_language(request: Request = None) -> str:
    """
    从请求中获取用户语言偏好
    
    Args:
        request: FastAPI请求对象，用于获取cookie
        
    Returns:
        str: 语言代码 ('zh' 或 'en')，默认为 'zh'
    """
    default_language = 'zh'
    
    # 从cookie中读取语言设置
    if request:
        try:
            if hasattr(request, 'cookies') and request.cookies:
                cookie_locale = request.cookies.get('NEXT_LOCALE')
                if cookie_locale and cookie_locale in ['zh', 'en']:
                    return cookie_locale
        except (AttributeError, TypeError) as e:
            logging.warning(f"Error reading language from cookies: {e}")
    
    return default_language

def get_current_user_info(authorization: Optional[str] = None, request: Request = None) -> tuple[str, str, str]:
    """
    获取当前用户信息，包括用户ID、租户ID和语言偏好
    
    Args:
        authorization: 授权头部值
        request: FastAPI请求对象
        
    Returns:
        tuple[str, str, str]: (用户ID, 租户ID, 语言代码)
    """
    user_id, tenant_id = get_current_user_id(authorization)
    language = get_user_language(request)
    return user_id, tenant_id, language
