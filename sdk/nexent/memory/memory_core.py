"""SDK-level wrapper around mem0 Memory that keeps an in-process cache.

This module **must not** depend on any backend packages – therefore callers are
responsible for assembling a fully-validated configuration dictionary that is
accepted by *mem0* and handing it in via :pyfunc:`get_memory_instance`.

The implementation maintains an in-process dictionary keyed by a deterministic
hash of the configuration to guarantee that only one ``Memory`` object is
created per unique configuration **per process** – this is both thread-safe and
friendly to multi-process deployments such as Gunicorn or Uvicorn workers.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Any, Dict

from mem0.memory.main import AsyncMemory

from .embedder_adaptor import EmbedderAdaptor


logger = logging.getLogger("memory_core")

# In-process cache – {config_hash: Memory}
_MEMORY_CACHE: dict[str, AsyncMemory] = {}
_CACHE_LOCK = asyncio.Lock()


def _hash_config(config: Dict[str, Any]) -> str:
    """Return a stable SHA-256 hash for *config*."""
    # json.dumps with *sort_keys* ensures deterministic ordering
    cfg_bytes = json.dumps(config, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(cfg_bytes).hexdigest()


def _validate_config(config: Dict[str, Any]) -> None:
    """Perform strict validation – raise ``ValueError`` on any missing key.

    The function purposefully *does not* fill in defaults; callers must pass a
    complete configuration so that the behaviour is explicit and predictable.
    """
    try:
        # LLM section
        llm_cfg = config["llm"]
        _ = llm_cfg["provider"]
        llm_cfg_inner = llm_cfg["config"]
        _ = llm_cfg_inner["model"]
        _ = llm_cfg_inner["api_key"]
        _ = llm_cfg_inner["openai_base_url"]

        # Embedder section
        emb_cfg = config["embedder"]
        _ = emb_cfg["provider"]
        emb_cfg_inner = emb_cfg["config"]
        _ = emb_cfg_inner["model"]
        _ = emb_cfg_inner["openai_base_url"]
        _ = emb_cfg_inner["embedding_dims"]
        _ = emb_cfg_inner["api_key"]

        # Vector-store section
        vs_cfg = config["vector_store"]["config"]
        _ = vs_cfg["collection_name"]
        _ = vs_cfg["host"]
        _ = vs_cfg["port"]
        _ = vs_cfg["embedding_model_dims"]
        _ = vs_cfg["api_key"]
    except KeyError as exc:
        raise ValueError(f"Missing required config key: {'.'.join(str(s) for s in exc.args)}") from None


async def get_memory_instance(memory_config: Dict[str, Any]) -> AsyncMemory:
    """Return (and cache) a *mem0* ``Memory`` instance for *memory_config*.

    Parameters
    ----------
    memory_config
        A fully-populated configuration dictionary compatible with
        ``mem0.Memory.from_config``.
    """
    # Validate *before* computing hash so we fail fast with human-readable error
    _validate_config(memory_config)

    cache_key = _hash_config(memory_config)

    async with _CACHE_LOCK:
        if cache_key in _MEMORY_CACHE:
            logger.debug("Memory cache hit.")
            return _MEMORY_CACHE[cache_key]

        logger.debug("Creating new Memory instance...")
        logger.debug("Using config:\n%s", json.dumps(memory_config, indent=2))
        memory_obj = await AsyncMemory.from_config(memory_config)

        try:
            memory_obj.embedding_model = EmbedderAdaptor(memory_config["embedder"]["config"])
            logger.debug("EmbedderAdaptor successfully attached to Memory instance")
        except Exception as exc:
            logger.warning("Failed to attach EmbedderAdaptor: %s", exc)

        _MEMORY_CACHE[cache_key] = memory_obj
        return memory_obj
