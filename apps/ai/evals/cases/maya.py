"""Maya: posts a customer should be able to publish without editing. Every edit is friction;
an invented claim in a public post is worse."""
from evals.case import Case, chat
from evals.graders import (HONEST, USABLE, avoids, count, distinct, grounded_numbers, judge,
                           max_chars, mentions, no_markdown, no_placeholders, nonempty, shorter_than)
from evals.personas import KULHAD, LEDGERLOOP, LEDGERLOOP_FACTS, memory_block

MILESTONE = ("MRR grew from ₹9.2 lakh in September 2025 to ₹18.4 lakh in August 2026. "
             "Average days-to-paid for our customers dropped from 38 to 27. 640 SMBs use LedgerLoop.")

_ORIGINAL = (
    "Big news from the LedgerLoop team! After months of work we have shipped WhatsApp payment "
    "reminders. Your customers now get a friendly nudge on WhatsApp when an invoice is due, with a "
    "one-tap UPI link to pay. Early users are seeing invoices paid faster, fewer awkward follow-up "
    "calls, and finance teams getting hours back every week. We built this because our customers "
    "told us chasing payments was the worst part of their month. Try it today from Settings > "
    "Reminders. #fintech #SMB #GST #payments #WhatsApp #startup #India"
)


def _draft(case_id, platform, topic, context, graders, story, org=LEDGERLOOP, tier="regression"):
    return Case(
        id=case_id, agent="maya", endpoint="/ai/maya/draft-content",
        payload={"user_id": "eval_user", "organization_id": org, "topic": topic,
                 "platform": platform, "include_image": False, "use_logo": False,
                 "use_mascot": False, "additional_context": context},
        graders=[nonempty("draft.body"), no_placeholders("draft.body", "draft.cta"), *graders],
        story=story, tier=tier, latency_s=45,
    )


_chat_post = chat("maya", "write a linkedin post about our new GST auto-reconciliation feature", LEDGERLOOP)
_chat_diwali = chat("maya", "diwali ke liye kuch post kar do insta pe", KULHAD)
_chat_signed = chat("maya", "Write a short LinkedIn post in my voice about crossing 640 customers. Sign it off as me.",
                    LEDGERLOOP, memory=memory_block(LEDGERLOOP_FACTS))

CASES = [
    _draft("maya.draft.linkedin_milestone", "linkedin", "Our growth milestone this year", MILESTONE,
           [max_chars("draft.body", 3000, "LinkedIn's 3,000 limit"),
            no_markdown("draft.body", "LinkedIn"),
            grounded_numbers("draft.body", MILESTONE),
            judge("Reads like a founder wrote it: specific, no buzzword filler "
                  "('game-changer', 'thrilled to announce', 'revolutionize').",
                  "Could be posted as-is with no edits.", path="draft.body")],
           "LedgerLoop founder shares a milestone. Every figure must come from what they gave "
           "(simple math on those figures, like 38 to 27 days = 11 days faster, is fine)."),

    _draft("maya.draft.tweet_fits", "twitter", "WhatsApp payment reminders are live",
           "New: LedgerLoop now sends GST invoices' payment reminders on WhatsApp with a UPI pay link.",
           [max_chars("draft.body", 280, "a tweet (280)"),
            judge("It is a single tweet, not a thread or a list of options.", path="draft.body")],
           "Founder wants one tweet. If it is over 280 characters, it cannot be posted."),

    _draft("maya.draft.instagram_voice", "instagram", "Winter launch of our Kesar Elaichi chai",
           "New blend: Kesar Elaichi Chai, 250g, ₹449. Launches 1 November 2026. Ships in 48 hours.",
           [max_chars("draft.body", 2200, "Instagram's 2,200 limit"),
            no_markdown("draft.body", "Instagram"),
            grounded_numbers("draft.body", "250g ₹449 1 November 2026 48 hours"),
            count("draft.hashtags", 1, 30),
            judge("The voice is warm and playful (Hinglish touches welcome), not corporate.",
                  "Mentions the price or launch date correctly if it mentions them at all.",
                  path="draft")],
           "Chai brand launching a product on Instagram; brand voice is warm, witty, Hinglish-friendly.",
           org=KULHAD),

    Case(id="maya.ideas.five_distinct", agent="maya", endpoint="/ai/maya/generate-ideas",
         payload={"user_id": "eval_user", "organization_id": KULHAD, "platform": "instagram",
                  "topic_hint": "Diwali gifting", "count": 5, "include_image": False},
         graders=[count("ideas", 5, 5), distinct("ideas.*.title"), nonempty("ideas.0.hook"),
                  judge("At least 4 of the ideas are specific to a chai brand's Diwali gifting "
                        "(not generic festive greetings).", path="ideas")],
         story="Owner asks for 5 Diwali post ideas to pick from.", latency_s=45),

    Case(id="maya.revise.shorter_no_hashtags", agent="maya", endpoint="/ai/maya/revise",
         payload={"user_id": "eval_user", "organization_id": LEDGERLOOP, "platform": "linkedin",
                  "original_content": _ORIGINAL, "feedback": "make it shorter and remove the hashtags"},
         graders=[shorter_than("revised.body", _ORIGINAL, 0.8),
                  avoids("revised", r"#\w+", category=USABLE, name="hashtags removed"),
                  mentions("revised", "WhatsApp", name="keeps the point (WhatsApp reminders)")],
         story="Founder asks for a tighter version. Both instructions must be followed.",
         latency_s=40),

    Case(id="maya.chat.writes_post", agent="maya", endpoint=_chat_post[0], payload=_chat_post[1],
         graders=[nonempty("_visible"),
                  judge("The customer gets an actual LinkedIn post draft in this reply, not only "
                        "questions about what they want.",
                        "The post is about GST auto-reconciliation for LedgerLoop.",
                        "Contains no invented statistics or customer quotes.", path="_visible")],
         story="Founder asks for a post in one line. A reply of clarifying questions is a bounce.",
         latency_s=60),

    Case(id="maya.chat.hinglish_diwali", agent="maya", endpoint=_chat_diwali[0], payload=_chat_diwali[1],
         graders=[nonempty("_visible"),
                  judge("Gives the customer a usable Instagram caption for Diwali in this reply "
                        "rather than only asking questions.",
                        "Ties it to Kulhad Co.'s chai or gifting, not a generic greeting.",
                        path="_visible")],
         story="Owner types a vague request in Hinglish, like they would on WhatsApp.",
         latency_s=60),

    Case(id="maya.chat.uses_memory_signoff", agent="maya", endpoint=_chat_signed[0], payload=_chat_signed[1],
         graders=[mentions("_visible", "Riya", category=HONEST, name="signs as Riya (from memory)"),
                  no_placeholders("_visible")],
         story="Founder's name is in Memory. Asking 'sign it as me' must not produce '[Your Name]'.",
         latency_s=60),
]
