from mem0 import Memory
from utils.config_utils import config_manager

config = {
    "vector_store": {
        "provider": "elasticsearch",
        "config": {
            "collection_name": config_manager.get_config("ES_INDEX"),
            "host": config_manager.get_config("ES_HOST"),
            "port": int(config_manager.get_config("ES_PORT", "9200")),
            "embedding_model_dims": int(config_manager.get_config("EMBEDDING_MODEL_DIMS", "1536"))
        }
    },
    "llm": {
        "provider": "openai",
        "config": {
            "api_key": config_manager.get_config("OPENAI_API_KEY"),
            "model": config_manager.get_config("OPENAI_MODEL"),
            "openai_base_url": config_manager.get_config("OPENAI_BASE_URL")
        }
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "api_key": config_manager.get_config("OPENAI_API_KEY"),
            "model": config_manager.get_config("OPENAI_EMBED_MODEL"),
            "openai_base_url": config_manager.get_config("OPENAI_BASE_URL")
        }
    },
    "graph_store": {
        "provider": "neo4j",
        "config": {
            "url": config_manager.get_config("NEO4J_URL"),
            "username": config_manager.get_config("NEO4J_USER"),
            "password": config_manager.get_config("NEO4J_PASSWORD")
        }
    },
    "history_db_path": config_manager.get_config("MEM0_HISTORY_DB"),
    "version": "v1.1",
    "custom_fact_extraction_prompt": "可选：自定义事实抽取提示词",
    "custom_update_memory_prompt": "可选：自定义记忆更新提示词"
}

memory = Memory.from_config(config) 