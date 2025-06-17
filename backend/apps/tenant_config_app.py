import logging
from fastapi import APIRouter, Depends, Header, Query, Path, Body
from typing import Optional, List
from services.tenant_config_service import get_selected_knowledge_list, update_selected_knowledge
from fastapi.responses import JSONResponse

from utils.user_utils import get_user_info

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tenant config app")
router = APIRouter(prefix="/tenant_config")

@router.get("/load_knowledge_list")
def load_knowledge_list(
    authorization: Optional[str] = Header(None)
):
    try:
        user_id, tenant_id = get_user_info()
        selected_knowledge_info = get_selected_knowledge_list(tenant_id=tenant_id, user_id=user_id)
        content = {"selectedKbNames": [item["index_name"] for item in selected_knowledge_info],
                   "selectedKbModels": [item["knowledge_embedding_model"] for item in selected_knowledge_info],
                   "selectedKbSources": [item["knowledge_sources"] for item in selected_knowledge_info]}

        return JSONResponse(
            status_code=200,
            content={"content": content, "status": "success"}
        )
    except Exception as e:
        logger.error(f"load knowledge list failed, error: {e}")
        return JSONResponse(
            status_code=400,
            content={"message": "Failed to load configuration", "status": "error"}
        )

@router.post("/update_knowledge_list")
def update_knowledge_list(
    authorization: Optional[str] = Header(None),
    knowledge_list: List[str] = Body(None)
):
    try:
        user_id, tenant_id = get_user_info()
        result = update_selected_knowledge(tenant_id=tenant_id, user_id=user_id, index_name_list=knowledge_list)
        if result:
            return JSONResponse(
                status_code=200,
                content={"message": "update success", "status": "success"}
            )
        else:
            return JSONResponse(
                status_code=400,
                content={"message": "update failed", "status": "error"}
        )
    except Exception as e:
        logger.error(f"update knowledge list failed, error: {e}")
        return JSONResponse(
            status_code=400,
            content={"message": "Failed to update configuration", "status": "error"}
        )
