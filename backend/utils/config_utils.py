import json


def safe_value(value):
    """Helper function for processing configuration values"""
    if value is None:
        return ""
    return str(value)


def safe_list(value):
    """Helper function for processing list values, using JSON format for storage to facilitate parsing"""
    if not value:
        return "[]"
    return json.dumps(value)


def get_env_key(key: str) -> str:
    """Helper function for generating environment variable key names"""
    # Convert camelCase to snake_case format
    import re
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', key)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).upper()
