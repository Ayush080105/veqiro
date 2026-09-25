"""Sage, Vega, Scout, team-chat routing, and memory recall across agents."""
from evals.case import Case, chat
from evals.graders import (CORRECT, HONEST, count, grounded_numbers, judge, mentions,
                           no_markdown, no_placeholders, nonempty, one_of)
from evals.personas import KULHAD, LEDGERLOOP, LEDGERLOOP_FACTS, memory_block

_UPDATE_FACTS = ("August 2026: MRR ₹18.4 lakh (up from ₹16.1 lakh in July). 640 customers. "
                 "Net burn ₹6 lakh/month, runway 21 months. Hired a Head of Sales. "
                 "Ask: intros to CFOs at 50-200 person manufacturing companies.")

_mem_short = chat("rex", "And about ABC Traders?", LEDGERLOOP,
                  history=[{"role": "user", "content": "When does XYZ Corp pay us?"},
                           {"role": "assistant", "content": "XYZ Corp pays on the 2nd of every month."}],
                  memory=memory_block(LEDGERLOOP_FACTS, summary_paragraphs=4))
_mem_vega = chat("vega", "what's our MRR right now?", LEDGERLOOP, memory=memory_block(LEDGERLOOP_FACTS))
_scout = chat("scout", "who are the main D2C chai brands we compete with in India?", KULHAD)

ROUTING = [
    ("is clause 7 of this vendor agreement risky for us?", "lex"),
    ("give me keyword ideas for a blog on GST invoicing", "sage"),
    ("who are our biggest competitors in the chai space?", "scout"),
    ("insta ke liye diwali caption likh do", "maya"),
    ("how many months of runway do we have left?", "rex"),
    ("reply to Rohan's email and suggest Thursday 4pm", "vega"),
    ("mera cash flow kaisa chal raha hai is quarter?", "rex"),
    ("schedule a call with the Saffron Packaging team next week", "vega"),
]

CASES = [
    Case(id="sage.brief.gst_software", agent="sage", endpoint="/ai/sage/content-brief",
         payload={"user_id": "eval_user", "organization_id": LEDGERLOOP,
                  "topic": "Choosing GST invoicing software for a small business",
                  "target_keyword": "gst invoice software"},
         graders=[count("brief.h2_structure", 4), count("brief.title_options", 3),
                  count("brief.must_answer_questions", 3),
                  judge("A writer could start drafting from this brief without asking anything.",
                        "It is specific to GST invoicing in India, not generic SEO advice.",
                        path="brief")],
         story="Marketer wants a brief to hand to a freelance writer.", latency_s=90),

    Case(id="vega.compose.investor_update", agent="vega", endpoint="/ai/vega/compose-email",
         payload={"user_id": "eval_user", "organization_id": LEDGERLOOP,
                  "to": "Anjali Rao <anjali@example-ventures.com>", "subject": "",
                  "instructions": f"Monthly investor update to Anjali. Facts: {_UPDATE_FACTS} "
                                  "Sign off as Riya.", "tone": "professional"},
         graders=[nonempty("draft"), no_placeholders("draft"), no_markdown("draft", "email"),
                  grounded_numbers("draft", _UPDATE_FACTS),
                  mentions("draft", "Anjali", name="addresses Anjali"),
                  judge("Includes the ask (CFO intros at 50-200 person manufacturing companies).",
                        "Ready to send as-is.", path="draft")],
         story="Founder drafts the monthly investor email. Wrong numbers to an investor are costly.",
         latency_s=45),

    Case(id="vega.compose.hinglish_instructions", agent="vega", endpoint="/ai/vega/compose-email",
         payload={"user_id": "eval_user", "organization_id": KULHAD,
                  "to": "orders@saffronpackaging.example", "subject": "",
                  "instructions": "Saffron wale ko bolo ki 2000 kulhad boxes ka order 10 din late hai, "
                                  "Diwali se pehle chahiye, 15 October tak deliver karo warna order cancel. "
                                  "Polite but firm. Sign as Aman, Kulhad Co.", "tone": "firm"},
         graders=[nonempty("draft"), no_placeholders("draft"),
                  no_markdown("draft", "email"),
                  mentions("draft", "2000", "2,000", name="order size"),
                  mentions("draft", "15 October", "October 15", "15th October", "Oct 15", name="deadline"),
                  judge("Written in clear professional English suitable for a supplier.",
                        "Polite but clearly states the cancellation consequence.", path="draft")],
         story="Owner dictates in Hinglish; the supplier email must be clear English.",
         latency_s=45),

    Case(id="memory.short_followup_recalls_fact", agent="rex", endpoint=_mem_short[0], payload=_mem_short[1],
         graders=[mentions("response", "1st", "first", "re:\\b1\\b", name="ABC pays on the 1st"),
                  judge("Does not say ABC Traders is unknown or missing from memory.",
                        category=HONEST, path="response")],
         story="A short follow-up with a long memory summary once dropped the saved facts "
               "(fixed in 68256c4). This keeps it fixed."),

    Case(id="memory.cross_agent_fact", agent="vega", endpoint=_mem_vega[0], payload=_mem_vega[1],
         graders=[mentions("response", "18.4", name="₹18.4 lakh from memory"),
                  judge("Answers from the saved fact instead of asking the customer.", path="response")],
         story="The MRR was saved from a Rex conversation; Vega should know it too.", latency_s=40),

    Case(id="scout.chat.competitors", agent="scout", endpoint=_scout[0], payload=_scout[1],
         graders=[nonempty("response"),
                  judge("Names at least 3 real Indian chai/tea brands that sell direct to consumers online.",
                        "Does not list Kulhad Co. itself as a competitor.", path="response")],
         story="Owner starting competitive research; answer is grounded in live web search. "
               "(Took 45-74s when Scout profiled every competitor; one discovery call is enough.)",
         latency_s=45),
] + [
    Case(id=f"router.{i + 1}.{slug}", agent="router", endpoint="/ai/router/classify",
         payload={"user_id": "eval_user", "message": msg},
         graders=[one_of("agent_slug", slug)],
         story=f"Team chat: '{msg}' must reach {slug}; a wrong hop means a wrong answer.",
         latency_s=15)
    for i, (msg, slug) in enumerate(ROUTING)
]
