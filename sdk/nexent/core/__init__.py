from .tools import SearchTool, KnowledgeBaseSearchTool, SummaryTool
from .utils.observer import MessageObserver, ProcessType

from .tools import SearchTool, KnowledgeBaseSearchTool, SummaryTool


__all__ = ["MessageObserver", "ProcessType",
           "SearchTool", "SummaryTool", "KnowledgeBaseSearchTool"]

# Lazy imports to avoid circular dependencies
def get_core_agent():
    from .agents import CoreAgent
    return CoreAgent

def get_openai_model():
    from .models import OpenAIModel
    return OpenAIModel
