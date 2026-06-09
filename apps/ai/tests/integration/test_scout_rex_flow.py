import pytest

from agents.scout.routes import DiscoverCompetitorsRequest, discover_competitors


@pytest.mark.integration
@pytest.mark.asyncio
async def test_scout_competitor_discovery_output_can_feed_rex_context(
    force_mock_mode,
    user_context,
):
    result = await discover_competitors(
        DiscoverCompetitorsRequest(
            user_id=user_context["user_id"],
            organization_id=user_context["organization_id"],
            description="AI workspace for founders",
            industry="AI productivity",
            count=2,
        )
    )

    rex_context = {
        "competitive_landscape": [competitor.name for competitor in result.competitors],
        "benchmark_count": len(result.competitors),
    }

    assert rex_context["benchmark_count"] == 2
    assert rex_context["competitive_landscape"]
