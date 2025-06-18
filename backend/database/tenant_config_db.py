from typing import Optional, Dict, List, Any

from .client import db_client, get_db_session
from .db_models import TenantConfig


def get_tenant_config_info(tenant_id: str, user_id: str, select_key: str):
    with get_db_session() as session:
        result = session.query(TenantConfig).filter(TenantConfig.tenant_id == tenant_id,
                                                    TenantConfig.user_id == user_id,
                                                    TenantConfig.config_key == select_key,
                                                    TenantConfig.delete_flag == "N").all()
        record_info = []
        for item in result:
            record_info.append({
                "config_value": item.config_value,
                "tenant_config_id": item.tenant_config_id
            })
        return record_info


def insert_config(insert_data: Dict[str, Any]):
    with get_db_session() as session:
        try:
            session.add(TenantConfig(**insert_data))
            session.commit()
            return True
        except Exception as e: 
            session.rollback()
            return False


def delete_config_by_tenant_config_id(tenant_config_id: int):
    with get_db_session() as session:
        try:
            session.query(TenantConfig).filter(TenantConfig.tenant_config_id == tenant_config_id,
                                               TenantConfig.delete_flag == "N").update({"delete_flag": "Y"})
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            return False

def update_config_by_tenant_config_id(tenant_config_id: int, update_value: str):
    with get_db_session() as session:
        try:
            session.query(TenantConfig).filter(TenantConfig.tenant_config_id == tenant_config_id,
                                               TenantConfig.delete_flag == "N").update({"config_value": update_value})
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            return False