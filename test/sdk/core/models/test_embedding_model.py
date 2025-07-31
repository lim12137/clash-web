import pytest
from unittest.mock import AsyncMock, patch

from sdk.nexent.core.models.embedding_model import OpenAICompatibleEmbedding, JinaEmbedding


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def openai_embedding_instance():
    """Return an OpenAICompatibleEmbedding instance with minimal viable attributes for tests."""

    return OpenAICompatibleEmbedding(
        model_name="dummy-model",
        base_url="https://api.example.com",
        api_key="dummy-key",
        embedding_dim=1536,
    )


@pytest.fixture()
def jina_embedding_instance():
    """Return a JinaEmbedding instance with minimal viable attributes for tests."""

    return JinaEmbedding(api_key="dummy-key")


# ---------------------------------------------------------------------------
# Tests for dimension_check
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dimension_check_success(openai_embedding_instance):
    """dimension_check should return embeddings when no exception is raised."""

    expected_embeddings = [[0.1, 0.2, 0.3]]

    with patch(
        "sdk.nexent.core.models.embedding_model.asyncio.to_thread",
        new_callable=AsyncMock,
        return_value=expected_embeddings,
    ) as mock_to_thread:
        result = await openai_embedding_instance.dimension_check()

        assert result == expected_embeddings
        mock_to_thread.assert_awaited_once()


@pytest.mark.asyncio
async def test_dimension_check_failure(openai_embedding_instance):
    """dimension_check should return an empty list when an exception is raised inside to_thread."""

    with patch(
        "sdk.nexent.core.models.embedding_model.asyncio.to_thread",
        new_callable=AsyncMock,
        side_effect=Exception("connection error"),
    ) as mock_to_thread:
        result = await openai_embedding_instance.dimension_check()
        
        assert result == []
        mock_to_thread.assert_awaited_once()


# ---------------------------------------------------------------------------
# Tests for JinaEmbedding.dimension_check
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_jina_dimension_check_success(jina_embedding_instance):
    """dimension_check should return embeddings when no exception is raised."""

    expected_embeddings = [[0.5, 0.4, 0.3]]

    with patch(
        "sdk.nexent.core.models.embedding_model.asyncio.to_thread",
        new_callable=AsyncMock,
        return_value=expected_embeddings,
    ) as mock_to_thread:
        result = await jina_embedding_instance.dimension_check()

        assert result == expected_embeddings
        mock_to_thread.assert_awaited_once()


@pytest.mark.asyncio
async def test_jina_dimension_check_failure(jina_embedding_instance):
    """dimension_check should return an empty list when an exception is raised inside to_thread."""

    with patch(
        "sdk.nexent.core.models.embedding_model.asyncio.to_thread",
        new_callable=AsyncMock,
        side_effect=Exception("connection error"),
    ) as mock_to_thread:
        result = await jina_embedding_instance.dimension_check()

        assert result == []
        mock_to_thread.assert_awaited_once()
