import asyncio
from typing import List

import aiohttp

from consts.const import MODEL_ENGINE_APIKEY, MODEL_ENGINE_HOST
from consts.exceptions import TimeoutException, NotFoundException


async def get_me_models_impl(timeout: int = 2, type: str = "") -> List:
    """
    Fetches a list of models from the model engine API with response formatting.
    Parameters:
        timeout (int): The total timeout for the request in seconds.
        type (str): The type of model to filter for. If empty, returns all models.
    Returns:
        - filtered_result: List of model data dictionaries
    """
    try:
        headers = {
            'Authorization': f'Bearer {MODEL_ENGINE_APIKEY}',
        }
        async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=timeout),
                connector=aiohttp.TCPConnector(ssl=False)
        ) as session:
            async with session.get(
                    f"{MODEL_ENGINE_HOST}/open/router/v1/models",
                    headers=headers
            ) as response:
                response.raise_for_status()
                result_data = await response.json()
                result: list = result_data['data']

        # Type filtering
        filtered_result = []
        if type:
            for data in result:
                if data['type'] == type:
                    filtered_result.append(data)
            if not filtered_result:
                result_types = set(data['type'] for data in result)
                raise NotFoundException(
                    f"No models found with type '{type}'. Available types: {result_types}.")
        else:
            filtered_result = result

        return filtered_result
    except asyncio.TimeoutError:
        raise TimeoutException("Request timeout.")
    except Exception as e:
        raise Exception(f"Failed to get model list: {str(e)}.")


async def check_me_variable_set() -> bool:
    """
    Check if the ME environment variables are correctly set.
    Returns:
        bool: True if both MODEL_ENGINE_APIKEY and MODEL_ENGINE_HOST are set and non-empty, False otherwise.
    """
    return bool(MODEL_ENGINE_APIKEY and MODEL_ENGINE_HOST)
