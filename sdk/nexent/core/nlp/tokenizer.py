import math
from collections import defaultdict

import jieba.posseg as pseg
from jieba import analyse

# 词性权重配置（专有名词 > 名词 > 动词 > 形容词 > 其他）
POS_WEIGHTS = {
    'n': 1.3,  # 普通名词
    'nz': 1.5,  # 专有名词（产品名、品牌名等）
    'v': 1.1,  # 动词
    'a': 1.05,  # 形容词
    'm': 1.2,  # 数字
    'eng': 1.2,  # 英文词汇
    'x': 0.8  # 其他词性
}

# 专有名词库（预留后续可从业务数据中动态加载）
HIGH_WEIGHT_NZ_TERMS = {}


def calculate_term_weights(text, use_idf=False, doc_freqs=None, total_docs=1):
    """
    计算查询文本中各个分词的权重

    参数:
        text (str): 要分析的文本
        use_idf (bool): 是否使用 IDF 增强，默认 False
        doc_freqs (dict): 词语的文档频率字典 {term: 出现该词的文档数}
        total_docs (int): 总文档数(用于 IDF 计算)，默认 1

    返回:
        dict: {term: weight} 的字典，权重已归一化到 0-1 范围
    """
    # 将英文文本转换为小写
    text = text.lower()

    # 带词性标注的分词处理
    words = pseg.cut(text)
    term_stats = defaultdict(float)
    total_weight = 0.0

    # 第一轮统计：计算词频+词性权重+位置权重
    for idx, (word, flag) in enumerate(words):
        # 过滤停用词和空白字符
        if word not in analyse.default_tfidf.stop_words and word.strip():
            # 获取词性首字母（中文分词标注规范）
            pos = flag[0].lower()
            # 获取词性对应的基础权重
            pos_weight = POS_WEIGHTS.get(pos, 1.0)
            # 位置权重增强（句首和句尾的词更重要）
            position_factor = 1.2 if idx < 3 or idx > len(text) / 3 else 1.0
            # 组合权重 = 词性权重 * 位置因子
            combined_weight = pos_weight * position_factor
            term_stats[word] += combined_weight
            total_weight += combined_weight

    # 计算 TF 权重（词频权重）
    tf_weights = {term: weight / total_weight for term, weight in term_stats.items()}

    # IDF 增强处理（需要外部传入文档频率数据）
    if use_idf and doc_freqs is not None:
        tfidf_weights = {}
        for term, tf in tf_weights.items():
            # 平滑 IDF 计算（避免除零错误）
            df = doc_freqs.get(term, 0)
            idf = math.log((total_docs + 1) / (df + 1)) + 1
            tfidf_weights[term] = tf * idf
        weights = tfidf_weights
    else:
        weights = tf_weights

    # 长度增强：长词通常包含更多信息
    enhanced_weights = {}
    for term, weight in weights.items():
        # 每多一个字符增加 10% 权重（"人工智能"比"智能"更重要）
        length_factor = 1 + 0.1 * (len(term) - 1)
        enhanced_weights[term] = weight * length_factor

    # 归一化处理（将权重缩放到 0-1 范围）
    max_weight = max(enhanced_weights.values()) if enhanced_weights else 1
    normalized_weights = {term: weight / max_weight for term, weight in enhanced_weights.items()}

    # 专有名词二次增强（确保产品名称等关键术语保持最高权重）
    for term in normalized_weights:
        if term.lower() in HIGH_WEIGHT_NZ_TERMS:
            normalized_weights[term] = min(normalized_weights[term] * 1.5, 1.0)

    # 添加语义相关性检查
    meaningful_terms = []
    for term, weight in normalized_weights.items():
        # 过滤掉权重过低或长度过短的词
        if weight > 0.2 and len(term) > 1:  # 可根据实际情况调整阈值
            meaningful_terms.append((term, weight))

    # 如果没有有意义的词，返回空字典
    if not meaningful_terms:
        return {}

    # 重新归一化
    max_weight = max(weight for _, weight in meaningful_terms)
    return {term: weight / max_weight for term, weight in meaningful_terms}
