from typing import Dict, List, Any, Optional
from sqlalchemy import insert, func, select, update, and_

from .client import get_db_session, as_dict
from .db_models import KnowledgeRecord

def create_knowledge_record(knowledge_data: Dict[str, Any], user_id: Optional[str] = None) -> int:
    """
    Create a knowledge base record

    Args:
        knowledge_data: Dictionary containing knowledge base data, must include:
            - index_name: Knowledge base name
            - knowledge_describe: Knowledge base description
            - knowledge_status: Knowledge base status
        user_id: Reserved parameter for created_by and updated_by fields

    Returns:
        int: Newly created knowledge base ID
    """
    with get_db_session() as session:
        # Prepare data dictionary
        data = {
            "index_name": knowledge_data['index_name'],
            "knowledge_describe": knowledge_data.get('knowledge_describe', ""),
            "created_by": user_id,
            "updated_by": user_id
        }

        # Insert into knowledge_record_t
        stmt = insert(KnowledgeRecord).values(**data).returning(KnowledgeRecord.knowledge_id)
        result = session.execute(stmt)
        knowledge_id = result.scalar()
        return knowledge_id


def update_knowledge_record(knowledge_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    """
    Update a knowledge base record

    Args:
        knowledge_id: Knowledge base ID
        update_data: Dictionary containing update data
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    with get_db_session() as session:
        # Add update timestamp and user
        update_data["update_time"] = func.current_timestamp()
        if user_id:
            update_data["updated_by"] = user_id

        # Build the update statement
        stmt = update(KnowledgeRecord).where(
            KnowledgeRecord.knowledge_id == knowledge_id
        ).values(update_data)

        # Execute the update statement
        result = session.execute(stmt)
        return result.rowcount > 0

def delete_knowledge_record(knowledge_id: int, user_id: Optional[str] = None) -> bool:
    """
    Delete a knowledge base record (soft delete)

    Args:
        knowledge_id: Knowledge base ID
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    with get_db_session() as session:
        # Prepare update data for soft delete
        update_data = {
            "knowledge_status": '0',  # Set status to unavailable
            "update_time": func.current_timestamp()
        }
        if user_id:
            update_data["updated_by"] = user_id

        # Build the update statement
        stmt = update(KnowledgeRecord).where(
            KnowledgeRecord.knowledge_id == knowledge_id
        ).values(update_data)

        # Execute the update statement
        result = session.execute(stmt)
        return result.rowcount > 0

def get_knowledge_records(filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Get a list of knowledge base records

    Args:
        filters: Dictionary of filter conditions, optional parameter

    Returns:
        List[Dict[str, Any]]: List of knowledge base records
    """
    with get_db_session() as session:
        # Base query
        stmt = select(KnowledgeRecord).where(KnowledgeRecord.delete_flag != 'Y')

        # Add filter conditions
        if filters:
            conditions = []
            for key, value in filters.items():
                if value is None:
                    conditions.append(getattr(KnowledgeRecord, key).is_(None))
                else:
                    conditions.append(getattr(KnowledgeRecord, key) == value)
            stmt = stmt.where(and_(*conditions))

        # Execute the query
        records = session.scalars(stmt).all()

        # Convert SQLAlchemy model instances to dictionaries
        return [as_dict(record) for record in records]

def get_knowledge_by_name(index_name: str) -> Optional[Dict[str, Any]]:
    """
    Get a knowledge base record by index name

    Args:
        index_name: Knowledge base index name

    Returns:
        Optional[Dict[str, Any]]: Knowledge base record
    """
    filters = {'index_name': index_name}
    records = get_knowledge_records(filters)
    if not records:
        return None
    return records[0]

def get_knowledge_by_id(knowledge_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a knowledge base record by ID

    Args:
        knowledge_id: Knowledge base ID

    Returns:
        Optional[Dict[str, Any]]: Knowledge base record
    """
    with get_db_session() as session:
        stmt = select(KnowledgeRecord).where(
            KnowledgeRecord.knowledge_id == knowledge_id,
            KnowledgeRecord.delete_flag != 'Y'
        )
        record = session.scalars(stmt).first()
        return as_dict(record) if record else None

def update_knowledge_describe(knowledge_id: int, new_description: str, user_id: Optional[str] = None) -> bool:
    """
    Update the description of a knowledge base record

    Args:
        knowledge_id: Knowledge base ID
        new_description: New description text
        user_id: Reserved parameter for updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    update_data = {
        "knowledge_describe": new_description
    }
    return update_knowledge_record(knowledge_id, update_data, user_id)