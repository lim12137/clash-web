import asyncio
import logging

from fastapi import HTTPException, APIRouter, Header, Request
from fastapi.responses import StreamingResponse

from agents.build_agent_run_info import create_agent_run_info
from consts.model import AgentRequest, AgentInfoRequest, AgentIDRequest
from services.agent_service import list_main_agent_info_impl, get_agent_info_impl, \
    get_creating_sub_agent_info_impl, update_agent_info_impl, delete_agent_impl
from services.conversation_management_service import save_conversation_user, save_conversation_assistant
from utils.config_utils import config_manager
from utils.thread_utils import submit

from nexent.core.utils.agent_utils import agent_run

router = APIRouter(prefix="/agent")
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent app")

# Define API route
@router.post("/run")
async def agent_run_api(request: AgentRequest, http_req: Request, authorization: str = Header(None)):
    """
    Agent execution API endpoint
    """
    # Save user message only if not in debug mode
    if not request.is_debug:
        submit(save_conversation_user, request, authorization)

    agent_run_info = await create_agent_run_info(agent_id=request.agent_id,
                                                 minio_files=request.minio_files,
                                                 query=request.query)

    async def generate():
        messages = []
        try:
            async for chunk in agent_run(agent_run_info):
                if await http_req.is_disconnected():
                    agent_run_info.stop_event.set()
                    break

                messages.append(chunk)
                yield f"data: {chunk}\n\n"
            
        except asyncio.CancelledError:
            agent_run_info.stop_event.set()
            raise HTTPException(status_code=499, detail="stopped by user")
        finally:
            if not request.is_debug:
                submit(save_conversation_assistant, request, messages, authorization)

    try:
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        )
    except asyncio.CancelledError:
        agent_run_info.stop_event.set()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution error: {str(e)}")


# Add configuration reload API
@router.post("/reload_config")
async def reload_config():
    """
    Manually trigger configuration reload
    """
    return config_manager.force_reload()


@router.get("/list")
async def list_main_agent_info_api():
    """
    List all agents, create if the main Agent cannot be found.
    """
    try:
        return list_main_agent_info_impl()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent list error: {str(e)}")


@router.post("/search_info")
async def search_agent_info_api(request: AgentInfoRequest):
    """
    Search agent info by agent_id
    """
    try:
        return get_agent_info_impl(request.agent_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent search info error: {str(e)}")


@router.post("/get_creating_sub_agent_id")
async def get_creating_sub_agent_info_api(request: AgentIDRequest):
    """
    Create a new sub agent, return agent_ID
    """
    try:
        return get_creating_sub_agent_info_impl(request.agent_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent create error: {str(e)}")


@router.post("/update")
async def update_agent_info_api(request: AgentInfoRequest):
    """
    Update an existing agent
    """
    try:
        update_agent_info_impl(request)
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent update error: {str(e)}")


@router.delete("")
async def delete_agent_api(request: AgentIDRequest):
    """
    Delete an agent
    """
    try:
        delete_agent_impl(request.agent_id)
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent delete error: {str(e)}")



