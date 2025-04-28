import json
import logging
from typing import List, Optional

from fastapi import HTTPException, Header

from consts.model import MessageRequest, ConversationResponse, AgentRequest, MessageUnit
from database.conversation_db import create_conversation_message, create_source_search, create_message_units, \
    create_source_image


logger = logging.getLogger("conversation_management_service")


def save_message(request: MessageRequest, authorization: Optional[str] = Header(None)):
    """
    Save a new message record

    Args:
        request: MessageRequest object containing:
            - conversation_id: Required, conversation ID
            - message_idx: Message index (integer type)
            - role: Message role
            - message: List of message units
            - minio_files: List of object_names for files stored in minio
        authorization: Authorization header

    Returns:
        ConversationResponse object:
            - code: 0 indicates success
            - data: true indicates successful save
            - message: "success" success message
    """
    try:
        message_data = request.model_dump()

        # Validate conversation_id
        conversation_id = message_data.get('conversation_id')
        if not conversation_id:
            raise HTTPException(status_code=400, detail="conversation_id is required, please call /conversation/create to create a conversation first")

        # Process different types of message units
        message_units = message_data['message']

        # Filter specific message units
        string_content = None
        other_units = []

        # First pass: Separate string/final_answer and other types
        for unit in message_units:
            unit_type = unit['type']
            unit_content = unit['content']

            if unit_type in ['string', 'final_answer']:
                string_content = unit_content
            else:
                other_units.append(unit)

        # Initialize message record data
        message_id = None
        minio_files = message_data.get('minio_files')

        # Process string/final_answer type, create message record
        if string_content is not None:
            message_data_copy = {'conversation_id': conversation_id, 'message_idx': message_data['message_idx'],
                'role': message_data['role'], 'content': string_content, 'minio_files': minio_files}
            message_id = create_conversation_message(message_data_copy)

        # If there are other types of units but no string type, create an empty content message for them
        if other_units and message_id is None:
            message_data_copy = {'conversation_id': conversation_id, 'message_idx': message_data['message_idx'],
                'role': message_data['role'], 'content': "",  # Empty content
                'minio_files': minio_files}
            message_id = create_conversation_message(message_data_copy)

        # Process other types of units
        filtered_message_units = []
        for unit in other_units:
            unit_type = unit['type']
            unit_content = unit['content']

            if unit_type == 'search_content':
                # Process search content, save as source_search, do not add to filtered_message_units
                try:
                    # Parse search content
                    import json
                    search_results = json.loads(unit_content)

                    # Ensure search_results is a list
                    if not isinstance(search_results, list):
                        search_results = [search_results]

                    # Iterate through each search result and save separately
                    for result in search_results:
                        search_data = {'message_id': message_id, 'conversation_id': conversation_id,
                            'source_type': result.get('source_type', ''), 'source_title': result.get('title', ''),
                            'source_location': result.get('url', ''), 'source_content': result.get('text', ''),
                            'score_overall': float(result.get('score')) if result.get('score') and result.get(
                                'score') != '' else None,
                            'score_accuracy': float(result.get('score_details', {}).get('accuracy')) if result.get(
                                'score_details', {}).get('accuracy') and result.get('score_details', {}).get(
                                'accuracy') != '' else None,
                            'score_semantic': float(result.get('score_details', {}).get('semantic')) if result.get(
                                'score_details', {}).get('semantic') and result.get('score_details', {}).get(
                                'semantic') != '' else None,
                            'published_date': result.get('published_date') if result.get(
                                'published_date') and result.get('published_date') != '' else None,
                            'cite_index': result.get('cite_index', None) if result.get('cite_index') != '' else None,
                            'search_type': result.get('search_type') if result.get('search_type') and result.get(
                                'search_type') != '' else None, 'tool_sign': result.get('tool_sign', '')}
                        create_source_search(search_data)
                except Exception as e:
                    logging.error(f"Failed to save search content: {str(e)}")  # Do not add to filtered_message_units if save fails

            elif unit_type == 'picture_web':
                # Process image content, save as source_image, do not add to filtered_message_units
                try:
                    # Parse image URL list
                    import json
                    content_json = json.loads(unit_content)
                    if isinstance(content_json, dict) and 'images_url' in content_json:
                        for image_url in content_json['images_url']:
                            image_data = {'message_id': message_id, 'conversation_id': conversation_id,
                                'image_url': image_url}
                            create_source_image(image_data)
                except Exception as e:
                    logging.error(f"Failed to save image content: {str(e)}")  # Do not add to filtered_message_units if save fails

            else:
                # Keep other types of message units
                filtered_message_units.append(unit)

        # Create filtered message unit records
        if filtered_message_units and message_id is not None:
            create_message_units(filtered_message_units, message_id, conversation_id)

        return ConversationResponse(code=0, message="success", data=True)

    except Exception as e:
        logging.error(f"Failed to save message: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


def save_conversation_user(request: AgentRequest, authorization: Optional[str] = None):
    user_role_count = count_user(request)

    conversation_req = MessageRequest(conversation_id=request.conversation_id, message_idx=user_role_count * 2,
        role="user", message=[MessageUnit(type="string", content=request.query)], minio_files=request.minio_files)
    save_message(conversation_req, authorization=authorization)


def count_user(request):
    # Use generator expression and sum function to count the number of roles that are user
    return sum(1 for item in getattr(request, "history", []) if item.get("role") == "user")


def save_conversation_assistant(request: AgentRequest, messages: List[str], authorization: Optional[str] = None):
    user_role_count = count_user(request)

    message_list = []
    for item in messages:
        message = json.loads(item)
        if len(message_list) and message.get("type") == message_list[-1].get("type"):
            message_list[-1]["content"] += message["content"]
        else:
            message_list.append(message)

    conversation_req = MessageRequest(conversation_id=request.conversation_id, message_idx=user_role_count * 2 + 1,
        role="assistant", message=message_list, minio_files=request.minio_files)
    save_message(conversation_req, authorization=authorization)
