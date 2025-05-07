
import logging
from typing import Dict, Any, Optional, List, Tuple

from fastapi import Header

from utils.auth_utils import get_current_user_id_from_token


# 全局追踪字段管理方法
def add_creation_tracking(data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    添加创建追踪字段（created_by和updated_by）

    Args:
        data: 要添加字段的数据字典
        user_id: 当前用户ID

    Returns:
        Dict[str, Any]: 添加追踪字段后的数据字典
    """
    data_copy = data.copy()
    data_copy["created_by"] = user_id
    data_copy["updated_by"] = user_id
    return data_copy


def add_update_tracking(data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    添加更新追踪字段（updated_by）

    Args:
        data: 要添加字段的数据字典
        user_id: 当前用户ID

    Returns:
        Dict[str, Any]: 添加追踪字段后的数据字典
    """
    data_copy = data.copy()
    data_copy["updated_by"] = user_id
    return data_copy


# 统一获取当前用户ID的方法
def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    从授权头部提取当前用户ID
    Args:
        authorization: 授权头部
    Returns:
        Optional[str]: 用户ID，如果未登录则返回None
    """
    if not authorization:
        return None
    try:
        return get_current_user_id_from_token(str(authorization))
    except Exception as e:
        logging.error(f"获取用户ID失败: {str(e)}")
        return None
