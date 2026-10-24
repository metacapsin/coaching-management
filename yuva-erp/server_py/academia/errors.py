class HttpError(Exception):
    """An error that is sent to the browser as { "error": message } with this status."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message
