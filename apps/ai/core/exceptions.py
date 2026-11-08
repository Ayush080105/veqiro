class LLMError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class LLMRefusalError(LLMError):
    """The model declined the request on policy grounds (Claude `stop_reason="refusal"`).

    Permanent for this request: retry loops re-raise it instead of trying again."""


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
