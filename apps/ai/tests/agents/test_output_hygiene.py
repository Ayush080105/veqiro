"""Output the customer receives must be usable as-is: emails without markdown or header lines,
ideas that survive a null field. Found by apps/ai/evals (vega.compose.*, maya.ideas.*)."""
from agents.maya.routes import ContentIdea
from agents.vega.routes import _clean_email


def test_email_header_lines_and_markdown_are_removed():
    subject, body = _clean_email("", (
        "**To:** Anjali Rao <anjali@example.com>  \n**Subject:** August Investor Update\n\n"
        "Hi Anjali,\n\nMRR grew to **₹18.4 lakh**.  \n\n## Ask\nIntros to CFOs.\n\nBest,  \nRiya"))
    assert subject == "August Investor Update"
    assert body == "Hi Anjali,\n\nMRR grew to ₹18.4 lakh.\n\nAsk\nIntros to CFOs.\n\nBest,\nRiya"


def test_a_given_subject_wins_and_plain_text_is_untouched():
    assert _clean_email("Order delay", "Subject: other\nHi team,\n# of boxes: 2000\nThanks") == (
        "Order delay", "Hi team,\n# of boxes: 2000\nThanks")


def test_idea_with_null_fields_is_kept_not_a_500():
    idea = ContentIdea(title="Diwali gift box", hook=None, visual_description=None,
                       suggested_hashtags=None, reasoning="Gifting season")
    assert idea.visual_description == "" and idea.hook == "" and idea.suggested_hashtags == []
