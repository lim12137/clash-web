from langchain_core.tools import tool

@tool
def multiply(a: int, b: int) -> int:
    """
    Calculate the product of two integers.

    Args:
        a (int): The first integer.
        b (int): The second integer.

    Returns:
        int: The product of a and b.
    """
    return a * b

@tool
def add(a: int, b: int) -> int:
    """
    Calculate the sum of two numbers.

    Args:
        a (int): The first addend.
        b (int): The second addend.

    Returns:
        int: The sum of a and b.
    """
    return a+b