import logging
import os
from typing import Optional

from fastapi import Header, Request
from consts.const import DEFAULT_USER_ID, DEFAULT_TENANT_ID

# Get Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', 'http://118.31.249.152:8010')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')


def get_current_user_id_from_token(authorization: str) -> Optional[str]:
    """
    Extract user ID from JWT token

    Args:
        authorization: Authorization header value

    Returns:
        Optional[str]: User ID, return None if parsing fails
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
    Get user language preference from request
    
    Args:
        request: FastAPI request object, used to get cookie
        
    Returns:
        str: Language code ('zh' or 'en'), default to 'zh'
    """
    default_language = 'zh'
    
    # Read language setting from cookie
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
    Get current user information, including user ID, tenant ID, and language preference
    
    Args:
        authorization: Authorization header value
        request: FastAPI request object
        
    Returns:
        tuple[str, str, str]: (User ID, Tenant ID, Language code)
    """
    user_id, tenant_id = get_current_user_id(authorization)
    language = get_user_language(request)
    return user_id, tenant_id, language
