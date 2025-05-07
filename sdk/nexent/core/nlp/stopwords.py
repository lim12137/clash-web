import logging
import os

import requests
from jieba import analyse

logger = logging.getLogger("nlp.stopwords")


def download_stopwords(url: str, save_path: str) -> bool:
    """Download stopwords file"""
    try:
        logger.info(f"Downloading stopwords: {url}")
        response = requests.get(url, timeout=10)
        response.encoding = 'utf-8'
        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
        logger.info(f"Stopwords saved to: {os.path.abspath(save_path)}")
        return True
    except Exception as e:
        logger.info(f"Failed to download stopwords: {str(e)}")
        return False


def load_stopwords(stopwords_name='baidu_stopwords.txt',
                   backup_url='https://raw.githubusercontent.com/goto456/stopwords/master/baidu_stopwords.txt'):
    """
    Load stopwords (automatically download if not exists locally)

    Args:
        stopwords_path: Local stopwords file path
        backup_url: Backup download URL
    """
    stopwords_path = os.getenv("STOPWORDS_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), stopwords_name))
    
    # If local file doesn't exist, try to download
    if not os.path.exists(stopwords_path):
        if not download_stopwords(backup_url, stopwords_path):
            logger.error(f"Unable to load stopwords, please download manually and save to: {os.path.abspath(stopwords_path)}")
            return

    # Validate file content
    with open(stopwords_path, 'r', encoding='utf-8') as f:
        first_line = f.readline().strip()
        if not first_line or len(first_line) > 100:  # Simple format validation
            os.remove(stopwords_path)  # Delete potentially corrupted file
            logger.error("Stopwords file format is invalid, file has been deleted, please download again")
            return

    # Configure to jieba
    analyse.set_stop_words(stopwords_path)
