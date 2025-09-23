import logging
from http import HTTPStatus

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse

from consts.exceptions import TimeoutException, NotFoundException, MEConnectionException
from services.me_model_management_service import get_me_models_impl, check_me_variable_set
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
        # Pre-check ME environment variables; return empty list if not configured
        if not await check_me_variable_set():
            return JSONResponse(
                status_code=HTTPStatus.OK,
                content={
                    "message": "Retrieve skipped",
                    "data": []
                }
            )
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
        raise HTTPException(status_code=HTTPStatus.REQUEST_TIMEOUT, detail="Failed to get ModelEngine model list: timeout")
    except NotFoundException as e:
        logging.error(f"Request me model not found: {str(e)}")
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="ModelEngine model not found")
    except Exception as e:
        logging.error(f"Failed to get me model list: {str(e)}")
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Failed to get ModelEngine model list")


@router.get("/healthcheck")
async def check_me_connectivity(timeout: int = Query(default=2, description="Timeout in seconds")):
    """
    Health check from model engine API
    """
    try:
        # Pre-check ME environment variables; return not connected if not configured
        if not await check_me_variable_set():
            return JSONResponse(
                status_code=HTTPStatus.OK,
                content={
                    "connectivity": False,
                    "message": "ModelEngine platform necessary environment variables not configured. Healthcheck skipped.",
                }
            )
        await check_me_connectivity_impl(timeout)
        return JSONResponse(
            status_code=HTTPStatus.OK,
            content={
                "connectivity": True,
                "message": "ModelEngine platform connect successfully.",
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
