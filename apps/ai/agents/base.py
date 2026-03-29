import uuid
from abc import ABC, abstractmethod
from typing import AsyncGenerator

from core.llm import LLMClient
from core.rag import RAGService
from core.brand_kit import load_brand_kit
from core.models import ChatRequest, ChatSyncResponse


class BaseAgent(ABC):
    slug: str = "base"
    name: str = "Base Agent"
    default_provider: str = "openai"
    default_model: str = "gpt-4o-mini"
    personality: str = "Helpful AI assistant"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        self.llm = llm_client
        self.rag = rag_service

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        brand_kit = await load_brand_kit(user_id)
        prompt = (
            f"You are {self.name}, {self.personality}.\n\n"
            f"Company: {brand_kit.company_name}\n"
            f"Industry: {brand_kit.industry}\n"
            f"Target Audience: {brand_kit.target_audience}\n"
            f"Brand Voice: {brand_kit.brand_voice}\n"
            f"Key Differentiators: {brand_kit.key_differentiators}\n"
        )
        if brand_kit.competitors:
            prompt += f"Competitors: {', '.join(str(c) for c in brand_kit.competitors)}\n"
        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        return prompt

    async def chat_stream(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        """Full pipeline: brand_kit -> RAG -> prompt -> stream LLM."""
        system_prompt = await self.build_system_prompt(request.user_id)

        # RAG retrieval
        rag_chunks = await self.rag.retrieve(
            user_id=request.user_id,
            query=request.message,
            top_k=5,
            source_agent=self.slug,
        )
        if rag_chunks:
            rag_context = "\n\n".join(c.get("content", "") for c in rag_chunks)
            system_prompt += f"\n\nRelevant context from knowledge base:\n{rag_context}"

        messages = [
            {"role": m.role, "content": m.content} for m in request.history
        ] + [{"role": "user", "content": request.message}]

        async for token in self.llm.stream(
            provider=self.default_provider,
            model=self.default_model,
            system=system_prompt,
            messages=messages,
        ):
            yield token

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        """Collect all streamed tokens into a single sync response."""
        tokens = []
        async for token in self.chat_stream(request):
            tokens.append(token)
        full_text = "".join(tokens)
        tokens_used = self.llm.count_tokens(full_text)
        return ChatSyncResponse(
            response=full_text,
            agent=self.slug,
            message_id=str(uuid.uuid4()),
            tokens_used=tokens_used,
            model_used=self.default_model,
            metadata={},
        )

    async def ingest_to_rag(
        self,
        user_id: str,
        text: str,
        source_id: str,
        metadata: dict | None = None,
    ) -> int:
        return await self.rag.ingest(
            user_id=user_id,
            text=text,
            source_type="text",
            source_id=source_id,
            source_agent=self.slug,
            metadata=metadata,
        )
