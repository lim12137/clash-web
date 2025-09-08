from http import HTTPStatus

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from services.me_model_management_service import get_me_models_impl
from services.model_health_service import check_me_model_connectivity, check_me_connectivity_impl

router = APIRouter(prefix="/me")


@router.get("/model/list")
async def get_me_models(
        type: str = Query(
            default="", description="Model type: embed/chat/rerank"),
        timeout: int = Query(
            default=2, description="Request timeout in seconds")
):
    """
    Get list of models from model engine API
    """
    code, message, data = await get_me_models_impl(timeout=timeout, type=type)
    return JSONResponse(
        status_code=HTTPStatus.OK,
        content={
            "code": code,
            "message": message,
            "data": data
        }
    )


@router.get("/healthcheck")
async def check_me_connectivity(timeout: int = Query(default=2, description="Timeout in seconds")):
    """
    Health check from model engine API
    """
    code, message, data = await check_me_connectivity_impl(timeout)
    return JSONResponse(
        status_code=HTTPStatus.OK,
        content={
            "code": code,
            "message": message,
            "data": data
        }
    )


@router.get("/model/healthcheck")
async def check_me_model_healthcheck(
        model_name: str = Query(..., description="Model name to check")
):
    code, message, data = await check_me_model_connectivity(model_name)
    return JSONResponse(
        status_code=HTTPStatus.OK,
        content={
        "code": code,
        "message": message,
        "data": data
    })
