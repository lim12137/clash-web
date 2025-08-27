import logging
from typing import Optional, Dict
import uuid

from fastapi import APIRouter, Body, Header, Request

from consts.exceptions import UnauthorizedError
from services.northbound_service import (
    NorthboundContext,
    get_conversation_history,
    list_conversations,
    start_streaming_chat,
    stop_chat,
    get_agent_info_list,
    update_conversation_title
)

from utils.auth_utils import get_current_user_id, validate_aksk_authentication


router = APIRouter(prefix="/nb/v1", tags=["northbound"])


def _get_header(headers: Dict[str, str], name: str) -> Optional[str]:
    for k, v in headers.items():
        if k.lower() == name.lower():
            return v
    return None


async def _parse_northbound_context(request: Request) -> NorthboundContext:
    """
    Build northbound context from headers.

    - X-Access-Key: Access key for AK/SK authentication
    - X-Timestamp: Timestamp for signature validation
    - X-Signature: HMAC-SHA256 signature signed with secret key
    - Authorization: Bearer <jwt>, jwt contains sub (user_id)
    - X-Request-Id: optional, generated if not provided
    """
    # 1. Verify AK/SK signature
    try:
        # Get request body for signature verification
        request_body = ""
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body_bytes = await request.body()
                request_body = body_bytes.decode('utf-8') if body_bytes else ""
            except Exception as e:
                logging.warning(f"Cannot read request body for signature verification: {e}")
                request_body = ""
        
        validate_aksk_authentication(request.headers, request_body)
    except Exception as e:
        raise UnauthorizedError(f"AK/SK authentication failed: {str(e)}")

    # 2. Parse JWT token
    auth_header = _get_header(request.headers, "Authorization")
    if not auth_header:
        raise UnauthorizedError("No authorization header found. Cannot authenticate.")

    # Use auth_utils to parse JWT token
    try:
        user_id, tenant_id = get_current_user_id(auth_header)
        
        if not user_id:
            raise UnauthorizedError("Missing user_id in JWT token")
        if not tenant_id:
            raise UnauthorizedError("No related tenant_id found with user_id in JWT token")
            
    except Exception as e:
        raise UnauthorizedError(f"Error occurred when parsing JWT: {str(e)}")

    request_id = _get_header(request.headers, "X-Request-Id") or str(uuid.uuid4())

    return NorthboundContext(
        request_id=request_id,
        tenant_id=tenant_id,
        user_id=str(user_id),
        authorization=auth_header,
    )


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "northbound-api"}


@router.post("/chat/run")
async def run_chat(
    request: Request,
    conversation_id: str = Body(..., embed=True),
    agent_name: str = Body(..., embed=True),
    query: str = Body(..., embed=True),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    ctx: NorthboundContext = await _parse_northbound_context(request)
    return await start_streaming_chat(
        ctx=ctx,
        external_conversation_id=conversation_id,
        agent_name=agent_name,
        query=query,
        idempotency_key=idempotency_key,
    )


@router.get("/chat/stop/{conversation_id}")
async def stop_chat_stream(request: Request, conversation_id: str):
    ctx: NorthboundContext = await _parse_northbound_context(request)
    return await stop_chat(ctx=ctx, external_conversation_id=conversation_id)


@router.get("/conversations/{conversation_id}")
async def get_history(request: Request, conversation_id: str):
    ctx: NorthboundContext = await _parse_northbound_context(request)
    return await get_conversation_history(ctx=ctx, external_conversation_id=conversation_id)


@router.get("/agents")
async def list_agents(request: Request):
    ctx: NorthboundContext = await _parse_northbound_context(request)
    return await get_agent_info_list(ctx=ctx)


@router.get("/conversations")
async def list_convs(request: Request):
    ctx: NorthboundContext = await _parse_northbound_context(request)
    return await list_conversations(ctx=ctx)


@router.put("/conversations/{conversation_id}/title")
async def update_convs_title(
    request: Request,
    conversation_id: str,
    title: str,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    ctx: NorthboundContext = await _parse_northbound_context(request)
    result = await update_conversation_title(
        ctx=ctx,
        external_conversation_id=conversation_id,
        title=title,
        idempotency_key=idempotency_key,
    )
    from fastapi.responses import JSONResponse

    headers_out = {"Idempotency-Key": result.get("idempotency_key", ""), "X-Request-Id": ctx.request_id}
    return JSONResponse(content=result, headers=headers_out)