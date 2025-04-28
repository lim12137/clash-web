import jieba.posseg as pseg

from .stopwords import load_stopwords

load_stopwords()
# 用于预加载jieba
pseg.lcut('preload jieba')