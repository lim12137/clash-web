import logging
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import HTTPException, APIRouter, Header

from consts.model import ConversationResponse, ConversationRequest, RenameRequest, GenerateTitleRequest, OpinionRequest
from database.conversation_db import create_conversation, get_conversation_list, rename_conversation, \
    delete_conversation, \
    get_conversation_history, get_source_images_by_message, get_source_images_by_conversation, \
    get_source_searches_by_message, get_source_searches_by_conversation, get_conversation, update_message_opinion
from utils.conversation_management_utils import extract_user_messages, call_llm_for_title, update_conversation_title

router = APIRouter(prefix="/conversation")


@router.put("/create", response_model=ConversationResponse)
async def create_new_conversation(request: ConversationRequest, authorization: Optional[str] = Header(None)):
    """
    Create a new conversation

    Args:
        request: ConversationRequest object containing:
            - title: Conversation title, default is "New Conversation"
        authorization: Authorization header

    Returns:
        ConversationResponse object containing:
            - conversation_id: Conversation ID
            - conversation_title: Conversation title
            - create_time: Creation timestamp (milliseconds)
            - update_time: Update timestamp (milliseconds)
    """
    try:
        conversation_data = create_conversation(request.title)

        return ConversationResponse(
            code=0,
            message="success",
            data=conversation_data
        )

    except Exception as e:
        logging.error(f"Failed to create conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list", response_model=ConversationResponse)
async def list_conversations(authorization: Optional[str] = Header(None)):
    """
    Get all conversation list

    Args:
        authorization: Authorization header

    Returns:
        ConversationResponse object:
            - code: 0 indicates success
            - data: Conversation list, each conversation contains:
                - conversation_id: Conversation ID
                - conversation_title: Conversation title
                - create_time: Creation timestamp (milliseconds)
                - update_time: Update timestamp (milliseconds)
            - message: "success" success message
    """
    try:
        conversations = get_conversation_list()

        return ConversationResponse(
            code=0,
            message="success",
            data=conversations
        )

    except Exception as e:
        logging.error(f"Failed to get conversation list: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rename", response_model=ConversationResponse)
async def rename_conversation_title(request: RenameRequest, authorization: Optional[str] = Header(None)):
    """
    Rename a conversation

    Args:
        request: RenameRequest object containing:
            - conversation_id: Conversation ID (integer)
            - name: New conversation title
        authorization: Authorization header

    Returns:
        ConversationResponse object:
            - code: 0 indicates success
            - data: true indicates successful rename
            - message: "success" success message
    """
    try:
        success = rename_conversation(request.conversation_id, request.name)

        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Conversation {request.conversation_id} does not exist or has been deleted"
            )

        return ConversationResponse(
            code=0,
            message="success",
            data=True
        )

    except Exception as e:
        logging.error(f"Failed to rename conversation: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{conversation_id}", response_model=ConversationResponse)
