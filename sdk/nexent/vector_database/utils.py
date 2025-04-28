from datetime import datetime
from typing import Dict, Any, List

def format_size(size_in_bytes):
    """Convert size in bytes to human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_in_bytes < 1024.0:
            return f"{size_in_bytes:.2f} {unit}"
        size_in_bytes /= 1024.0
    return f"{size_in_bytes:.2f} PB"

def format_timestamp(timestamp_ms):
    """Convert millisecond timestamp to formatted date string"""
    dt = datetime.fromtimestamp(timestamp_ms / 1000.0)
    return dt.strftime('%Y-%m-%d %H:%M:%S')

def build_weighted_query(text, term_weights, field_weights=None, boost_factor=2.0):
    """
    构建 Elasticsearch 加权查询 DSL

    参数:
        text (str): 原始查询文本
        term_weights (dict): 分词权重字典 {term: weight}
        field_weights (dict): 字段权重字典 {field_name: weight}，默认 {"title": 1, "content": 1}
        boost_factor (float): 权重放大系数，默认 2.0

    返回:
        dict: Elasticsearch 查询 DSL
    """
    if field_weights is None:
        field_weights = {"title": 1, "content": 1}

    # 将英文文本转换为小写
    text = text.lower()

    # 构建 function_score 的 functions 数组
    functions = []
    for term, weight in term_weights.items():
        for field in field_weights:
            functions.append({
                # 为每个词创建 filter 条件
                "filter": {"term": {field: term}},
                # 实际权重 = 计算权重 * 字段权重 * 放大系数
                "weight": weight * field_weights[field] * boost_factor
            })

    # 生成 should 子句
    should_clauses = []
    for field, weight in field_weights.items():
        should_clauses.extend([
            {
                "match_phrase": {
                    field: {
                        "query": text,
                        "slop": 3,
                        "boost": weight  # 为 match_phrase 设置 boost
                    }
                }
            },
            {
                "match": {
                    field: {
                        "query": text,
                        "minimum_should_match": "50%",
                        "fuzziness": "AUTO",
                        "boost": weight  # 为 match 设置 boost
                    }
                }
            }
        ])

    query_body = {
        "query": {
            "function_score": {
                "query": {
                    "bool": {
                        "should": should_clauses,
                        "minimum_should_match": 1
                    }
                },
                "functions": functions,
                "score_mode": "sum",
                "boost_mode": "multiply"
            }
        }
    }

    return query_body