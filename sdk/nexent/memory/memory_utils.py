from typing import Optional


def build_memory_identifiers(
    memory_level: str,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> str:
    """Return user_id_to_pass for Memory operations based on level."""
    if memory_level == "tenant" or memory_level == "agent":
        if not tenant_id:
            raise ValueError("tenant_id is required for tenant level memory operations")
        memory_user_id = f"tenant-{tenant_id}"
    elif memory_level == "user" or memory_level == "user_agent":
        if not user_id:
            raise ValueError("user_id is required for user level memory operations")
        memory_user_id = user_id
    else:
        raise ValueError("Unsupported memory level: " + memory_level)

    return memory_user_id

