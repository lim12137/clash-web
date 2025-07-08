import json
import logging

from fastapi import HTTPException, APIRouter, Header, Request
from fastapi.responses import StreamingResponse
from typing import Optional

from consts.model import GeneratePromptRequest, FineTunePromptRequest
from services.prompt_service import generate_and_save_system_prompt_impl, fine_tune_prompt
from utils.auth_utils import get_current_user_info

router = APIRouter(prefix="/prompt")

# Configure logging
logger = logging.getLogger("prompt_app")


@router.post("/generate")
async def generate_and_save_system_prompt_api(prompt_request: GeneratePromptRequest, http_request: Request, 
                                            authorization: Optional[str] = Header(None)):
    try:
        def gen_system_prompt():
            for system_prompt in generate_and_save_system_prompt_impl(
                    agent_id=prompt_request.agent_id,
                    task_description=prompt_request.task_description,
                    authorization=authorization,
                    request=http_request
            ):
                # SSE format, each message ends with \n\n
                yield f"data: {json.dumps({'success': True, 'data': system_prompt}, ensure_ascii=False)}\n\n"

        return StreamingResponse(gen_system_prompt(), media_type="text/event-stream")
    except Exception as e:
        logger.exception(f"Error occurred while generating system prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Error occurred while generating system prompt: {str(e)}")


@router.post("/fine_tune")
async def fine_tune_prompt_api(prompt_request: FineTunePromptRequest, http_request: Request,
                              authorization: Optional[str] = Header(None)):
    try:
        _, tenant_id, language = get_current_user_info(authorization, http_request)
        
        result = fine_tune_prompt(
            system_prompt=prompt_request.system_prompt,
            command=prompt_request.command,
            tenant_id=tenant_id,
            language=language
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.exception(f"Error occurred while fine-tuning prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Error occurred while fine-tuning prompt: {str(e)}")
