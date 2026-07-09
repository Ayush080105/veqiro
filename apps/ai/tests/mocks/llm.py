import json


class MockLLM:
    def __init__(self, responses=None):
        self.responses = list(responses or [])
        self.calls = []

    async def complete(self, **kwargs):
        self.calls.append(kwargs)
        if self.responses:
            response = self.responses.pop(0)
            return response() if callable(response) else response
        return self._default_response()

    async def complete_json(self, **kwargs):
        # Mirrors LLMClient.complete_json: same call, parsed result.
        raw = await self.complete(**kwargs)
        return json.loads(raw)

    def _default_response(self):
        return json.dumps(
            {
                "bottom_line": "[FACT] Mock bottom line.",
                "market_overview": "[FACT] Mock market overview.",
                "key_players": [{"name": "Acme AI", "role": "competitor", "note": "Mock note"}],
                "opportunities": ["Opportunity"],
                "risks": ["Risk"],
                "key_stats": [{"label": "Growth", "value": "20%"}],
                "emerging_trends": ["Agentic workflows"],
                "target_customers": "Founders",
                "recommended_actions": ["Research competitors"],
            }
        )

    def count_tokens(self, value):
        return len(str(value).split())
