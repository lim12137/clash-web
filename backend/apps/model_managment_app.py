from typing import Optional

from fastapi import Query, Body, APIRouter, Header

from consts.model import ModelConnectStatusEnum, ModelResponse, ModelRequest
from database.model_management_db import create_model_record, delete_model_record, \
    get_model_records, get_model_by_display_name
from services.model_health_service import check_model_connectivity, verify_model_config_connectivity
from utils.model_name_utils import split_repo_name, add_repo_to_name

router = APIRouter(prefix="/model")


@router.post("/create", response_model=ModelResponse)
async def create_model(request: ModelRequest, authorization: Optional[str] = Header(None)):
    try:
        model_data = request.model_dump()
        # Split model_name
        model_repo, model_name = split_repo_name(model_data["model_name"])
        # Ensure model_repo is empty string instead of null
        model_data["model_repo"] = model_repo if model_repo else ""
        model_data["model_name"] = model_name

        if not model_data.get("display_name"):
            model_data["display_name"] = model_name

        # Use NOT_DETECTED status as default
        model_data["connect_status"] = model_data.get("connect_status") or ModelConnectStatusEnum.NOT_DETECTED.value

        # Check if display_name conflicts
        if model_data.get("display_name"):
            existing_model_by_display = get_model_by_display_name(model_data["display_name"])
            if existing_model_by_display:
                return ModelResponse(
                    code=409,
                    message=f"Name {model_data['display_name']} is already in use, please choose another display name",
                    data=None
                )

        # Check if this is a multimodal embedding model
        is_multimodal = model_data.get("model_type") == "multi_embedding"
        
        # If it's multi_embedding type, create both embedding and multi_embedding records
        if is_multimodal:
            # Create the multi_embedding record
            create_model_record(model_data)
            
            # Create the embedding record with the same data but different model_type
            embedding_data = model_data.copy()
            embedding_data["model_type"] = "embedding"
            create_model_record(embedding_data)
            
            return ModelResponse(
                code=200,
                message=f"Multimodal embedding model {add_repo_to_name(model_repo, model_name)} created successfully",
                data=None
            )
        else:
            # For non-multimodal models, just create one record
            create_model_record(model_data)
            return ModelResponse(
                code=200,
                message=f"Model {add_repo_to_name(model_repo, model_name)} created successfully",
                data=None
            )
    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"Failed to create model: {str(e)}",
            data=None
        )


@router.post("/update", response_model=ModelResponse)
def update_model(request: ModelRequest, authorization: Optional[str] = Header(None)):
    raise Exception("Not implemented")


@router.post("/delete", response_model=ModelResponse)
async def delete_model(display_name: str = Query(..., embed=True), authorization: Optional[str] = Header(None)):
    """
    Soft delete the specified model by display_name
    If the model is an embedding or multi_embedding type, both types will be deleted

    Args:
        display_name: Display name of the model to delete (唯一键)
        authorization: Authorization header
    """
    try:
        # Find model by display_name
        model = get_model_by_display_name(display_name)
        if not model:
            return ModelResponse(
                code=404,
                message=f"Model not found: {display_name}",
                data=None
            )
        # 支持 embedding/multi_embedding 互删
        deleted_types = []
        if model["model_type"] in ["embedding", "multi_embedding"]:
            # 查找所有 embedding/multi_embedding 且 display_name 相同的模型
            for t in ["embedding", "multi_embedding"]:
                m = get_model_by_display_name(display_name)
                if m and m["model_type"] == t:
                    delete_model_record(m["model_id"])
                    deleted_types.append(t)
        else:
            delete_model_record(model["model_id"])
            deleted_types.append(model.get("model_type", "unknown"))
        return ModelResponse(
            code=200,
            message=f"Successfully deleted model(s) in types: {', '.join(deleted_types)}",
            data={"display_name": display_name}
        )
    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"Failed to delete model: {str(e)}",
            data=None
        )


@router.get("/list", response_model=ModelResponse)
async def get_model_list():
    """
    Get detailed information for all models
    """
    try:
        records = get_model_records()

        result = []
        # Use add_repo_to_name method for each record to add repo prefix to model_name
        for record in records:
            record["model_name"] = add_repo_to_name(
                model_repo=record["model_repo"],
                model_name=record["model_name"]
            )
            # Handle connect_status, use default value "Not Detected" if empty
            record["connect_status"] = ModelConnectStatusEnum.get_value(record.get("connect_status"))
            result.append(record)

        return ModelResponse(
            code=200,
            message="Successfully retrieved model list",
            data=result
        )
    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"Failed to retrieve model list: {str(e)}",
            data=[]
        )


@router.post("/healthcheck", response_model=ModelResponse)
async def check_model_healthcheck(
        display_name: str = Query(..., description="Display name to check")
):
    """
    检查并更新模型连通性（健康检查），并返回最新状态。
    Args:
        display_name: 需要检查的模型 display_name
    Returns:
        ModelResponse: 包含连通性和最新状态
    """
    return await check_model_connectivity(display_name)


@router.post("/verify_config", response_model=ModelResponse)
async def verify_model_config(request: ModelRequest):
    """
    验证模型配置的连通性，不保存到数据库
    Args:
        request: 模型配置信息
    Returns:
        ModelResponse: 包含连通性测试结果
    """
    try:
        from services.model_health_service import verify_model_config_connectivity
        
        model_data = request.model_dump()
        
        # 直接调用验证服务，不进行 model_name 的拆分
        result = await verify_model_config_connectivity(model_data)
        
        return result
    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"验证模型配置失败: {str(e)}",
            data={
                "connectivity": False,
                "message": f"验证失败: {str(e)}",
                "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value
            }
        )

