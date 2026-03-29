class LLMError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class TokenBudgetExceeded(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class ExternalAPIError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class DocumentTooLargeError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class InvalidTokenError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)
