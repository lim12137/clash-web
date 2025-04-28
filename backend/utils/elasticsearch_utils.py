from typing import Dict


def get_active_tasks_status(data_process_service: str, index_name: str) -> Dict[str, str]:
    """
    Get active tasks status from data process service for a specific index.

    Args:
        data_process_service: Data process service URL
        index_name: Name of the index to check

    Returns:
        Dictionary mapping path_or_url to task status
    """
    try:
        import requests
        from urllib.parse import urljoin

        # Get data process service URL from environment
        url = urljoin(data_process_service, f'tasks/indices/{index_name}/tasks')

        # Make request to data process service
        response = requests.get(url)
        response.raise_for_status()

        # Parse response
        data = response.json()

        # Create mapping of path_or_url to status
        status_map = {}
        for file_info in data.get('files', []):
            path_or_url = file_info.get('path_or_url')
            status = file_info.get('status')
            if path_or_url and status:
                status_map[path_or_url] = status

        return status_map

    except Exception as e:
        print(f"Error getting active tasks status: {str(e)}")
        return {}
