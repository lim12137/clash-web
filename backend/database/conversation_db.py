import json
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, List, Any, Optional, TypedDict

import psycopg2.extras

from .client import db_client
from .utils import add_creation_timestamp, add_update_timestamp


class ConversationRecord(TypedDict):
    conversation_id: int
    conversation_title: str
    create_time: int
    update_time: int


class MessageRecord(TypedDict):
    message_id: int
    message_index: int
    role: str
    type: Optional[str]
    content: Optional[str]
    opinion_flag: Optional[str]


class SearchRecord(TypedDict):
    message_id: int
    source_type: str
    source_title: str
    source_location: str
    source_content: str
    score_overall: Optional[float]
    score_accuracy: Optional[float]
    score_semantic: Optional[float]
    published_date: Optional[datetime]
    cite_index: Optional[int]
    search_type: Optional[str]
    tool_sign: Optional[str]


class ImageRecord(TypedDict):
    message_id: int
    image_url: str


class ConversationHistory(TypedDict):
    conversation_id: int
    create_time: int
    message_records: List[MessageRecord]
    search_records: List[SearchRecord]
    image_records: List[ImageRecord]


def create_conversation(conversation_title: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new conversation record

    Args:
        conversation_title: Conversation title
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        Dict[str, Any]: Dictionary containing complete information of the newly created conversation
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Prepare data dictionary
        data = {"conversation_title": conversation_title, "delete_flag": 'N'}

        # Build SQL
        fields = list(data.keys())
        values = list(data.values())

        # Add timestamp fields
        placeholders = ', '.join(['%s'] * len(values))
        fields, placeholders = add_creation_timestamp(fields, placeholders)
        fields_str = ', '.join(fields)

        sql = f"""
            INSERT INTO agent_engine.conversation_record_t 
            ({fields_str})
            VALUES ({placeholders})
            RETURNING conversation_id, conversation_title, 
                EXTRACT(EPOCH FROM create_time) * 1000 as create_time,
                EXTRACT(EPOCH FROM update_time) * 1000 as update_time
        """

        cursor.execute(sql, values)
        record = cursor.fetchone()
        conn.commit()

        # Convert to dictionary and ensure timestamps are integers
        result = dict(record)
        result['create_time'] = int(result['create_time'])
        result['update_time'] = int(result['update_time'])
        return result
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def create_conversation_message(message_data: Dict[str, Any], user_id: Optional[str] = None) -> int:
    """
    Create a conversation message record

    Args:
        message_data: Dictionary containing message data, must include the following fields:
            - conversation_id: Conversation ID (integer)
            - message_idx: Message index (integer)
            - role: Message role
            - content: Message content
            - minio_files: JSON string of attachment information
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        int: Newly created message ID (auto-increment ID)
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure conversation_id is integer type
        conversation_id = int(message_data['conversation_id'])
        message_idx = int(message_data['message_idx'])

        minio_files = message_data.get('minio_files')
        # Convert minio_files to JSON string for storage
        if minio_files is not None:
            # If minio_files is already a string, use it directly; otherwise convert to JSON string
            if not isinstance(minio_files, str):
                minio_files = json.dumps(minio_files)

        # Prepare data dictionary
        data = {"conversation_id": conversation_id, "message_index": message_idx, "message_role": message_data['role'],
                "message_content": message_data['content'], "minio_files": minio_files, "opinion_flag": None,
                "delete_flag": 'N'}

        # Build SQL
        fields = list(data.keys())
        values = list(data.values())

        # Add timestamp fields
        placeholders = ', '.join(['%s'] * len(values))
        fields, placeholders = add_creation_timestamp(fields, placeholders)

        fields_str = ', '.join(fields)

        sql = f"""
            INSERT INTO agent_engine.conversation_message_t 
            ({fields_str})
            VALUES ({placeholders})
            RETURNING message_id
        """

        cursor.execute(sql, values)
        message_id = cursor.fetchone()[0]  # Get returned ID (integer type)
        conn.commit()
        return message_id
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def create_message_units(message_units: List[Dict[str, Any]], message_id: int, conversation_id: int,
                         user_id: Optional[str] = None) -> bool:
    """
    Batch create message unit records

    Args:
        message_units: List of message units, each containing:
            - type: Unit type
            - content: Unit content
        message_id: Message ID (integer)
        conversation_id: Conversation ID (integer)
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        bool: Whether the operation was successful
    """
    if not message_units:
        return True  # No message units, considered successful

    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure IDs are integer type
        message_id = int(message_id)
        conversation_id = int(conversation_id)

        # Batch insert all message units
        values = []
        base_fields = ["message_id", "conversation_id", "unit_index", "unit_type", "unit_content", "delete_flag"]

        # Create placeholder list
        placeholders_list = ['%s'] * len(base_fields)
        placeholders = ', '.join(placeholders_list)

        # Add timestamp fields
        base_fields, placeholders = add_creation_timestamp(base_fields, placeholders)

        for idx, unit in enumerate(message_units):
            # Basic data
            row_values = [message_id, conversation_id, idx, unit['type'], unit['content'], 'N']

            values.append(tuple(row_values))

        # Build SQL
        fields_str = ', '.join(base_fields)

        sql = f"""
            INSERT INTO agent_engine.conversation_message_unit_t 
            ({fields_str})
            VALUES ({placeholders})
        """

        psycopg2.extras.execute_batch(cursor, sql, values)
        conn.commit()
        return True
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def get_conversation(conversation_id: int, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get conversation details

    Args:
        conversation_id: Conversation ID (integer)
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        Optional[Dict[str, Any]]: Conversation details, or None if it doesn't exist
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure conversation_id is integer type
        conversation_id = int(conversation_id)

        sql = """
            SELECT * FROM agent_engine.conversation_record_t
            WHERE conversation_id = %s AND delete_flag = 'N'
        """

        # If user_id is provided, add filter condition
        values = [conversation_id]

        cursor.execute(sql, values)
        record = cursor.fetchone()

        if record:
            return dict(record)
        return None
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def get_conversation_messages(conversation_id: int) -> List[Dict[str, Any]]:
    """
    Get all messages in a conversation

    Args:
        conversation_id: Conversation ID (integer)

    Returns:
        List[Dict[str, Any]]: List of messages, sorted by message_index
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure conversation_id is integer type
        conversation_id = int(conversation_id)

        sql = """
            SELECT * FROM agent_engine.conversation_message_t
            WHERE conversation_id = %s AND delete_flag = 'N'
            ORDER BY message_index
        """

        cursor.execute(sql, (conversation_id,))
        records = cursor.fetchall()
        return [dict(record) for record in records]
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def get_message_units(message_id: int) -> List[Dict[str, Any]]:
    """
    Get all units of a message

    Args:
        message_id: Message ID (integer)

    Returns:
        List[Dict[str, Any]]: List of message units, sorted by unit_index
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure message_id is integer type
        message_id = int(message_id)

        sql = """
            SELECT * FROM agent_engine.conversation_message_unit_t
            WHERE message_id = %s AND delete_flag = 'N'
            ORDER BY unit_index
        """

        cursor.execute(sql, (message_id,))
        records = cursor.fetchall()
        return [dict(record) for record in records]
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def get_conversation_list(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get list of all undeleted conversations, sorted by creation time in descending order

    Args:
        user_id: Reserved parameter for filtering conversations created by this user

    Returns:
        List[Dict[str, Any]]: List of conversations, each containing id, title and timestamp information
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Base query
        sql = """
            SELECT 
                conversation_id,
                conversation_title,
                EXTRACT(EPOCH FROM create_time) * 1000 as create_time,
                EXTRACT(EPOCH FROM update_time) * 1000 as update_time
            FROM agent_engine.conversation_record_t
            WHERE delete_flag = 'N'
        """

        values = []

        # Add sorting
        sql += " ORDER BY create_time DESC"

        cursor.execute(sql, values)
        records = cursor.fetchall()

        # Convert to dictionary list and ensure timestamps are integers
        result = []
        for record in records:
            conversation = dict(record)
            conversation['create_time'] = int(conversation['create_time'])
            conversation['update_time'] = int(conversation['update_time'])
            result.append(conversation)

        return result
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def rename_conversation(conversation_id: int, new_title: str, user_id: Optional[str] = None) -> bool:
    """
    Rename a conversation

    Args:
        conversation_id: Conversation ID (integer)
        new_title: New conversation title
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure conversation_id is integer type
        conversation_id = int(conversation_id)

        # Prepare update data
        update_data = {"conversation_title": new_title}

        # Build SQL
        set_clause = [f"{key} = %s" for key in update_data.keys()]
        values = list(update_data.values())

        # Add update time
        set_clause = add_update_timestamp(set_clause)

        # Add ID condition value
        values.append(conversation_id)

        set_clause_str = ', '.join(set_clause)

        sql = f"""
            UPDATE agent_engine.conversation_record_t
            SET {set_clause_str}
            WHERE conversation_id = %s AND delete_flag = 'N'
        """

        cursor.execute(sql, values)
        affected_rows = cursor.rowcount
        conn.commit()
        return affected_rows > 0
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def delete_conversation(conversation_id: int, user_id: Optional[str] = None) -> bool:
    """
    Delete a conversation (soft delete)

    Args:
        conversation_id: Conversation ID (integer)
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure conversation_id is integer type
        conversation_id = int(conversation_id)

        # Wrap in transaction
        conn.autocommit = False

        try:
            # Prepare update data
            update_data = {"delete_flag": 'Y'}

            # 1. Mark conversation as deleted
            set_clause = [f"{key} = %s" for key in update_data.keys()]
            values = list(update_data.values())

            # Add update time
            set_clause = add_update_timestamp(set_clause)

            # Add ID condition value
            values.append(conversation_id)

            set_clause_str = ', '.join(set_clause)

            sql = f"""
                UPDATE agent_engine.conversation_record_t
                SET {set_clause_str}
                WHERE conversation_id = %s AND delete_flag = 'N'
            """

            cursor.execute(sql, values)
            conversation_affected = cursor.rowcount

            # 2. Mark related messages as deleted
            values = list(update_data.values())
            values.append(conversation_id)

            sql = f"""
                UPDATE agent_engine.conversation_message_t
                SET {set_clause_str}
                WHERE conversation_id = %s AND delete_flag = 'N'
            """

            cursor.execute(sql, values)

            # 3. Mark message units as deleted
            values = list(update_data.values())
            values.append(conversation_id)

            sql = f"""
                UPDATE agent_engine.conversation_message_unit_t
                SET {set_clause_str}
                WHERE conversation_id = %s AND delete_flag = 'N'
            """
            cursor.execute(sql, values)

            # 4. Mark search sources as deleted
            values = list(update_data.values())
            values.append(conversation_id)

            sql = f"""
                UPDATE agent_engine.conversation_source_search_t
                SET {set_clause_str}
                WHERE conversation_id = %s AND delete_flag = 'N'
            """
            cursor.execute(sql, values)

            # 5. Mark image sources as deleted
            values = list(update_data.values())
            values.append(conversation_id)

            sql = f"""
                UPDATE agent_engine.conversation_source_image_t
                SET {set_clause_str}
                WHERE conversation_id = %s AND delete_flag = 'N'
            """
            cursor.execute(sql, values)

            conn.commit()
            return conversation_affected > 0
        except Exception as e:
            conn.rollback()
            raise e
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.autocommit = True  # Restore autocommit
            db_client.close_connection(conn)


def update_message_opinion(message_id: int, opinion: str, user_id: Optional[str] = None) -> bool:
    """
    Update message like/dislike status

    Args:
        message_id: Message ID (integer)
        opinion: Opinion flag, 'Y' for like, 'N' for dislike, None for no opinion
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure message_id is integer type
        message_id = int(message_id)

        # Prepare update data
        update_data = {"opinion_flag": opinion}

        # Build SQL
        set_clause = [f"{key} = %s" for key in update_data.keys()]
        values = list(update_data.values())

        # Add update time
        set_clause = add_update_timestamp(set_clause)

        # Add ID condition value
        values.append(message_id)

        set_clause_str = ', '.join(set_clause)

        sql = f"""
            UPDATE agent_engine.conversation_message_t
            SET {set_clause_str}
            WHERE message_id = %s AND delete_flag = 'N'
        """

        cursor.execute(sql, values)
        affected_rows = cursor.rowcount
        conn.commit()
        return affected_rows > 0
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


@contextmanager
def get_db_connection():
    """
    Database connection context manager

    Usage example:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql)
    """
    conn = None
    try:
        conn = db_client.get_connection()
        yield conn
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def get_conversation_history(conversation_id: int, user_id: Optional[str] = None) -> Optional[ConversationHistory]:
    """
    Get complete conversation history, including all messages and message units' raw data

    Args:
        conversation_id: Conversation ID (integer)
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        Optional[ConversationHistory]: Contains basic conversation information and raw data of all messages and message units
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            # First check if conversation exists
            check_sql = """
                SELECT conversation_id, EXTRACT(EPOCH FROM create_time) * 1000 as create_time
                FROM agent_engine.conversation_record_t
                WHERE conversation_id = %s AND delete_flag = 'N'
            """

            values = [conversation_id]

            cursor.execute(check_sql, values)
            conversation = cursor.fetchone()

            if not conversation:
                return None

            # Get message data (including message content)
            message_sql = """
                SELECT 
                    m.message_id,
                    m.message_index,
                    m.message_role as role,
                    m.message_content,
                    m.minio_files,
                    m.opinion_flag,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'type', u.unit_type,
                                'content', u.unit_content
                            ) ORDER BY u.unit_index
                        )
                        FROM agent_engine.conversation_message_unit_t u
                        WHERE u.message_id = m.message_id 
                            AND u.delete_flag = 'N'
                            AND u.unit_type IS NOT NULL
                    ) as units
                FROM agent_engine.conversation_message_t m
                WHERE m.conversation_id = %s AND m.delete_flag = 'N'
                ORDER BY m.message_index
            """
            cursor.execute(message_sql, (conversation_id,))
            message_records = cursor.fetchall()

            # Get search data
            search_sql = """
                SELECT 
                    message_id,
                    source_type,
                    source_title,
                    source_location,
                    source_content,
                    score_overall,
                    score_accuracy,
                    score_semantic,
                    published_date,
                    cite_index,
                    search_type,
                    tool_sign
                FROM agent_engine.conversation_source_search_t
                WHERE conversation_id = %s AND delete_flag = 'N'
            """
            cursor.execute(search_sql, (conversation_id,))
            search_records = cursor.fetchall()

            # Get image data
            image_sql = """
                SELECT 
                    message_id,
                    image_url
                FROM agent_engine.conversation_source_image_t
                WHERE conversation_id = %s AND delete_flag = 'N'
            """
            cursor.execute(image_sql, (conversation_id,))
            image_records = cursor.fetchall()

            # Integrate message and unit data
            message_list = []
            for record in message_records:
                message_data = dict(record)

                # Ensure units field is empty list instead of None
                if message_data['units'] is None:
                    message_data['units'] = []

                # Process minio_files field - if it's a JSON string, parse it into Python object
                if message_data.get('minio_files'):
                    try:
                        if isinstance(message_data['minio_files'], str):
                            message_data['minio_files'] = json.loads(message_data['minio_files'])
                    except (json.JSONDecodeError, TypeError):
                        # If parsing fails, keep original value
                        pass

                message_list.append(message_data)

            # Process result and ensure create_time is integer
            conversation_dict = dict(conversation)

            return {'conversation_id': conversation_dict['conversation_id'],
                    'create_time': int(conversation_dict['create_time']), 'message_records': message_list,
                    'search_records': [dict(record) for record in search_records] if search_records else [],
                    'image_records': [dict(record) for record in image_records] if image_records else []}

    except Exception as e:
        raise e


def create_source_image(image_data: Dict[str, Any], user_id: Optional[str] = None) -> int:
    """
    Create image source reference

    Args:
        image_data: Dictionary containing image data, must include the following fields:
            - message_id: Message ID (integer)
            - image_url: Image URL
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        int: Newly created image ID (auto-increment ID)
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure message_id is integer type
        message_id = int(image_data['message_id'])

        # Prepare data dictionary
        data = {"message_id": message_id, "conversation_id": image_data.get('conversation_id'),
                "image_url": image_data['image_url'], "delete_flag": 'N'}

        # Build SQL
        fields = list(data.keys())
        values = list(data.values())

        # Add timestamp fields
        placeholders = ', '.join(['%s'] * len(values))
        fields, placeholders = add_creation_timestamp(fields, placeholders)

        fields_str = ', '.join(fields)

        sql = f"""
            INSERT INTO agent_engine.conversation_source_image_t 
            ({fields_str})
            VALUES ({placeholders})
            RETURNING image_id
        """

        cursor.execute(sql, values)
        image_id = cursor.fetchone()[0]  # Get returned ID (integer type)
        conn.commit()
        return image_id
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def delete_source_image(image_id: int, user_id: Optional[str] = None) -> bool:
    """
    Delete image source reference (soft delete)

    Args:
        image_id: Image ID (integer)
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure image_id is integer type
        image_id = int(image_id)

        # Prepare update data
        update_data = {"delete_flag": 'Y'}

        # Build SQL
        set_clause = [f"{key} = %s" for key in update_data.keys()]
        values = list(update_data.values())

        # Add update time
        set_clause = add_update_timestamp(set_clause)

        # Add ID condition value
        values.append(image_id)

        set_clause_str = ', '.join(set_clause)

        sql = f"""
            UPDATE agent_engine.conversation_source_image_t
            SET {set_clause_str}
            WHERE image_id = %s AND delete_flag = 'N'
        """

        cursor.execute(sql, values)
        affected_rows = cursor.rowcount
        conn.commit()
        return affected_rows > 0
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def get_source_images_by_message(message_id: int, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all associated image source information by message ID

    Args:
        message_id: Message ID
        user_id: Reserved parameter for filtering images created by this user

    Returns:
        List[Dict[str, Any]]: List of image source information
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure message_id is integer type
        message_id = int(message_id)

        # Base query
        sql = """
            SELECT i.* FROM agent_engine.conversation_source_image_t i
            JOIN agent_engine.conversation_message_t m ON i.message_id = m.message_id
            JOIN agent_engine.conversation_record_t c ON m.conversation_id = c.conversation_id
            WHERE i.message_id = %s AND i.delete_flag = 'N'
        """

        values = [message_id]

        # Add sorting
        sql += " ORDER BY i.image_id"

        cursor.execute(sql, values)
        records = cursor.fetchall()
        return [dict(record) for record in records]
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def get_source_images_by_conversation(conversation_id: int, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all associated image source information by conversation ID

    Args:
        conversation_id: Conversation ID
        user_id: Current user ID, for filtering images created by this user

    Returns:
        List[Dict[str, Any]]: List of image source information
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure conversation_id is integer type
        conversation_id = int(conversation_id)

        # Base query
        sql = """
            SELECT i.* FROM agent_engine.conversation_source_image_t i
            JOIN agent_engine.conversation_record_t c ON i.conversation_id = c.conversation_id
            WHERE i.conversation_id = %s AND i.delete_flag = 'N'
        """

        values = [conversation_id]

        # Add sorting
        sql += " ORDER BY i.image_id"

        cursor.execute(sql, values)
        records = cursor.fetchall()
        return [dict(record) for record in records]
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def create_source_search(search_data: Dict[str, Any], user_id: Optional[str] = None) -> int:
    """
    Create search source reference

    Args:
        search_data: Dictionary containing search data, must include the following fields:
            - message_id: Message ID (integer)
            - source_type: Source type
            - source_title: Source title
            - source_location: Source location/URL
            - source_content: Source content
            - cite_index: Index number
            - search_type: Source tool
            - tool_sign: Source tool simple identifier, used for summary differentiation
            Optional fields:
            - score_overall: Overall relevance score
            - score_accuracy: Accuracy score
            - score_semantic: Semantic relevance score
            - published_date: Publication date
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        int: Newly created search ID (auto-increment ID)
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure message_id is integer type
        message_id = int(search_data['message_id'])

        # Prepare basic data dictionary
        data = {"message_id": message_id, "conversation_id": search_data.get('conversation_id'),
                "source_type": search_data['source_type'], "source_title": search_data['source_title'],
                "source_location": search_data['source_location'], "source_content": search_data['source_content'],
                "cite_index": search_data['cite_index'], "search_type": search_data['search_type'],
                "tool_sign": search_data['tool_sign'], "delete_flag": 'N'}

        # Add optional fields
        if 'score_overall' in search_data:
            data["score_overall"] = search_data['score_overall']

        if 'score_accuracy' in search_data:
            data["score_accuracy"] = search_data['score_accuracy']

        if 'score_semantic' in search_data:
            data["score_semantic"] = search_data['score_semantic']

        if 'published_date' in search_data:
            data["published_date"] = search_data['published_date']

        # Build SQL
        fields = list(data.keys())
        values = list(data.values())

        # Add timestamp fields
        placeholders = ', '.join(['%s'] * len(values))
        fields, placeholders = add_creation_timestamp(fields, placeholders)

        fields_str = ', '.join(fields)

        sql = f"""
            INSERT INTO agent_engine.conversation_source_search_t 
            ({fields_str})
            VALUES ({placeholders})
            RETURNING search_id
        """

        cursor.execute(sql, values)
        search_id = cursor.fetchone()[0]  # Get returned ID (integer type)
        conn.commit()
        return search_id
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def delete_source_search(search_id: int, user_id: Optional[str] = None) -> bool:
    """
    Delete search source reference (soft delete)

    Args:
        search_id: Search ID (integer)
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Ensure search_id is integer type
        search_id = int(search_id)

        # Prepare update data
        update_data = {"delete_flag": 'Y'}

        # Build SQL
        set_clause = [f"{key} = %s" for key in update_data.keys()]
        values = list(update_data.values())

        # Add update time
        set_clause = add_update_timestamp(set_clause)

        # Add ID condition value
        values.append(search_id)

        set_clause_str = ', '.join(set_clause)

        sql = f"""
            UPDATE agent_engine.conversation_source_search_t
            SET {set_clause_str}
            WHERE search_id = %s AND delete_flag = 'N'
        """

        cursor.execute(sql, values)
        affected_rows = cursor.rowcount
        conn.commit()
        return affected_rows > 0
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


def get_source_searches_by_message(message_id: int, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all associated search source information by message ID

    Args:
        message_id: Message ID
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        List[Dict[str, Any]]: List of search source information
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure message_id is integer type
        message_id = int(message_id)

        # Base query
        sql = """
            SELECT s.* FROM agent_engine.conversation_source_search_t s
            JOIN agent_engine.conversation_message_t m ON s.message_id = m.message_id
            JOIN agent_engine.conversation_record_t c ON m.conversation_id = c.conversation_id
            WHERE s.message_id = %s AND s.delete_flag = 'N'
        """

        values = [message_id]

        # Add sorting
        sql += " ORDER BY s.search_id"

        cursor.execute(sql, values)
        records = cursor.fetchall()
        return [dict(record) for record in records]
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def get_source_searches_by_conversation(conversation_id: int, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all associated search source information by conversation ID

    Args:
        conversation_id: Conversation ID
        user_id: Reserved parameter for filtering search content created by this user

    Returns:
        List[Dict[str, Any]]: List of search source information
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure conversation_id is integer type
        conversation_id = int(conversation_id)

        # Base query
        sql = """
            SELECT s.* FROM agent_engine.conversation_source_search_t s
            JOIN agent_engine.conversation_record_t c ON s.conversation_id = c.conversation_id
            WHERE s.conversation_id = %s AND s.delete_flag = 'N'
        """

        values = [conversation_id]

        # Add sorting
        sql += " ORDER BY s.search_id"

        cursor.execute(sql, values)
        records = cursor.fetchall()
        return [dict(record) for record in records]
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


def get_message(message_id: int, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get message details by message ID

    Args:
        message_id: Message ID
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        Dict[str, Any]: Message details
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Ensure message_id is integer type
        message_id = int(message_id)

        sql = """
            SELECT m.* FROM agent_engine.conversation_message_t m
            JOIN agent_engine.conversation_record_t c ON m.conversation_id = c.conversation_id
            WHERE m.message_id = %s AND m.delete_flag = 'N'
        """

        values = [message_id]

        cursor.execute(sql, values)
        record = cursor.fetchone()

        if record is None:
            return None
        return dict(record)
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)
