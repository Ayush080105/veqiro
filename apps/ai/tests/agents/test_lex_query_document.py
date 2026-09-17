"""Lex "Ask a document": a question about a real contract must reach the model.

The similarity search used a fixed 0.70 floor. With text-embedding-3-small the best chunk of a
real 30-page contract scored ~0.62 even for a question it answers exactly, so every chunk was
dropped and every question returned 404 (surfaced to the user as "something went wrong").
"""

import asyncio

import pytest

from agents.lex import routes
from core.config import settings


class _Row(dict):
    pass


class _Conn:
    def __init__(self, scores):
        self.scores = scores

    async def fetch(self, *_args):
        return [_Row(id=i, content=f"chunk {i}", source_type="pdf", source_agent="lex",
                     metadata="{}", score=s) for i, s in enumerate(self.scores)]


class _Pool:
    def __init__(self, scores):
        self.conn = _Conn(scores)

    def acquire(self):
        pool = self

        class _Ctx:
            async def __aenter__(self):
                return pool.conn

            async def __aexit__(self, *exc):
                return False

        return _Ctx()


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(settings, "MOCK_MODE", False)

    async def fake_embed(_text):
        return [0.1, 0.2]

    import core.embeddings
    monkeypatch.setattr(core.embeddings, "embed_text", fake_embed)


def _retrieve(monkeypatch, scores, **kwargs):
    import core.db
    pool = _Pool(scores)

    async def get_pool():
        return pool

    monkeypatch.setattr(core.db, "get_pool", get_pool)
    return asyncio.run(routes._rag.retrieve(user_id="u", query="q", **kwargs))


def test_default_floor_still_filters_broad_searches(live, monkeypatch):
    assert [c["score"] for c in _retrieve(monkeypatch, [0.8, 0.62, 0.3])] == [0.8]


def test_min_score_zero_keeps_ranked_chunks(live, monkeypatch):
    assert [c["score"] for c in _retrieve(monkeypatch, [0.62, 0.44, 0.3], min_score=0.0)] == [0.62, 0.44, 0.3]
