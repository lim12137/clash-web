from typing import Optional

from fastapi import Query, Body, APIRouter, Header

from consts.model import ModelConnectStatusEnum, ModelResponse, ModelRequest
from database.model_management_db import create_model_record, update_model_record, delete_model_record, \
    get_model_records, get_model_by_name, get_model_by_display_name
from database.utils import get_current_user_id
from services.model_health_service import check_model_connectivity, verify_model_config_connectivity
from utils.model_name_utils import split_repo_name, add_repo_to_name
from utils.auth_utils import get_current_user_id

router = APIRouter(prefix="/model")


@router.post("/create", response_model=ModelResponse)
async def create_model(request: ModelRequest, authorization: Optional[str] = Header(None)):
    try:
        user_id, tenant_id = get_current_user_id(authorization)
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
            existing_model_by_display = get_model_by_display_name(model_data["display_name"], tenant_id)
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
            create_model_record(model_data, user_id, tenant_id)
            
            # Create the embedding record with the same data but different model_type
            embedding_data = model_data.copy()
            embedding_data["model_type"] = "embedding"
            create_model_record(embedding_data, user_id, tenant_id)
            
            return ModelResponse(
                code=200,
                message=f"Multimodal embedding model {add_repo_to_name(model_repo, model_name)} created successfully",
                data=None
            )
        else:
            # For non-multimodal models, just create one record
            create_model_record(model_data, user_id, tenant_id)
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
    try:
        user_id = get_current_user_id(authorization)
        model_data = request.model_dump()
        # Split model_name
        model_repo, model_name = split_repo_name(model_data["model_name"])
        # Ensure model_repo is empty string instead of null
        model_data["model_repo"] = model_repo if model_repo else ""
        model_data["model_name"] = model_name

        # Use non-empty status value
        model_data["connect_status"] = model_data.get("connect_status") or ModelConnectStatusEnum.NOT_DETECTED.value

        # Check if model exists
        existing_model = get_model_by_name(model_name, model_repo)
        if not existing_model:
            return ModelResponse(
                code=404,
                message=f"Model not found: {add_repo_to_name(model_repo, model_name)}",
                data=None
            )

        # If display name is provided and different from existing, check for duplicates
        if model_data.get("display_name") and model_data["display_name"] != existing_model.get("display_name"):
            existing_model_by_display = get_model_by_display_name(model_data["display_name"])
            if existing_model_by_display and existing_model_by_display["model_id"] != existing_model["model_id"]:
                return ModelResponse(
                    code=409,
                    message=f"Display name {model_data['display_name']} is already in use, please choose another display name",
                    data=None
                )

        # Update model record
        update_model_record(existing_model["model_id"], model_data, user_id)
        return ModelResponse(
            code=200,
            message=f"Model {add_repo_to_name(model_repo, model_name)} updated successfully",
            data={"model_name": add_repo_to_name(model_repo, model_name)}
        )
    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"Failed to update model: {str(e)}",
            data=None
        )


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
        user_id, tenant_id = get_current_user_id(authorization)
        # Find model by display_name
        model = get_model_by_display_name(display_name, tenant_id)
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
                m = get_model_by_display_name(display_name, tenant_id)
                if m and m["model_type"] == t:
                    delete_model_record(m["model_id"], user_id, tenant_id)
                    deleted_types.append(t)
        else:
            delete_model_record(model["model_id"], user_id, tenant_id)
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
async def get_model_list(authorization: Optional[str] = Header(None)):
    """
    Get detailed information for all models
    """
    try:
        user_id, tenant_id = get_current_user_id(authorization)
        records = get_model_records(None, tenant_id)

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
        display_name: str = Query(..., description="Display name to check"),
        authorization: Optional[str] = Header(None)
):
    """
    Check and update model connectivity (health check), and return the latest status.
    Args:
        display_name: display_name of the model to check
    Returns:
        ModelResponse: contains connectivity and latest status
    """
    return await check_model_connectivity(display_name, authorization)



@router.post("/update_connect_status", response_model=ModelResponse)
async def update_model_connect_status(
        model_name: str = Body(..., embed=True),
        connect_status: str = Body(..., embed=True),
        authorization: Optional[str] = Header(None)
):
    """
    Update model connection status

    Args:
        model_name: Model name, including repository info, e.g. openai/gpt-3.5-turbo
        connect_status: New connection status
        authorization: Authorization header
    """
    try:
        user_id = get_current_user_id(authorization)
        # Split model_name
        repo, name = split_repo_name(model_name)
        # Ensure repo is empty string instead of null
        repo = repo if repo else ""

        # Query model information
        model = get_model_by_name(name, repo)
        if not model:
            return ModelResponse(
                code=404,
                message=f"Model not found: {model_name}",
                data={"connect_status": ""}
            )

        # Update connection status
        update_data = {"connect_status": connect_status}
        update_model_record(model["model_id"], update_data, user_id)

        return ModelResponse(
            code=200,
            message=f"Successfully updated connection status for model {model_name}",
            data={
                "model_name": model_name,
                "connect_status": connect_status
            }
        )
    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"Failed to update model connection status: {str(e)}",
            data={"connect_status": ModelConnectStatusEnum.NOT_DETECTED.value}
        )


@router.post("/verify_config", response_model=ModelResponse)
async def verify_model_config(request: ModelRequest):
    """
    Verify the connectivity of the model configuration, do not save to database
    Args:
        request: model configuration information
    Returns:
        ModelResponse: contains connectivity test result
    """
    try:
        from services.model_health_service import verify_model_config_connectivity

        model_data = request.model_dump()

        # Call the verification service directly, do not split model_name
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

