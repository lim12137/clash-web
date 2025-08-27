# Northbound customize error class
class LimitExceededError(Exception):
    pass

class UnauthorizedError(Exception):
    pass

class SignatureValidationError(Exception):
    """Raised when X-Signature header is missing or does not match the expected HMAC value."""
    pass
