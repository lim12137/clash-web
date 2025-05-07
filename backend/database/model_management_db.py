from typing import Optional, Dict, List, Any

from sqlalchemy import func, insert, update, select, and_

from .client import db_client, get_db_session, as_dict
from .db_models import ModelRecord
from .utils import add_creation_tracking, add_update_tracking


# 创建模型记录
def create_model_record(model_data: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    """
    Create a model record

    Args:
        model_data: Dictionary containing model data
        user_id: Reserved parameter for filling created_by and updated_by fields

    Returns:
        bool: Whether the operation was successful
    """
    with get_db_session() as session:
        # Data cleaning
        cleaned_data = db_client.clean_string_values(model_data)

        # Add creation timestamp
        cleaned_data["create_time"] = func.current_timestamp()
        if user_id:
            cleaned_data = add_creation_tracking(cleaned_data, user_id)

        # Build the insert statement
        stmt = insert(ModelRecord).values(cleaned_data)

        # Execute the insert statement
        result = session.execute(stmt)

        return result.rowcount > 0


def update_model_record(model_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    """
    Update a model record

    Args:
        model_id: Model ID
        update_data: Dictionary containing update data
        user_id: Reserved parameter for filling updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    with get_db_session() as session:
        # Data cleaning
        cleaned_data = db_client.clean_string_values(update_data)

        # Add update timestamp
        cleaned_data["update_time"] = func.current_timestamp()
        if user_id:
            cleaned_data = add_update_tracking(cleaned_data, user_id)

        # Build the update statement
        stmt = update(ModelRecord).where(
            ModelRecord.model_id == model_id
        ).values(cleaned_data)

        # Execute the update statement
        result = session.execute(stmt)

        return result.rowcount > 0


def delete_model_record(model_id: int, user_id: Optional[str] = None) -> bool:
    """
    Delete a model record (soft delete) and update the update timestamp

    Args:
        model_id: Model ID
        user_id: Reserved parameter for filling updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    with get_db_session() as session:
        # Prepare update data for soft delete
        update_data = {
            "delete_flag": 'Y',
            "update_time": func.current_timestamp()
        }
        if user_id:
            update_data = add_update_tracking(update_data, user_id)

        # Build the update statement
        stmt = update(ModelRecord).where(
            ModelRecord.model_id == model_id
        ).values(update_data)

        # Execute the update statement
        result = session.execute(stmt)

        # Check if any rows were affected
        return result.rowcount > 0


def get_model_records(filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Get a list of model records

    Args:
        filters: Dictionary of filter conditions, optional parameter

    Returns:
        List[Dict[str, Any]]: List of model records
    """
    with get_db_session() as session:
        # Base query
        stmt = select(ModelRecord).where(ModelRecord.delete_flag == 'N')

        # Add filter conditions
        if filters:
            conditions = []
            for key, value in filters.items():
                if value is None:
                    conditions.append(getattr(ModelRecord, key).is_(None))
                else:
                    conditions.append(getattr(ModelRecord, key) == value)
            stmt = stmt.where(and_(*conditions))

        # Execute the query
        records = session.scalars(stmt).all()

        # Convert SQLAlchemy model instances to dictionaries
        return [as_dict(record) for record in records]


def get_model_by_name(model_name: str, model_repo: str) -> Optional[Dict[str, Any]]:
    """
    Get a model record by model name and repository

    Args:
        model_name: Model name
        model_repo: Model repository

    Returns:
        Optional[Dict[str, Any]]: Model record
    """
    filters = {'model_name': model_name, 'model_repo': model_repo}

    records = get_model_records(filters)
    if not records:
        return None

    model = records[0]
    return model


def get_model_by_display_name(display_name: str) -> Optional[Dict[str, Any]]:
    """
    Get a model record by display name

    Args:
        display_name: Model display name
    """
    filters = {'display_name': display_name}

    records = get_model_records(filters)
    if not records:
        return None

    model = records[0]
    return model
