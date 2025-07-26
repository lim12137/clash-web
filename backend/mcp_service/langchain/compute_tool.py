from langchain_core.tools import tool

@tool
def multiply(a: int, b: int) -> int:
    """Calculate the product of two integers."""
    return a * b

@tool
def add(a: int, b: int) -> int:
    """Calculate the sum of two numbers"""
    return a+b