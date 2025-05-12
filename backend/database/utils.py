from typing import Optional
from fastapi import Header
import uuid

# mock的假数据，用于获取用户id
def get_current_user_id(authorization: Optional[str] = Header(None)):
    return str(uuid.uuid4())  # 返回随机生成的UUID字符串