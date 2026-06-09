import json

import pytest
from fastapi import HTTPException

from agents.scout.agent import ScoutAgent
from agents.scout import routes as scout_routes
from agents.scout.routes import (
    DiscoverCompetitorsRequest,
    ResearchCompanyRequest,
    ResearchTopicRequest,
    ResearchTopicResponse,
    TrendItem,
    TrendingTopicsRequest,
)


def _ctx(user_context):
    return {
        "user_id": user_context["user_id"],
        "organization_id": user_context["organization_id"],
    }


def test_research_topic_request_defaults(user_context):
    request = ResearchTopicRequest(user_id=user_context["user_id"], topic="AI CRM")

    assert request.organization_id == ""
    assert request.depth == "standard"
    assert request.sources_hint == []
    assert request.location == ""


def test_research_topic_response_defaults_and_legacy_migration():
    response = ResearchTopicResponse(findings="Overview", synthesis="Bottom line")

    assert response.market_overview == "Overview"
    assert response.bottom_line == "Bottom line"
    assert response.key_players == []


def test_trend_item_coerces_search_volume():
    assert TrendItem(topic="AI", search_volume_estimate=1200).search_volume_estimate == "1200"
    assert TrendItem(topic="AI", search_volume_estimate=None).search_volume_estimate == "N/A"


@pytest.mark.asyncio
async def test_research_topic_mock_mode_returns_structured_result(force_mock_mode, user_context, monkeypatch):
    monkeypatch.setattr(scout_routes, "google_autocomplete", lambda topic: _async(["ai crm", "ai crm tools"]))

    result = await scout_routes.research_topic(
        ResearchTopicRequest(**_ctx(user_context), topic="AI CRM", depth="quick")
    )

    assert result.bottom_line
    assert result.market_overview
    assert result.sources_scraped
    assert result.keywords_found == ["ai crm", "ai crm tools"]
    assert result.model_used == "mock"


@pytest.mark.asyncio
async def test_trending_topics_mock_mode_respects_count(force_mock_mode, user_context):
    result = await scout_routes.trending_topics(
        TrendingTopicsRequest(**_ctx(user_context), industry="AI SaaS", count=2)
    )

    assert len(result.trends) == 2


@pytest.mark.asyncio
async def test_discover_competitors_mock_mode_respects_count(force_mock_mode, user_context):
    result = await scout_routes.discover_competitors(
        DiscoverCompetitorsRequest(
            **_ctx(user_context),
            description="AI workspace for founders",
            industry="AI productivity",
            count=3,
        )
    )

    assert len(result.competitors) == 3


@pytest.mark.asyncio
async def test_research_company_mock_mode_returns_profile(force_mock_mode, user_context):
    result = await scout_routes.research_company(
        ResearchCompanyRequest(**_ctx(user_context), company_name="Acme AI")
    )

    assert result.company.name == "Acme AI"
    assert result.company.key_features
    assert result.company.recent_news


@pytest.mark.asyncio
async def test_research_topic_live_mode_uses_location_and_skips_failed_scrapes(
    force_live_mode,
    user_context,
    mock_llm,
    mock_scraper,
    monkeypatch,
):
    monkeypatch.setattr(scout_routes, "_llm", mock_llm)
    monkeypatch.setattr(scout_routes._agent, "build_system_prompt", lambda *args, **kwargs: _async("system"))
    monkeypatch.setattr(scout_routes, "google_autocomplete", mock_scraper.google_autocomplete)
    monkeypatch.setattr(scout_routes, "scrape_url", mock_scraper.scrape_url)

    from agents.scout import scraper as scraper_module

    monkeypatch.setattr(scraper_module, "serper_search", mock_scraper.serper_search)

    result = await scout_routes.research_topic(
        ResearchTopicRequest(
            **_ctx(user_context),
            topic="AI CRM",
            depth="deep",
            sources_hint=["https://source.example", "https://fail.example"],
            location="India",
        )
    )

    assert result.bottom_line
    assert result.keywords_found[:2] == ["AI CRM", "AI CRM market"]
    assert result.sources_scraped
    assert any("AI CRM market size trends" in call["query"] for call in mock_scraper.search_calls)
    assert any("India" in call["query"] for call in mock_scraper.search_calls)
    assert mock_scraper.scrape_calls == ["https://source.example", "https://fail.example"]


@pytest.mark.asyncio
async def test_trending_topics_live_mode_parses_wrapped_array(
    force_live_mode,
    user_context,
    mock_scraper,
    monkeypatch,
):
    llm = scout_routes._llm
    monkeypatch.setattr(
        scout_routes,
        "_llm",
        type("LLM", (), {
            "calls": [],
            "count_tokens": lambda self, value: len(str(value).split()),
            "complete": _complete(json.dumps({"trends": [{
                "topic": "AI RevOps",
                "momentum": "rising",
                "relevance_score": 0.91,
                "search_volume_estimate": 1000,
                "content_angle": "Founder guide",
            }]})),
        })(),
    )
    monkeypatch.setattr(scout_routes._agent, "build_system_prompt", lambda *args, **kwargs: _async("system"))
    monkeypatch.setattr(scout_routes, "google_autocomplete", mock_scraper.google_autocomplete)

    from agents.scout import scraper as scraper_module

    monkeypatch.setattr(scraper_module, "serper_search", mock_scraper.serper_search)

    try:
        result = await scout_routes.trending_topics(
            TrendingTopicsRequest(**_ctx(user_context), industry="AI SaaS", count=5, location="India")
        )
    finally:
        monkeypatch.setattr(scout_routes, "_llm", llm)

    assert len(result.trends) == 1
    assert result.trends[0].search_volume_estimate == "1000"
    assert any("India" in call["query"] for call in mock_scraper.search_calls)


