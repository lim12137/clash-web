from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("Nexent_MCP", port=5011)

# Load environment variables
load_dotenv()

# import json
# import os

# from nexent.core.tools import EXASearchTool, KnowledgeBaseSearchTool, SummaryTool
# from smolagents.models import OpenAIServerModel

# # Instantiate tools
# EXA_API_KEY = os.getenv("EXA_API_KEY")
# exa_tool = EXASearchTool(exa_api_key=EXA_API_KEY, lang="en", max_results=5)

# KB_BASE_URL = os.getenv("KB_BASE_URL")
# SELECTED_KB_NAMES = os.getenv("SELECTED_KB_NAMES")
# kb_tool = KnowledgeBaseSearchTool(index_names=json.loads(SELECTED_KB_NAMES), base_url=KB_BASE_URL, lang="en", top_k=5)

# # Model system prompt
# SUMMARY_SYSTEM_PROMPT = """You are a professional assistant who needs to answer user questions based on retrieved information.
# Please carefully read the retrieved information, extract key content, organize language, and answer user questions.
# If there is no relevant content in the retrieved information, please clearly inform the user that you cannot answer, and do not fabricate content.
# Answers should be concise, clear, well-organized, and as complete as possible in addressing user questions."""
# MODEL_NAME = os.getenv('LLM_MODEL_NAME')
# MODEL_URL = os.getenv('LLM_MODEL_URL')
# MODEL_KEY = os.getenv('LLM_API_KEY')

# model_client = OpenAIServerModel(api_base=MODEL_URL, api_key=MODEL_KEY, model_id=MODEL_NAME, temperature=0.3,
#                                  top_p=0.95)
# summary_tool = SummaryTool(llm=model_client)

# # Register EXA search tool
# @mcp.tool(name=EXASearchTool.name, description=EXASearchTool.description)
# def exa_web_search(query: str) -> str:
#     return exa_tool.forward(query)
#
# # Register knowledge base search tool
# @mcp.tool(name=kb_tool.name, description=kb_tool.description)
# def knowledge_base_search(query: str) -> str:
#     return kb_tool.forward(query)
#
# # Register summary tool
# @mcp.tool(name=summary_tool.name, description=summary_tool.description)
# def generate_summary(query: str, search_result: str) -> str:
#     return summary_tool.forward(query, search_result)

# @mcp.tool(name=EXASearchTool.name, description=EXASearchTool.description)
# def exa_web_search(query: str) -> str:
#     return exa_tool.forward(query)

if __name__ == "__main__":
    print("Starting Search Tools MCP Server...")
    mcp.run(transport="sse")
