from typing import Optional
from fastapi import Header


# mork的假数据，用于获取用户id
def get_current_user_id(authorization: Optional[str] = Header(None)):
    return "刘亦菲"