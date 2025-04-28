import logging

def split_repo_name(full_name: str):
    """
    Split model_name into model_repo and model_name
    """
    parts = full_name.split('/')
    if len(parts) > 1:
        return '/'.join(parts[:-1]), parts[-1]
    return "", full_name


def add_repo_to_name(model_repo: str, model_name: str) -> str:
    """
    Concatenate model_repo and model_name

    Args:
        model_repo: Model repository name
        model_name: Model name

    Returns:
        str: Complete model name after concatenation
    """
    if "/" in model_name:
        logging.warning(f"Unexpected behavior: Model name {model_name} already contains repository information!")
        return model_name
    if model_repo:
        return f"{model_repo}/{model_name}"
    return model_name
