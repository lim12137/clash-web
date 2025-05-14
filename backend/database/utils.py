from typing import Optional
from fastapi import Header
import uuid


# mock data, used to obtain the user id
def get_current_user_id(authorization: Optional[str] = Header(None)):
    return str(uuid.uuid4())  # Return a randomly generated UUID string