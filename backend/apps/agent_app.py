import asyncio
import logging
import time
from threading import Thread

from fastapi import HTTPException, APIRouter, Header
from fastapi.responses import StreamingResponse

from consts.model import AgentRequest, AgentInfoRequest, CreatingSubAgentIDRequest
from database.agent_db import delete_agent, update_agent, query_tool_instances, search_agent_info_by_agent_id_api
from nexent.core.utils.observer import MessageObserver
from services.agent_service import query_or_create_main_agents_api, \
    query_sub_agents_api, get_creating_sub_agent_id_api, get_enable_tool_id_by_agent_id, \
    get_enable_sub_agent_id_by_agent_id
from services.conversation_management_service import save_conversation_user, save_conversation_assistant
from utils.agent_utils import agent_run_thread
from utils.agent_utils import thread_manager
from utils.config_utils import config_manager
from utils.thread_utils import submit
from utils.user_utils import get_user_info

router = APIRouter(prefix="/agent")
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define API route
@router.post("/run")
async def agent_run_api(request: AgentRequest, authorization: str = Header(None)):
    """
    Agent execution API endpoint
    """
    # Ensure configuration is up to date
    config_manager.load_config()
    # Save user message only if not in debug mode
    if not request.is_debug:
        submit(save_conversation_user, request, authorization)
    minio_files = request.minio_files
    final_query = request.query
    if minio_files and isinstance(minio_files, list):
        file_descriptions = []
        for file in minio_files:
            if isinstance(file, dict) and "description" in file and file["description"]:
                file_descriptions.append(file["description"])

        if file_descriptions:
            final_query = "User provided some reference files:\n"
            final_query += "\n".join(file_descriptions) + "\n\n"
            final_query += f"User wants to answer questions based on the above information: {request.query}"

    observer = MessageObserver()
    try:
        # Generate unique thread ID
        thread_id = f"{time.time()}_{id(observer)}"

        thread_agent = Thread(target=agent_run_thread,
                              args=(observer, final_query, request.history))
        thread_agent.start()

        # Add thread to manager
        thread_manager.add_thread(thread_id, thread_agent)

        async def generate():
            messages = []
            try:
                while thread_agent.is_alive():
                    cached_message = observer.get_cached_message()
                    for message in cached_message:
                        yield f"data: {message}\n\n"
                        messages.append(message)

                        # Prevent artificial slowdown of model streaming output
                        if len(cached_message) < 8:
                            # Ensure streaming output has some time interval
                            await asyncio.sleep(0.05)
                    await asyncio.sleep(0.1)

                # Ensure all messages are sent
                cached_message = observer.get_cached_message()
                for message in cached_message:
                    yield f"data: {message}\n\n"
                    messages.append(message)
            except asyncio.CancelledError:
                # Stop thread when client disconnects
                thread_manager.stop_thread(thread_id)
                raise
            finally:
                # Clean up thread
                thread_manager.remove_thread(thread_id)
                # Save assistant message only if not in debug mode
                if not request.is_debug:
                    submit(save_conversation_assistant, request, messages, authorization)

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        )
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
async def list_agent():
    """
    List all agents, create if the main Agent cannot be found.
    """
    try:
        user_id, tenant_id = get_user_info()
        main_agent_id = query_or_create_main_agents_api(tenant_id=tenant_id)
        main_agent_info = search_agent_info_by_agent_id_api(agent_id=main_agent_id, tenant_id=tenant_id, user_id=user_id)

        sub_agent_list = query_sub_agents_api(main_agent_id, tenant_id, user_id)
        enable_tool_id_list = get_enable_tool_id_by_agent_id(main_agent_id, tenant_id, user_id)
        enable_agent_id_list = get_enable_sub_agent_id_by_agent_id(main_agent_id, tenant_id, user_id)

        return {
            "main_agent_id": main_agent_id,
            "sub_agent_list": sub_agent_list,
            "enable_tool_id_list": enable_tool_id_list,
            "enable_agent_id_list": enable_agent_id_list,
            "model_name": main_agent_info["model_name"],
            "max_steps": main_agent_info["max_steps"],
            "business_description": main_agent_info["business_description"],
            "prompt": main_agent_info["prompt"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent list error: {str(e)}")


@router.post("/search_info")
async def get_agent_info(request: AgentInfoRequest):
    """
    Search agent info by agent_id
    """
    try:
        user_id, tenant_id = get_user_info()
        agent_info = search_agent_info_by_agent_id_api(request.agent_id, tenant_id, user_id)
        return agent_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent search info error: {str(e)}")


@router.post("/get_creating_sub_agent_id")
async def get_creating_sub_agent_id(request: CreatingSubAgentIDRequest):
    """
    Create a new sub agent, return agent_ID
    """
    try:
        user_id, tenant_id = get_user_info()
        sub_agent_id = get_creating_sub_agent_id_api(request.main_agent_id, tenant_id)
        enable_tool_id_list = get_enable_tool_id_by_agent_id(sub_agent_id, tenant_id, user_id)

        agent_info = search_agent_info_by_agent_id_api(agent_id=sub_agent_id, tenant_id=tenant_id, user_id=user_id)

        return {"agent_id": sub_agent_id,
                "enable_tool_id_list": enable_tool_id_list,
                "model_name": agent_info["model_name"],
                "max_steps": agent_info["max_steps"],
                "business_description": agent_info["business_description"],
                "prompt": agent_info["prompt"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent create error: {str(e)}")


@router.post("/update")
async def update_agent_info(request: AgentInfoRequest):
    """
    Update an existing agent
    """
    try:
        user_id, tenant_id = get_user_info()
        update_agent(request.agent_id, request, tenant_id, user_id)
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent update error: {str(e)}")


@router.delete("")
async def delete_agent_api(request: AgentInfoRequest):
    """
    Delete an agent
    """
    try:
        user_id, tenant_id = get_user_info()
        return delete_agent(request, tenant_id, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent delete error: {str(e)}")



