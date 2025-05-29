import time
import json
import logging
from typing import Tuple
from urllib.request import urlopen
from elasticsearch import Elasticsearch
from nexent.vector_database.elasticsearch_core import ElasticSearchCore
from nexent.core.models.embedding_model import JinaEmbedding

def create_test_knowledge_base(
    es_client: ElasticSearchCore,
    embedding_dim: int = None,
) -> Tuple[str, int]:
    """
    Create a test knowledge base with sample articles for testing.
    
    Args:
        es_client: ElasticSearchCore instance
        embedding_dim: Dimension of the embedding vectors (optional, will use model's dim if not provided)
        
    Returns:
        Tuple containing the index name and number of documents indexed
    """
    index_name = "sample_articles"
    logging.info(f"Checking if test knowledge base '{index_name}' exists...")
    
    # Check if index already exists
    if es_client.client.indices.exists(index=index_name):
        logging.info(f"Index {index_name} already exists, skipping creation")
        # Get current document count
        try:
            stats = es_client.client.indices.stats(index=index_name)
            doc_count = stats["indices"][index_name]["primaries"]["docs"]["count"]
            return index_name, doc_count
        except Exception as e:
            logging.error(f"Error getting index statistics: {str(e)}")
            return index_name, 0
    
    # If index doesn't exist, continue with creation process
    logging.info("Creating new test knowledge base...")
    
    # Fetch sample articles data
    logging.info("Fetching sample articles data...")
    url = "https://raw.githubusercontent.com/elastic/elasticsearch-labs/main/notebooks/search/articles.json"
    try:
        # Create a new vector index
        success = es_client.create_vector_index(index_name, embedding_dim)
        if not success:
            logging.error(f"Failed to create {index_name}")
            return index_name, 0
        
        response = urlopen(url)
        articles = json.loads(response.read())
        
        # Get current time for create_time
        current_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
        
        # Prepare documents for indexing
        logging.info("Preparing documents for indexing...")
        for article in articles:
            # Add required fields if not present
            if "id" not in article:
                article["id"] = str(hash(article.get("passage", "") or article.get("content", "")))[:8]
            
            # Rename 'passage' to 'content' if present
            if "passage" in article:
                article["content"] = article.pop("passage")
                
            article["path_or_url"] = url  # Add source URL
            article["filename"] = url.split("/")[-1]  # Add filename
            article["process_source"] = "Unstructured"  # Add metadata
            article["embedding_model_name"] = es_client.embedding_model.embedding_model_name  # Add model name
            article["file_size"] = len(json.dumps(article))  # Approximate file size
            article["create_time"] = current_time  # Add creation time
            
            # Ensure title is present
            if "title" not in article:
                article["title"] = f"Article {article['id']}"
        
        # Index documents (limit to sample_size)
        logging.info(f"Indexing {len(articles)} documents...")
        num_indexed = es_client.index_documents(index_name, articles)
        
        logging.info(f"Test knowledge base created with {num_indexed} documents")
        return index_name, num_indexed
        
    except Exception as e:
        logging.error(f"Error creating test knowledge base: {str(e)}")
        return index_name, 0

def test_create_test_knowledge_base():
    """Test the creation of test knowledge base"""
    # Initialize ElasticSearchCore with test configuration
    es_client = ElasticSearchCore(
        host="http://localhost:9200",  # Replace with your test ES host
        api_key=None,  # Replace with your test API key if needed
        embedding_model=JinaEmbedding(),  # Initialize with test embedding model
        verify_certs=False,
        ssl_show_warn=False,
    )
    
    # Create test knowledge base
    index_name, num_docs = create_test_knowledge_base(es_client)
    
    # Verify the results
    assert index_name == "sample_articles"
    assert num_docs > 0
    
    # Clean up
    es_client.delete_index(index_name) 