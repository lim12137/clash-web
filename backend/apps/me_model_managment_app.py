import logging
from http import HTTPStatus

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse

from consts.exceptions import TimeoutException, NotFoundException, MEConnectionException
from consts.model import ModelConnectStatusEnum
from services.me_model_management_service import get_me_models_impl
from services.model_health_service import check_me_connectivity_impl

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
    try:
        filtered_result = await get_me_models_impl(timeout=timeout, type=type)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={
                "message": "Successfully retrieved",
                "data": filtered_result
            }
        )
    except TimeoutException as e:
        logging.error(f"Request me model timeout: {str(e)}")
        return JSONResponse(status_code=HTTPStatus.REQUEST_TIMEOUT, content={
            "message": f"Request me model timeout: {str(e)}",
            "data": []
        })
    except NotFoundException as e:
        logging.error(f"Request me model not found: {str(e)}")
        return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={
            "message": f"Request me model not found: {str(e)}",
            "data": []
        })
    except Exception as e:
        logging.error(f"Failed to get me model list: {str(e)}")
        return JSONResponse(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, content={
            "message": f"Failed to get me model list: {str(e)}",
            "data": []
        })


@router.get("/healthcheck")
async def check_me_connectivity(timeout: int = Query(default=2, description="Timeout in seconds")):
    """
    Health check from model engine API
    """
    try:
        await check_me_connectivity_impl(timeout)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={
                "connectivity": True,
                "message": "ModelEngine model connect successfully.",
            }
        )
    except MEConnectionException as e:
        logging.error(f"ModelEngine model healthcheck failed: {str(e)}")
        raise HTTPException(status_code=HTTPStatus.SERVICE_UNAVAILABLE, detail="ModelEngine model connect failed.")
    except TimeoutException as e:
        logging.error(f"ModelEngine model healthcheck timeout: {str(e)}")
        raise HTTPException(status_code=HTTPStatus.REQUEST_TIMEOUT, detail="ModelEngine model connect timeout.")
    except Exception as e:
        logging.error(f"ModelEngine model healthcheck failed with unknown error: {str(e)}.")
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="ModelEngine model connect failed.")
