class MockGmail:
    def __init__(self):
        self.sent_messages = []

    async def send(self, message):
        self.sent_messages.append(message)
        return {"id": "gmail-message-1", "status": "sent"}
