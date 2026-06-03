"""Gmail REST API utilities using httpx. In mock mode returns realistic mock email data."""
import asyncio
import base64
import re
from email.mime.text import MIMEText

from core.config import settings

_GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"
_TIMEOUT = 30

_MOCK_EMAILS = [
    {
        "id": "msg_001",
        "thread_id": "thread_001",
        "from": "sarah.chen@accelpartners.com",
        "from_name": "Sarah Chen",
        "from_email": "sarah.chen@accelpartners.com",
        "to": "founder@veqiroai.com",
        "subject": "RE: Veqiro AI – Seed Round Interest",
        "snippet": "Hi, following up on our conversation at TechCrunch Disrupt. We'd love to schedule a deeper dive...",
        "body": (
            "Hi,\n\nFollowing up on our conversation at TechCrunch Disrupt last week. "
            "Our team reviewed your deck and we're very interested in learning more about Veqiro AI.\n\n"
            "We'd love to schedule a 45-minute call this week to do a deeper technical and market diligence. "
            "Are you available Thursday 3-5pm or Friday 2-4pm EST?\n\n"
            "Also, could you share your latest metrics deck prior to the call?\n\n"
            "Looking forward to connecting!\n\nBest,\nSarah Chen\nPartner, Accel Partners"
        ),
        "date": "2025-03-28T14:32:00Z",
        "is_read": False,
        "labels": ["INBOX", "IMPORTANT"],
        "priority": "urgent",
        "suggested_action": "reply",
    },
    {
        "id": "msg_002",
        "thread_id": "thread_002",
        "from": "newsletter@producthunt.com",
        "from_name": "Product Hunt",
        "from_email": "newsletter@producthunt.com",
        "to": "founder@veqiroai.com",
        "subject": "Today's top products on Product Hunt",
        "snippet": "Check out today's most popular products...",
        "body": "Check out today's most popular products on Product Hunt...",
        "date": "2025-03-28T09:00:00Z",
        "is_read": False,
        "labels": ["INBOX"],
        "priority": "low",
        "suggested_action": "archive",
    },
    {
        "id": "msg_003",
        "thread_id": "thread_003",
        "from": "marcus@growthco.io",
        "from_name": "Marcus Rivera",
        "from_email": "marcus@growthco.io",
        "to": "founder@veqiroai.com",
        "subject": "Interested in Veqiro AI for our 40-person team",
        "snippet": "Hi, I came across your product and I think it could be a great fit for our startup...",
        "body": (
            "Hi,\n\nI came across Veqiro AI through a ProductHunt post and I think it could be a great fit "
            "for our 40-person startup. We're currently spending about $8,000/month on various point solutions "
            "that don't talk to each other.\n\n"
            "Can we schedule a 20-minute demo? I'm particularly interested in the analytics and content features.\n\n"
            "Best,\nMarcus Rivera\nCOO, GrowthCo"
        ),
        "date": "2025-03-27T16:45:00Z",
        "is_read": False,
        "labels": ["INBOX"],
        "priority": "high",
        "suggested_action": "reply",
    },
]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def list_unread(access_token: str, max_results: int = 50) -> list[dict]:
    """List unread emails. In mock mode returns sample unread emails."""
    if settings.MOCK_MODE:
        return _MOCK_EMAILS[:min(max_results, len(_MOCK_EMAILS))]

    import httpx

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        hdrs = _auth(access_token)
        r = await client.get(
            f"{_GMAIL}/messages",
            headers=hdrs,
            params={"labelIds": "UNREAD", "maxResults": max_results},
        )
        r.raise_for_status()
        msg_ids = [m["id"] for m in r.json().get("messages", [])]
        if not msg_ids:
            return []

        responses = await asyncio.gather(*[
            client.get(f"{_GMAIL}/messages/{mid}", headers=hdrs, params={"format": "full"})
            for mid in msg_ids
        ])
        return [_parse_message(resp.json()) for resp in responses if resp.is_success]


async def get_message(access_token: str, msg_id: str) -> dict:
    """Get a specific email message."""
    if settings.MOCK_MODE:
        for email in _MOCK_EMAILS:
            if email["id"] == msg_id:
                return email
        return _MOCK_EMAILS[0]

    import httpx

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(
            f"{_GMAIL}/messages/{msg_id}",
            headers=_auth(access_token),
            params={"format": "full"},
        )
        r.raise_for_status()
        return _parse_message(r.json())


async def label_message(access_token: str, msg_id: str, label_id: str) -> bool:
    """Apply a label to a message. Returns True on success."""
    if settings.MOCK_MODE:
        return True

    import httpx

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(
            f"{_GMAIL}/messages/{msg_id}/modify",
            headers=_auth(access_token),
            json={"addLabelIds": [label_id]},
        )
        return r.is_success


async def list_labels(access_token: str) -> list[dict]:
    """List all Gmail labels."""
    if settings.MOCK_MODE:
        return []

    import httpx

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(f"{_GMAIL}/labels", headers=_auth(access_token))
        r.raise_for_status()
        return r.json().get("labels", [])


async def create_label(access_token: str, label_name: str) -> str:
    """Create a Gmail label. Returns label_id."""
    if settings.MOCK_MODE:
        return f"label_{label_name.lower().replace(' ', '_')}_mock"

    import httpx

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(
            f"{_GMAIL}/labels",
            headers=_auth(access_token),
            json={
                "name": label_name,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show",
            },
        )
        r.raise_for_status()
        return r.json()["id"]


async def create_draft(
    access_token: str,
    to: str,
    subject: str,
    body: str,
    reply_to_id: str | None = None,
) -> str:
    """Create an email draft. Returns draft_id."""
    if settings.MOCK_MODE:
        return f"draft_{str(id(body))[:8]}_mock"

    import httpx

    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    draft_body: dict = {"message": {"raw": raw}}
    if reply_to_id:
        draft_body["message"]["threadId"] = reply_to_id

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(
            f"{_GMAIL}/drafts",
            headers=_auth(access_token),
            json=draft_body,
        )
        r.raise_for_status()
        return r.json()["id"]


def _extract_body(payload: dict) -> str:
    """Recursively extract plaintext body from Gmail payload."""
    mime_type = payload.get("mimeType", "")
    body = payload.get("body", {})
    data = body.get("data", "")

    if data and mime_type in ("text/plain", "text/html"):
        try:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
        except Exception:
            return ""

    for part in payload.get("parts", []):
        text = _extract_body(part)
        if text:
            return text
    return ""


def _parse_message(msg_data: dict) -> dict:
    """Parse Gmail API message into simplified dict."""
    headers = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
    body = _extract_body(msg_data.get("payload", {}))
    from_header = headers.get("From", "")
    from_name = from_header.split("<")[0].strip().strip('"') if "<" in from_header else from_header
    match = re.search(r"<([^>]+)>", from_header)
    from_email = match.group(1) if match else from_header
    return {
        "id": msg_data.get("id", ""),
        "thread_id": msg_data.get("threadId", ""),
        "from": from_header,
        "from_name": from_name,
        "from_email": from_email,
        "to": headers.get("To", ""),
        "subject": headers.get("Subject", ""),
        "body": body or msg_data.get("snippet", ""),
        "snippet": msg_data.get("snippet", ""),
        "date": headers.get("Date", ""),
        "is_read": "UNREAD" not in msg_data.get("labelIds", []),
        "labels": msg_data.get("labelIds", []),
        "priority": "medium",
        "suggested_action": "review",
    }
