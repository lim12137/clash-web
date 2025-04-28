import logging

def configure_elasticsearch_logging():
    """Configure logging for Elasticsearch client to reduce verbosity"""
    # Configure logging for elasticsearch
    logging.getLogger('elastic_transport').setLevel(logging.WARNING)
    
    # Configure logging for urllib3 (used by elasticsearch)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    
    # Configure logging for elasticsearch.trace
    # This logger logs the body of requests and responses which can be very verbose
    logging.getLogger('elasticsearch.trace').setLevel(logging.WARNING)
    
    # Configure logging for FastAPI/uvicorn access logs
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('fastapi').setLevel(logging.WARNING) 