from fastapi import HTTPException, APIRouter, Header
from services.prompt_service import generate_system_prompt, fine_tune_prompt
import logging
from consts.model import GeneratePromptRequest, FineTunePromptRequest

router = APIRouter(prefix="/prompt")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.post("/generate")
async def generate_system_prompt_service(request: GeneratePromptRequest):
    try:
        system_prompt = generate_system_prompt(request)
        return {"success": True, "data": system_prompt}
    except Exception as e:
        logger.error(f"Error occurred while generating system prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Error occurred while generating system prompt: {str(e)}")


@router.post("/fine_tune")
async def fine_tune_system_prompt_service(request: FineTunePromptRequest):
    try:
        system_prompt = fine_tune_prompt(request)
        return {"success": True, "data": system_prompt}
    except Exception as e:
        logger.error(f"Error occurred while fine tuning system prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Error occurred while fine tuning system prompt: {str(e)}")