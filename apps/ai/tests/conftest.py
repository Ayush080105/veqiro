import os
import sys
from pathlib import Path

import pytest

AI_ROOT = Path(__file__).resolve().parents[1]
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
os.environ.setdefault("MOCK_MODE", "true")


@pytest.fixture
def user_context():
    from tests.fixtures.user_context import USER_CONTEXT

    return dict(USER_CONTEXT)


@pytest.fixture
def brand_kit():
    from tests.fixtures.brand_kit import BRAND_KIT

    return dict(BRAND_KIT)


@pytest.fixture
def competitor_data():
    from tests.fixtures.competitor_data import COMPETITORS

    return [dict(item) for item in COMPETITORS]


@pytest.fixture
def mock_llm():
    from tests.mocks.llm import MockLLM

    return MockLLM()


@pytest.fixture
def mock_scraper():
    from tests.mocks.scraper import MockScraper

    return MockScraper()


@pytest.fixture
def force_mock_mode(monkeypatch):
    from core.config import settings

    monkeypatch.setattr(settings, "MOCK_MODE", True)
    return settings


@pytest.fixture
def force_live_mode(monkeypatch):
    from core.config import settings

    monkeypatch.setattr(settings, "MOCK_MODE", False)
    return settings
