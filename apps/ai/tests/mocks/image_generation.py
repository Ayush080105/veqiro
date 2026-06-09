class MockImageGeneration:
    async def generate(self, prompt):
        return {"url": "https://images.example/mock.png", "prompt": prompt}
