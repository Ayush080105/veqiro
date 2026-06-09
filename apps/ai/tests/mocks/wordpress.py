class MockWordPress:
    async def publish_post(self, payload):
        return {"id": 1, "status": "draft", "payload": payload}
