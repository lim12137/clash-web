from fastapi import HTTPException, APIRouter, Header
from services.prompt_service import generate_and_save_system_prompt_impl, fine_tune_prompt
import logging
from consts.model import GeneratePromptRequest, FineTunePromptRequest
from functools import partial
import asyncio

router = APIRouter(prefix="/prompt")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prompt app")


@router.post("/generate")
async def generate_and_save_system_prompt_api(request: GeneratePromptRequest):
    try:
        # 使用 run_in_executor 将同步函数转换为异步执行
        loop = asyncio.get_event_loop()
        system_prompt = await loop.run_in_executor(
            None,
            partial(
                generate_and_save_system_prompt_impl,
                agent_id=request.agent_id,
                task_description=request.task_description
            )
        )
        return {"success": True, "data": system_prompt}
    except Exception as e:
        logger.exception(f"Error occurred while generating system prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Error occurred while generating system prompt: {str(e)}")


@router.post("/fine_tune")
async def fine_tune_system_prompt_api(request: FineTunePromptRequest):
    try:
        system_prompt = fine_tune_prompt(system_prompt=request.system_prompt, command=request.command)
        return {"success": True, "data": system_prompt}
    except Exception as e:
        logger.exception(f"Error occurred while fine tuning system prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Error occurred while fine tuning system prompt: {str(e)}")
