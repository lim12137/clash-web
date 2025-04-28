import logging
import os

import requests
from jieba import analyse

logger = logging.getLogger("nlp.stopwords")


def download_stopwords(url: str, save_path: str) -> bool:
    """下载停用词表文件"""
    try:
        logger.info(f"正在下载停用词表: {url}")
        response = requests.get(url, timeout=10)
        response.encoding = 'utf-8'
        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
        logger.info(f"停用词表已保存到: {os.path.abspath(save_path)}")
        return True
    except Exception as e:
        logger.info(f"下载停用词表失败: {str(e)}")
        return False


def load_stopwords(stopwords_name='baidu_stopwords.txt',
                   backup_url='https://raw.githubusercontent.com/goto456/stopwords/master/baidu_stopwords.txt'):
    """
    加载停用词表（如果本地不存在则自动下载）

    参数:
        stopwords_path: 本地停用词表路径
        backup_url: 备用下载URL
    """
    stopwords_path = os.getenv("STOPWORDS_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), stopwords_name))
    # 如果本地文件不存在，尝试下载
    if not os.path.exists(stopwords_path):
        if not download_stopwords(backup_url, stopwords_path):
            logger.error(f"无法加载停用词表，请手动下载并保存到: {os.path.abspath(stopwords_path)}")
            return

    # 验证文件内容
    with open(stopwords_path, 'r', encoding='utf-8') as f:
        first_line = f.readline().strip()
        if not first_line or len(first_line) > 100:  # 简单验证文件格式
            os.remove(stopwords_path)  # 删除可能损坏的文件
            logger.error("停用词表格式异常，已删除文件，请重新下载")
            return

    # 配置到jieba
    analyse.set_stop_words(stopwords_path)
