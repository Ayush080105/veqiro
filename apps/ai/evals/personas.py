"""The customers the evals play. Fictional, but shaped like who actually signs up for Veqiro:
Indian founders and small teams, mixing English and Hindi, uploading messy exports.

Each persona's brand kit is what the server would return for their organization; the harness
seeds it into core.brand_kit's cache, so agents read it through their normal path.
"""
from core.brand_kit import BrandKit

KULHAD = "eval_org_kulhad"
LEDGERLOOP = "eval_org_ledgerloop"

BRAND_KITS: dict[str, BrandKit] = {
    KULHAD: BrandKit(
        company_name="Kulhad Co.",
        company_description="D2C chai brand from Jaipur selling masala and elaichi chai blends and "
                            "clay-cup gift boxes online.",
        value_proposition="Dhaba-style chai at home in 3 minutes, no artificial flavour.",
        industry="Food & beverage (D2C)",
        target_audience="Urban Indians aged 22-40 who miss roadside chai; gifting buyers at festivals.",
        brand_voice="Warm, witty, a little nostalgic. Hinglish is welcome; never corporate.",
        platform_tones={"instagram": "playful, Hinglish, visual-first",
                        "linkedin": "founder story, honest", "twitter": "short, witty"},
        competitors=["Chaayos", "Vahdam"],
        key_differentiators="Hand-pounded spices, clay kulhad gift boxes, ships in 48 hours.",
        website_url="https://kulhad.example.in",
        location="Jaipur, India",
    ),
    LEDGERLOOP: BrandKit(
        company_name="LedgerLoop",
        company_description="B2B SaaS that automates GST invoicing and payment reminders for "
                            "Indian SMBs.",
        value_proposition="Get paid 11 days faster with automatic GST-compliant invoices and "
                          "WhatsApp reminders.",
        industry="B2B SaaS / fintech",
        target_audience="Owners and finance leads of Indian SMBs with 10-200 employees.",
        brand_voice="Clear, confident, practical. No hype, no buzzwords.",
        platform_tones={"linkedin": "professional, founder-led", "twitter": "crisp",
                        "instagram": "friendly"},
        competitors=["Zoho Invoice", "Vyapar"],
        key_differentiators="WhatsApp payment reminders, auto GST reconciliation, Tally sync.",
        website_url="https://ledgerloop.example.com",
        location="Bengaluru, India",
    ),
}

# What the Memory screen would hold for LedgerLoop, rendered the way the server's context
# service builds memory_block: summary first, facts last.
LEDGERLOOP_FACTS = [
    "Founder is Riya Kapoor; she signs posts as 'Riya'.",
    "XYZ Corp pays its invoices on the 2nd of every month.",
    "ABC Traders pays its invoices on the 1st of every month.",
    "Monthly recurring revenue is ₹18.4 lakh as of August 2026.",
]


def memory_block(facts: list[str], summary_paragraphs: int = 1) -> str:
    """A memory block in the server's format. A long summary is what pushed facts out once."""
    summary = (
        "The user runs LedgerLoop and uses Veqiro for finance questions, social posts and "
        "collections follow-ups. They prefer short answers with the number first. "
    ) * (6 * summary_paragraphs)
    facts_md = "\n".join(f"• {f}" for f in facts)
    return (
        f"## Conversation Summary\n{summary.strip()}\n\n"
        f"## Organization Context\nLedgerLoop, Bengaluru. B2B SaaS for GST invoicing.\n\n"
        f"## Established Facts\n{facts_md}"
    )
