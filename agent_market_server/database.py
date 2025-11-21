"""
Database client and connection management for Agent Market Server
"""
import logging
from contextlib import contextmanager
from datetime import datetime, date
from typing import Optional, Any
from urllib.parse import quote_plus

import yaml
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, class_mapper
from sqlalchemy.sql.schema import MetaData

from models import Base

logger = logging.getLogger("database")


class DatabaseConfig:
    """Database configuration loader"""

    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            db_config = config['database']

        self.host = db_config['host']
        self.port = db_config['port']
        self.user = db_config['user']
        self.password = db_config['password']
        self.database = db_config['database']
        self.schema = db_config.get('schema', 'agent_market')
        self.pool_size = db_config.get('pool_size', 10)
        self.pool_timeout = db_config.get('pool_timeout', 30)

    def get_connection_url(self) -> str:
        """Get SQLAlchemy connection URL"""
        # URL encode password to handle special characters like @, :, /, etc.
        encoded_password = quote_plus(self.password)
        return f"postgresql://{self.user}:{encoded_password}@{self.host}:{self.port}/{self.database}"


class DatabaseClient:
    """PostgreSQL database client singleton"""
    _instance: Optional['DatabaseClient'] = None
    _engine = None
    _session_maker = None

    def __new__(cls, config_path: str = "config.yaml"):
        if cls._instance is None:
            cls._instance = super(DatabaseClient, cls).__new__(cls)
        return cls._instance

    def __init__(self, config_path: str = "config.yaml"):
        if self._engine is None:
            self.config = DatabaseConfig(config_path)
            self._initialize_engine()

    def _initialize_engine(self):
        """Initialize SQLAlchemy engine and session maker"""
        self._engine = create_engine(
            self.config.get_connection_url(),
            pool_size=self.config.pool_size,
            pool_pre_ping=True,
            pool_timeout=self.config.pool_timeout,
            echo=False
        )
        self._session_maker = sessionmaker(bind=self._engine)
        logger.info("Database engine initialized successfully")

    @property
    def engine(self):
        """Get SQLAlchemy engine"""
        return self._engine

    @property
    def session_maker(self):
        """Get session maker"""
        return self._session_maker

    def create_tables(self):
        """Create all tables defined in models"""
        Base.metadata.create_all(self._engine)
        logger.info("Database tables created successfully")


# Global database client instance
db_client = DatabaseClient()


@contextmanager
def get_db_session(db_session=None):
    """
    Provide a transactional scope around a series of operations.
    
    Args:
        db_session: Optional existing session to use
        
    Yields:
        SQLAlchemy session object
    """
    session = db_client.session_maker() if db_session is None else db_session
    try:
        yield session
        if db_session is None:
            session.commit()
    except Exception as e:
        if db_session is None:
            session.rollback()
        logger.error(f"Database operation failed: {str(e)}")
        raise e
    finally:
        if db_session is None:
            session.close()


def as_dict(obj):
    """
    Convert SQLAlchemy model instance to dictionary
    
    Args:
        obj: SQLAlchemy model instance
        
    Returns:
        Dictionary representation of the model with serializable values
    """
    if hasattr(obj, '__table__'):
        result = {}
        mapper = class_mapper(obj.__class__)
        for c in mapper.columns:
            key = c.key
            try:
                value = getattr(obj, key)
                # Skip SQLAlchemy internal objects like MetaData
                if isinstance(value, MetaData):
                    continue
                # Convert datetime objects to ISO format strings
                if isinstance(value, (datetime, date)):
                    result[key] = value.isoformat() if value else None
                else:
                    result[key] = value
            except AttributeError:
                # Skip if attribute doesn't exist
                continue
        return result
    return dict(obj._mapping)


def filter_property(data: dict, model_class):
    """
    Filter dictionary to only include keys that match model columns
    
    Args:
        data: Dictionary to filter
        model_class: SQLAlchemy model class
        
    Returns:
        Filtered dictionary with only valid column keys
    """
    model_fields = model_class.__table__.columns.keys()
    return {key: value for key, value in data.items() if key in model_fields}