async def delete_conversation_by_id(conversation_id: int, authorization: Optional[str] = Header(None)):
    """
    Delete specified conversation

    Args:
        conversation_id: Conversation ID to delete (integer)
        authorization: Authorization header

    Returns:
        ConversationResponse object:
            - code: 0 indicates success
            - data: true indicates successful deletion
            - message: "success" success message
    """
    try:
        success = delete_conversation(conversation_id)

        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Conversation {conversation_id} does not exist or has been deleted"
            )

        return ConversationResponse(
            code=0,
            message="success",
            data=True
        )

    except Exception as e:
        logging.error(f"Failed to delete conversation: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation_history_by_id(conversation_id: int, authorization: Optional[str] = Header(None)):
    """
    Get complete history of specified conversation

    Args:
        conversation_id: Conversation ID (integer)
        authorization: Authorization header

    Returns:
        ConversationResponse object:
            - code: 0 indicates success
            - data: List containing complete conversation history, each conversation contains:
                - conversation_id: Conversation ID
                - create_time: Creation timestamp (milliseconds)
                - message: Message list, each message contains:
                    - role: Message role
                    - message: Basic message unit list
                    - message_id: Database message ID
                    - opinion_flag: Like/dislike status
                    - picture: Image content of the message (if any)
                    - search: Search content of the message (if any)
            - message: "success" success message
    """
    try:
        # Get original conversation history data
        history_data = get_conversation_history(conversation_id)

        if not history_data:
            raise HTTPException(
                status_code=404,
                detail=f"Conversation {conversation_id} does not exist or has been deleted"
            )

        # Collect search content, grouped by message_id
        search_by_message = {}
        for record in history_data['search_records']:
            message_id = record['message_id']
            # Process published_date, ensure it's a datetime object
            published_date = None
            if record['published_date'] is not None:
                if isinstance(record['published_date'], datetime):
                    published_date = record['published_date'].strftime("%Y-%m-%d")
                elif isinstance(record['published_date'], str):
                    published_date = record['published_date']

            # Build search content
            search_item = {"title": record["source_title"], "text": record["source_content"],
                           "source_type": record["source_type"], "url": record["source_location"],
                           "filename": record["source_title"] if record["source_type"] == "file" else None,
                           "published_date": published_date, "score": record["score_overall"],
                           "cite_index": record["cite_index"], "search_type": record["search_type"],
                           "tool_sign": record["tool_sign"], "score_details": {}}

            if record["score_accuracy"] is not None:
                search_item["score_details"]["accuracy"] = record["score_accuracy"]
            if record["score_semantic"] is not None:
                search_item["score_details"]["semantic"] = record["score_semantic"]

            if message_id not in search_by_message:
                search_by_message[message_id] = []
            search_by_message[message_id].append(search_item)

        # Collect image content - grouped by message_id
        image_by_message = {}
        for record in history_data['image_records']:
            message_id = record['message_id']
            if message_id not in image_by_message:
                image_by_message[message_id] = []
            image_by_message[message_id].append(record['image_url'])

        # Sort by message index and build final message list, including images and search content
        messages = []

        for msg in history_data['message_records']:
            message_id = msg['message_id']
            role = msg['role']
            message_content = msg['message_content']

            if role == 'user':
                # User message: directly use message_content as message field value
                message_item = {
                    'role': role,
                    'message': message_content,
                    'message_id': message_id,
                    'opinion_flag': None
                }

                # Add minio_files field (if any)
                if 'minio_files' in msg and msg['minio_files']:
                    message_item['minio_files'] = msg['minio_files']
            else:
                # Assistant message: message is an array, need to add final_answer type message unit
                message_units = msg['units'] or []
                # Add final_answer type message unit
                message_units.append({
                    'type': 'final_answer',
                    'content': message_content
                })

                message_item = {
                    'role': role,
                    'message': message_units,
                    'message_id': message_id,
                    'opinion_flag': msg['opinion_flag']
                }

            # Add image content (if any)
            if message_id in image_by_message:
                message_item['picture'] = image_by_message[message_id]

            # Add search content (if any)
            if message_id in search_by_message:
                message_item['search'] = search_by_message[message_id]

            messages.append(message_item)

        # Build final result
        formatted_history = {
            'conversation_id': str(history_data['conversation_id']),  # Convert to string
            'create_time': history_data['create_time'],
            'message': messages
        }

        return ConversationResponse(
            code=0,
            message="success",
            data=[formatted_history]  # Wrap in list to match expected format
        )

    except Exception as e:
        logging.error(f"Failed to get conversation history: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sources", response_model=Dict[str, Any])
async def get_sources(request: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """
    Get message source information (images and search results)

    Args:
        request: Request body containing optional fields:
            - conversation_id: Conversation ID
            - message_id: Message ID
            - type: Source type, default is "all", options are "image", "search", or "all"
        authorization: Authorization header

    Returns:
        Dict[str, Any]: Response containing:
            - code: 0 indicates success
            - data: Dictionary containing source information:
                - searches: List of search sources
                - images: List of image URLs
            - message: "success" success message
    """
    try:
        conversation_id = request.get("conversation_id")
        message_id = request.get("message_id")
        source_type = request.get("type", "all")

        if not conversation_id and not message_id:
            return {
                "code": 400,
                "message": "Must provide conversation_id or message_id parameter",
                "data": None
            }

        # If conversation ID is provided
        if conversation_id:
            conversation = get_conversation(conversation_id)
            if not conversation:
                return {
                    "code": 404,
                    "message": f"Conversation {conversation_id} does not exist",
                    "data": None
                }

        result = {"searches": [], "images": []}

        # Get image sources
        if source_type in ["image", "all"]:
            images = []
            if message_id:
                image_records = get_source_images_by_message(message_id)
            elif conversation_id:
                image_records = get_source_images_by_conversation(conversation_id)

            for image in image_records:
                images.append(image["image_url"])

            result["images"] = images

        # Get search sources
        if source_type in ["search", "all"]:
            searches = []
            if message_id:
                search_records = get_source_searches_by_message(message_id)
            elif conversation_id:
                search_records = get_source_searches_by_conversation(conversation_id)

            for record in search_records:
                search_item = {
                    "title": record["source_title"],
                    "text": record["source_content"],
                    "source_type": record["source_type"],
                    "url": record["source_location"],
                    "filename": record["source_title"] if record["source_type"] == "file" else None,
                    "published_date": record["published_date"].strftime("%Y-%m-%d") if record[
                        "published_date"] else None,
                    "score": record["score_overall"]
                }

                search_item["score_details"] = {}
                if record["score_accuracy"] is not None:
                    search_item["score_details"]["accuracy"] = record["score_accuracy"]
                if record["score_semantic"] is not None:
                    search_item["score_details"]["semantic"] = record["score_semantic"]

                if conversation_id and not message_id:
                    search_item["message_id"] = record["message_id"]

                searches.append(search_item)

            result["searches"] = searches

        return {
            "code": 0,
            "message": "success",
            "data": result
        }

    except Exception as e:
        logging.error(f"Failed to get message sources: {str(e)}")
        return {
            "code": 500,
            "message": str(e),
            "data": None
        }


@router.post("/generate_title", response_model=ConversationResponse)
async def generate_conversation_title(request: GenerateTitleRequest, authorization: Optional[str] = Header(None)):
    """
    Generate conversation title

    Args:
        request: GenerateTitleRequest object containing:
            - conversation_id: Conversation ID
            - history: Conversation history list, each record contains role and content fields
        authorization: Authorization header

    Returns:
        ConversationResponse object:
            - code: 0 indicates success
            - data: Generated title
            - message: "success" success message
    """
    try:
        # Extract user messages
        content = extract_user_messages(request.history)

        # Call LLM to generate title
        title = call_llm_for_title(content)

        # Update conversation title
        update_conversation_title(request.conversation_id, title)

        return ConversationResponse(
            code=0,
            message="success",
            data=title
        )

    except Exception as e:
        logging.error(f"Failed to generate conversation title: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message/update_opinion", response_model=ConversationResponse)
async def update_opinion(request: OpinionRequest, authorization: Optional[str] = Header(None)):
    """
    Update message like/dislike status
    Args:
        request: OpinionRequest object containing message_id and opinion ('Y' or 'N' or None)
        authorization: Authorization header
    Returns:
        ConversationResponse object
    """
    try:
        success = update_message_opinion(request.message_id, request.opinion)
        if not success:
            raise HTTPException(status_code=404, detail="Message does not exist or has been deleted")
        return ConversationResponse(code=0, message="success", data=True)
    except Exception as e:
        logging.error(f"Failed to update message like/dislike: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
