from typing import Optional

from fastapi import HTTPException, Query, Body, Path, Depends, APIRouter, Header
from consts.model import ChangeSummaryRequest

from nexent.vector_database.elasticsearch_core import ElasticSearchCore
from services.elasticsearch_service import ElasticSearchService, get_es_core
from database.utils import get_current_user_id
router = APIRouter(prefix="/indices")

@router.post("/{index_name}/auto_summary")
def summary(
            index_name: str = Path(..., description="Name of the index to get documents from"),
            batch_size: int = Query(1000, description="Number of documents to retrieve per batch"),
            es_core: ElasticSearchCore = Depends(get_es_core),
            authorization: Optional[str] = Header(None)
    ):
    """Summary Elasticsearch index_name by model"""
    try:
        user_id = get_current_user_id(authorization)
        # Try to list indices as a health check
        return ElasticSearchService().summary_index_name(index_name=index_name,batch_size=batch_size, es_core=es_core,user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{str(e)}")


@router.post("/{index_name}/summary")
def change_summary(
            index_name: str = Path(..., description="Name of the index to get documents from"),
            change_summary_request: ChangeSummaryRequest = Body(None, description="knowledge base summary"),
            es_core: ElasticSearchCore = Depends(get_es_core),
            authorization: Optional[str] = Header(None)
    ):
    """Summary Elasticsearch index_name by user"""
    try:
        user_id = get_current_user_id(authorization)
        summary_result = change_summary_request.summary_result
        # Try to list indices as a health check
        return ElasticSearchService().change_summary(index_name=index_name,summary_result=summary_result, es_core=es_core,user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{str(e)}")


@router.get("/{index_name}/summary")
def get_summary(
            index_name: str = Path(..., description="Name of the index to get documents from"),
    ):
    """Get Elasticsearch index_name Summary"""
    try:
        # Try to list indices as a health check
        return ElasticSearchService().get_summary(index_name=index_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{str(e)}")