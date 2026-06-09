class MockEmbeddings:
    async def embed(self, text):
        return [float(len(text)), 0.0, 1.0]
