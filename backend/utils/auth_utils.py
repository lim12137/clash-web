import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Header
from consts.const import DEFAULT_USER_ID, DEFAULT_TENANT_ID
import jwt
from supabase import create_client

# 获取Supabase配置
SUPABASE_URL = os.getenv('SUPABASE_URL', 'http://118.31.249.152:8010')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')

def get_supabase_client():
    """获取Supabase客户端实例"""
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logging.error(f"创建Supabase客户端失败: {str(e)}")
        return None


def get_jwt_expiry_seconds(token: str) -> int:
    """
    从JWT令牌中获取过期时间（秒）

    Args:
        token: JWT令牌字符串

    Returns:
        int: 令牌的有效期（秒），如果解析失败则返回默认值3600
    """
    try:
        # 确保token是纯JWT，去除可能的Bearer前缀
        jwt_token = token.replace("Bearer ", "") if token.startswith("Bearer ") else token

        # 解码JWT令牌(不验证签名，只解析内容)
        decoded = jwt.decode(jwt_token, options={"verify_signature": False})

        # 从JWT声明中提取过期时间和签发时间
        exp = decoded.get("exp", 0)
        iat = decoded.get("iat", 0)

        # 计算有效期（秒）
        expiry_seconds = exp - iat

        return expiry_seconds
    except Exception as e:
        logging.warning(f"从令牌获取过期时间失败: {str(e)}")
        return 3600  # supabase默认设置


def calculate_expires_at(token: Optional[str] = None) -> int:
    """
    计算会话过期时间（与Supabase JWT过期时间保持一致）

    Args:
        token: 可选的JWT令牌，用于获取实际过期时间

    Returns:
        int: 过期时间的时间戳
    """
    expiry_seconds = get_jwt_expiry_seconds(token) if token else 3600
    return int((datetime.now() + timedelta(seconds=expiry_seconds)).timestamp())


def get_current_user_id_from_token(authorization: str) -> Optional[str]:
    """
    从JWT令牌中提取用户ID

    Args:
        authorization: 授权头部值

    Returns:
        Optional[str]: 用户ID，如果解析失败则返回None
    """
    try:
        # 格式化授权头部
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization

        # 解码JWT令牌(不验证签名，只解析内容)
        decoded = jwt.decode(token, options={"verify_signature": False})

        # 从JWT声明中提取用户ID
        user_id = decoded.get("sub")

        return user_id
    except Exception as e:
        logging.error(f"从令牌提取用户ID失败: {str(e)}")
        return DEFAULT_USER_ID
    
def get_current_user_id(authorization: Optional[str] = None) -> tuple[str, str]:

    if authorization is None or authorization == Header(None):
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID

    try:
        user_id = get_current_user_id_from_token(str(authorization))
        tenant_id = user_id
        return user_id, DEFAULT_TENANT_ID
    except Exception as e:
        logging.error(f"获取用户ID失败: {str(e)}")
        return DEFAULT_USER_ID, DEFAULT_TENANT_ID