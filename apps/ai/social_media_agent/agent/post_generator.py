"""
post_generator.py
-----------------
LangChain tool: generates social media content ideas based on user input
and the brand kit context. Returns themes and concepts, not ready-to-publish posts.
"""

from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
from typing import Optional
import json


class PostGeneratorInput(BaseModel):
    user_request: str
    brand_context: str
    platform: Optional[str] = None
    num_ideas: Optional[int] = 5


POST_GENERATOR_SYSTEM = """You are a senior social media content strategist.

You will receive:
1. A brand kit describing the company's identity, voice, and audience.
2. A user request for content ideas.
3. An optional platform focus.

Your job is to generate creative content THEMES and IDEAS — not ready-to-publish posts.
Think of these as creative briefs or directions the user can explore and develop further.

For each idea, provide:
- "title": short punchy name for the content theme (5 words max)
- "concept": 1-2 sentence description of the idea and why it works for the brand
- "angle": the emotional or strategic angle (e.g. humor, nostalgia, education, FOMO, inspiration)
- "formats": list of best formats for this idea (e.g. reel, carousel, story, tweet thread, LinkedIn article)
- "example_direction": one concrete example of how this could look (NOT a full caption — just a direction)

Return ONLY a valid JSON array. No markdown, no explanation.
"""


@tool("generate_posts", args_schema=PostGeneratorInput)
def generate_posts(
    user_request: str,
    brand_context: str,
    platform: Optional[str] = None,
    num_ideas: int = 5,
) -> str:
    """
    Generates social media content ideas and themes based on the user's request and brand kit.
    Returns creative concepts and directions, not ready-to-publish captions.
    """
    llm = ChatOpenAI(model="gpt-4o", temperature=0.9)

    platform_note = f"Focus on {platform} content." if platform else "Ideas should work across platforms."

    user_prompt = f"""
{brand_context}

User Request: {user_request}

{platform_note}

Generate exactly {num_ideas} content ideas. Return ONLY a valid JSON array.
"""

    messages = [
        SystemMessage(content=POST_GENERATOR_SYSTEM),
        HumanMessage(content=user_prompt),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    ideas = json.loads(raw)
    return json.dumps({"ideas": ideas, "count": len(ideas)}, indent=2)