@pytest.mark.asyncio
async def test_trending_topics_live_mode_raises_when_no_valid_items(
    force_live_mode,
    user_context,
    mock_scraper,
    monkeypatch,
):
    monkeypatch.setattr(scout_routes, "_llm", _llm_with_response('{"trends": []}'))
    monkeypatch.setattr(scout_routes._agent, "build_system_prompt", lambda *args, **kwargs: _async("system"))
    monkeypatch.setattr(scout_routes, "google_autocomplete", mock_scraper.google_autocomplete)

    from agents.scout import scraper as scraper_module

    monkeypatch.setattr(scraper_module, "serper_search", mock_scraper.serper_search)

    with pytest.raises(HTTPException) as exc:
        await scout_routes.trending_topics(
            TrendingTopicsRequest(**_ctx(user_context), industry="AI SaaS", count=3)
        )

    assert exc.value.status_code == 500


@pytest.mark.asyncio
async def test_discover_competitors_live_mode_parses_array_and_enforces_count(
    force_live_mode,
    user_context,
    competitor_data,
    mock_scraper,
    monkeypatch,
):
    monkeypatch.setattr(scout_routes, "_llm", _llm_with_response(json.dumps(competitor_data)))
    monkeypatch.setattr(scout_routes._agent, "build_system_prompt", lambda *args, **kwargs: _async("system"))

    from agents.scout import scraper as scraper_module

    monkeypatch.setattr(scraper_module, "serper_search", mock_scraper.serper_search)

    result = await scout_routes.discover_competitors(
        DiscoverCompetitorsRequest(
            **_ctx(user_context),
            description="AI workspace",
            industry="AI SaaS",
            count=1,
            location="Pune",
        )
    )

    assert len(result.competitors) == 1
    assert result.competitors[0].name == "Acme AI"
    assert any("Pune" in call["query"] for call in mock_scraper.search_calls)


@pytest.mark.asyncio
async def test_research_company_live_mode_raises_for_malformed_profile(
    force_live_mode,
    user_context,
    mock_scraper,
    monkeypatch,
):
    monkeypatch.setattr(scout_routes, "_llm", _llm_with_response('{"name": "Only name"}'))
    monkeypatch.setattr(scout_routes._agent, "build_system_prompt", lambda *args, **kwargs: _async("system"))
    monkeypatch.setattr(scout_routes, "scrape_url", mock_scraper.scrape_url)

    from agents.scout import scraper as scraper_module

    monkeypatch.setattr(scraper_module, "serper_search", mock_scraper.serper_search)

    with pytest.raises(HTTPException) as exc:
        await scout_routes.research_company(
            ResearchCompanyRequest(**_ctx(user_context), company_name="Acme AI")
        )

    assert exc.value.status_code == 500


@pytest.mark.asyncio
async def test_agent_tool_definitions_include_location_parameters(mock_llm):
    agent = ScoutAgent(mock_llm, rag_service=object())
    tools = {tool.name: tool for tool in agent.get_tools()}

    research_topic_params = {param.name for param in tools["research_topic"].parameters}
    discover_params = {param.name for param in tools["discover_competitors"].parameters}

    assert "location" in research_topic_params
    assert "location" in discover_params


@pytest.mark.asyncio
async def test_execute_tool_research_topic_returns_location_aware_payload(
    mock_llm,
    mock_scraper,
    monkeypatch,
    user_context,
):
    agent = ScoutAgent(mock_llm, rag_service=object())
    monkeypatch.setattr(agent, "build_system_prompt", lambda *args, **kwargs: _async("system"))

    from agents.scout import scraper as scraper_module

    monkeypatch.setattr(scraper_module, "google_autocomplete", mock_scraper.google_autocomplete)
    monkeypatch.setattr(scraper_module, "serper_search", mock_scraper.serper_search)
    monkeypatch.setattr(scraper_module, "scrape_url", mock_scraper.scrape_url)

    raw = await agent.execute_tool(
        "research_topic",
        {"topic": "AI CRM", "location": "India", "sources_hint": ["https://source.example"]},
        user_context["user_id"],
        user_context["organization_id"],
    )
    data = json.loads(raw)

    assert data["bottom_line"]
    assert data["keywords_found"]
    assert any("India" in call["query"] for call in mock_scraper.search_calls)


@pytest.mark.asyncio
async def test_execute_tool_unknown_tool_raises(mock_llm, user_context):
    agent = ScoutAgent(mock_llm, rag_service=object())

    with pytest.raises(ValueError):
        await agent.execute_tool("missing_tool", {}, user_context["user_id"], user_context["organization_id"])


def _async(value):
    async def inner(*_args, **_kwargs):
        return value

    return inner()


def _complete(response):
    async def complete(self, **kwargs):
        self.calls.append(kwargs)
        return response

    return complete


def _llm_with_response(response):
    return type("LLM", (), {
        "calls": [],
        "count_tokens": lambda self, value: len(str(value).split()),
        "complete": _complete(response),
    })()
