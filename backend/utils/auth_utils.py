import logging
import os
from typing import Optional

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
        return None
