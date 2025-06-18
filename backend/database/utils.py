from typing import Optional

from fastapi import Header


def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization:
        return ""