"""
brain.py
--------
FINAL production architecture:

- NO index-based logic
- Fully role-based image pipeline
- Works with all flag combinations
"""

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from social_media_agent.agent.intent_detector import detect_intent
from social_media_agent.agent.brand_kit import (
    load_brand_kit,
    brand_kit_to_context_string,
    extract_brand_assets,
    fetch_images,
)

from social_media_agent.agent.post_generator import generate_posts
from social_media_agent.agent.image_generator import generate_image
from social_media_agent.agent.chat_handler import general_chat

from typing import Optional, List, Dict
import json
import asyncio


AGENT_SYSTEM_PROMPT = """You are an expert AI Social Media Manager Employee working for a brand.

You have access to two tools:
1. generate_posts
2. general_chat

{brand_context}

IMPORTANT RULES:
- Always maintain brand voice.
- Always use brand context.
- Be decisive.
"""


# ── Tools ───────────────────────────────────────────

def get_tools(brand_context: str):

    def generate_posts_tool(prompt: str):
        """Generate social media posts using brand context."""
        return generate_posts.invoke({
            "user_request": prompt,
            "brand_context": brand_context
        })

    def general_chat_tool(prompt: str):
        """Handle general conversation using brand context."""
        return general_chat.invoke({
            "user_request": prompt,
            "brand_context": brand_context
        })

    return [generate_posts_tool, general_chat_tool]


# ── MAIN RUNNER ─────────────────────────────────────

async def run_social_media_agent(
    user_message: str,
    conversation_history: Optional[List[dict]] = None,
    brand_kit_override: Optional[dict] = None,
    brand_images: Optional[List[bytes]] = None,
) -> dict:

    # ── 1. Load brand kit
    brand_kit = load_brand_kit(override=brand_kit_override)

    image_urls, selected_colors = extract_brand_assets(brand_kit)
    brand_kit["brand_colors"] = selected_colors or []

    brand_context = brand_kit_to_context_string(brand_kit)

    # ── 2. Intent detection
    intent_result = detect_intent(user_message)

    # ── 3. 🔥 FINAL ROLE-BASED IMAGE BUILDING
    ordered_images: List[Dict] = []

    use_mascot = brand_kit.get("use_mascot", False)
    use_logo = brand_kit.get("use_logo", False)
    use_refs = brand_kit.get("use_reference_images", False)

    try:
        images_to_fetch = []

        # ✅ EXPLICIT URL MAPPING (NO INDEX BUGS)

        if use_mascot and brand_kit.get("mascot_url"):
            images_to_fetch.append({
                "type": "mascot",
                "url": brand_kit["mascot_url"]
            })

        if use_logo and brand_kit.get("logo_url"):
            images_to_fetch.append({
                "type": "logo",
                "url": brand_kit["logo_url"]
            })

        if use_refs and brand_kit.get("reference_images"):
            for url in brand_kit["reference_images"]:
                images_to_fetch.append({
                    "type": "reference",
                    "url": url
                })

        # ── Fetch images ─────────────────────
        if images_to_fetch:
            urls = [img["url"] for img in images_to_fetch]

            print("\n📥 Fetching images:", urls)

            fetched_images = await fetch_images(urls)

            for meta, img_bytes in zip(images_to_fetch, fetched_images):
                ordered_images.append({
                    "type": meta["type"],
                    "data": img_bytes
                })

    except Exception as e:
        print("❌ Image fetch failed:", e)
        ordered_images = []

    # ── Debug
    print("\n🧠 FINAL ROLE-BASED IMAGES")
    for img in ordered_images:
        print(f"{img['type']} → {len(img['data'])} bytes")

    # ── 4. LLM
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.5,
    )

    tools = get_tools(brand_context=brand_context)

    agent = create_react_agent(
        model=llm,
        tools=tools,
    )

    # ── 5. Messages
    messages = []

    if conversation_history:
        for turn in conversation_history:
            messages.append({
                "role": turn.get("role", "user"),
                "content": turn.get("content", "")
            })

    intent_hint = _build_intent_hint(
        intent_result.intent,
        user_message
    )

    messages.append({
        "role": "user",
        "content": f"{AGENT_SYSTEM_PROMPT.format(brand_context=brand_context)}\n\n{intent_hint}"
    })

    result = agent.invoke({"messages": messages})
    final_response = result["messages"][-1].content

    # ── 6. IMAGE GENERATION
    if intent_result.intent in ["generate_image", "post_ideas"]:
        try:
            print("\n🔥 IMAGE GENERATION TRIGGERED")

            generate_image.invoke({
                "user_request": user_message,
                "brand_context": brand_context,
                "brand_images": ordered_images
            })

        except Exception as e:
            print("❌ Image generation failed:", e)

    return {
        "intent": intent_result.intent,
        "intent_confidence": intent_result.confidence,
        "intent_reasoning": intent_result.reasoning,
        "response": final_response,
        "tool_outputs": []
    }


# ── Helpers ─────────────────────────────────────────

def _build_intent_hint(intent: str, user_message: str) -> str:
    hints = {
        "post_ideas": f"[Generate post]\nUser: {user_message}",
        "generate_image": f"[Generate image]\nUser: {user_message}",
        "general_chat": f"[Chat]\nUser: {user_message}",
    }
    return hints.get(intent, user_message)


def _safe_parse_json(text: str):
    try:
        return json.loads(text)
    except Exception:
        return text