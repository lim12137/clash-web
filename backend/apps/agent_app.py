import asyncio
import time
from threading import Thread

from fastapi import HTTPException, APIRouter, Header
from fastapi.responses import StreamingResponse

from consts.model import AgentRequest, AgentInfoRequest, AgentToolInfoRequest
from database.agent_db import create_or_update_tool, query_tools, delete_agent, update_agent
from nexent.core.utils.observer import MessageObserver
from services.agent_service import create_agent_api, query_agents_api
from services.conversation_management_service import save_conversation_user, save_conversation_assistant
from utils.agent_utils import agent_run_thread
from utils.agent_utils import thread_manager
from utils.config_utils import config_manager
from utils.thread_utils import submit
from utils.user_utils import get_user_info

router = APIRouter(prefix="/agent")


# Define API route
@router.post("/run")
async def agent_run_api(request: AgentRequest, authorization: str = Header(None)):
    """
    Agent execution API endpoint
    """
    # Ensure configuration is up to date
    config_manager.load_config()
    # Save user message
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


@router.post("/list")
async def list_agent():
    """
    List all agents, create if the main Agent cannot be found.
    """
    user_id, tenant_id = get_user_info()
    return query_agents_api(tenant_id, user_id)


@router.post("/create")
async def create_agent_info(request: AgentInfoRequest):
    """
    Create a new sub agent
    """
    user_id, tenant_id = get_user_info()
    return create_agent_api(request, tenant_id, user_id)


@router.delete("")
async def delete_agent_api(request: AgentInfoRequest):
    """
    Delete an agent
    """
    user_id, tenant_id = get_user_info()
    return delete_agent(request, tenant_id, user_id)


@router.post("/update")
async def update_agent_info(request: AgentInfoRequest):
    """
    Update an existing agent
    """
    user_id, tenant_id = get_user_info()
    return update_agent(request.agent_id, request, tenant_id, user_id)


@router.get("/tools")
async def list_tools():
    """
    List all system tools
    """
    return query_tools()


@router.post("/update/tool")
async def update_tool_info(request: AgentToolInfoRequest):
    """
    Update an existing tool
    """
    user_id, tenant_id = get_user_info()
    return create_or_update_tool(request, tenant_id, request.agent_id, user_id)
