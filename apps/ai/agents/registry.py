"""Agent registry for cross-agent collaboration."""

from __future__ import annotations

from typing import TYPE_CHECKING

from core.tools import ToolDefinition, ToolParameter

if TYPE_CHECKING:
    from agents.base import BaseAgent

_registry: dict[str, "BaseAgent"] = {}

_AGENT_DESCRIPTIONS = {
    "maya": "Content creation & social media: generates ideas, drafts posts, adapts content for platforms, revises with feedback",
    "rex": "Financial analytics & forecasting: analyzes metrics, forecasts revenue, computes financial health, compiles briefings",
    "scout": "Market research & competitive intelligence: researches topics, profiles companies, scans competitors, finds trends",
    "sage": "SEO & content strategy: keyword research, SEO blog generation, content analysis, content briefs",
    "lex": "Legal & compliance: contract analysis, document drafting, legal text explanation",
    "vega": "Executive assistant: email triage, reply drafting, calendar management, event scheduling, daily briefings",
}


def register_agent(agent: "BaseAgent") -> None:
    """Register an agent instance in the global registry."""
    _registry[agent.slug] = agent


def get_agent(slug: str) -> "BaseAgent | None":
    """Retrieve an agent by slug."""
    return _registry.get(slug)


def list_agents() -> list[str]:
    """List all registered agent slugs."""
    return list(_registry.keys())


def get_ask_agent_tool() -> ToolDefinition:
    """Return the cross-agent tool definition available to all agents."""
    desc_lines = "\n".join(f"  - {k}: {v}" for k, v in _AGENT_DESCRIPTIONS.items())
    return ToolDefinition(
        name="ask_agent",
        description=(
            "Ask another AI agent for help with a task outside your expertise. "
            "Use this when the user's request requires capabilities from a different agent. "
            f"Available agents:\n{desc_lines}"
        ),
        parameters=[
            ToolParameter(
                name="agent_slug",
                type="string",
                description="The slug of the agent to ask",
                required=True,
                enum=list(_AGENT_DESCRIPTIONS.keys()),
            ),
            ToolParameter(
                name="question",
                type="string",
                description="A detailed question or request for the other agent. Be specific about what you need.",
                required=True,
            ),
        ],
    )
