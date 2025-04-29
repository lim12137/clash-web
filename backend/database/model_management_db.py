from typing import Optional, Dict, List, Any

import psycopg2.extras

from .client import db_client
from .utils import add_creation_tracking, add_update_tracking, add_creation_timestamp, add_update_timestamp


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
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Data cleaning
        cleaned_data = db_client.clean_string_values(model_data)

        if user_id:
            cleaned_data = add_creation_tracking(cleaned_data, user_id)
        fields = []
        values = []
        placeholders = []

        for key, value in cleaned_data.items():
            fields.append(key)
            values.append(value)
            placeholders.append('%s')

        # Add timestamp fields
        placeholders_str = ', '.join(placeholders)
        fields, placeholders_str = add_creation_timestamp(fields, placeholders_str)

        fields_str = ', '.join(fields)

        sql = f"""
            INSERT INTO agent_engine.model_record_t ({fields_str})
            VALUES ({placeholders_str})
        """

        cursor.execute(sql, values)
        conn.commit()
        return True
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        db_client.close_connection(conn)


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
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Data cleaning
        cleaned_data = db_client.clean_string_values(update_data)

        # Build SQL update statement
        if user_id:
            cleaned_data = add_update_tracking(cleaned_data, user_id)
        set_clause = []
        values = []

        for key, value in cleaned_data.items():
            set_clause.append(f"{key} = %s")
            values.append(value)

        # Add update timestamp
        set_clause = add_update_timestamp(set_clause)

        # Add model_id condition
        values.append(model_id)

        set_clause_str = ', '.join(set_clause)

        sql = f"""
            UPDATE agent_engine.model_record_t
            SET {set_clause_str}
            WHERE model_id = %s
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


def delete_model_record(model_id: int, user_id: Optional[str] = None) -> bool:
    """
    Delete a model record (soft delete) and update the update timestamp

    Args:
        model_id: Model ID
        user_id: Reserved parameter for filling updated_by field

    Returns:
        bool: Whether the operation was successful
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor()

        # Prepare update data
        update_data = {"delete_flag": 'Y'}

        if user_id:
            update_data = add_update_tracking(update_data, user_id)
        # Build SQL
        set_clause = [f"{key} = %s" for key in update_data.keys()]
        values = list(update_data.values())

        # Add update timestamp
        set_clause = add_update_timestamp(set_clause)

        # Add ID condition value
        values.append(model_id)

        set_clause_str = ', '.join(set_clause)

        sql = f"""
            UPDATE agent_engine.model_record_t
            SET {set_clause_str}
            WHERE model_id = %s
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


def get_model_records(filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Get a list of model records

    Args:
        filters: Dictionary of filter conditions, optional parameter

    Returns:
        List[Dict[str, Any]]: List of model records
    """
    conn = None
    try:
        conn = db_client.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Base query
        sql = """
            SELECT * FROM agent_engine.model_record_t
            WHERE delete_flag = 'N'
        """

        # Add filter conditions
        values = []
        if filters:
            where_clauses = []
            for key, value in filters.items():
                if value is None:
                    where_clauses.append(f"{key} IS NULL")
                else:
                    where_clauses.append(f"{key} = %s")
                    values.append(value)

            if where_clauses:
                sql += " AND " + " AND ".join(where_clauses)

        cursor.execute(sql, values)
        records = cursor.fetchall()
        result = []

        # Process connect_status for each record
        for record in records:
            record_dict = dict(record)
            # Ensure connect_status has a valid value
            if not record_dict.get("connect_status"):
                record_dict["connect_status"] = ""
            result.append(record_dict)

        return result
    except Exception as e:
        raise e
    finally:
        db_client.close_connection(conn)


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
