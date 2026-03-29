"""Gmail API utilities. In mock mode returns realistic mock email data."""
from core.config import settings

_MOCK_EMAILS = [
    {
        "id": "msg_001",
        "thread_id": "thread_001",
        "from": "sarah.chen@accelpartners.com",
        "from_name": "Sarah Chen",
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


async def list_unread(access_token: str, max_results: int = 50) -> list[dict]:
    """List unread emails. In mock mode returns sample unread emails."""
    if settings.MOCK_MODE:
        return _MOCK_EMAILS[:min(max_results, len(_MOCK_EMAILS))]

    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    import asyncio

    def _fetch():
        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)
        results = service.users().messages().list(
            userId="me", labelIds=["UNREAD"], maxResults=max_results
        ).execute()
        messages = []
        for msg in results.get("messages", []):
            msg_data = service.users().messages().get(userId="me", id=msg["id"], format="full").execute()
            messages.append(_parse_message(msg_data))
        return messages

    return await asyncio.to_thread(_fetch)


async def get_message(access_token: str, msg_id: str) -> dict:
    """Get a specific email message."""
    if settings.MOCK_MODE:
        for email in _MOCK_EMAILS:
            if email["id"] == msg_id:
                return email
        return _MOCK_EMAILS[0]

    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    import asyncio

    def _fetch():
        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)
        msg_data = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
        return _parse_message(msg_data)

    return await asyncio.to_thread(_fetch)


async def label_message(access_token: str, msg_id: str, label_id: str) -> bool:
    """Apply a label to a message. Returns True on success."""
    if settings.MOCK_MODE:
        return True

    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    import asyncio

    def _apply():
        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)
        service.users().messages().modify(
            userId="me", id=msg_id, body={"addLabelIds": [label_id]}
        ).execute()
        return True

    return await asyncio.to_thread(_apply)


async def create_label(access_token: str, label_name: str) -> str:
    """Create a Gmail label. Returns label_id."""
    if settings.MOCK_MODE:
        return f"label_{label_name.lower().replace(' ', '_')}_mock"

    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    import asyncio

    def _create():
        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)
        result = service.users().labels().create(
            userId="me", body={"name": label_name, "labelListVisibility": "labelShow", "messageListVisibility": "show"}
        ).execute()
        return result["id"]

    return await asyncio.to_thread(_create)


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

    import base64
    from email.mime.text import MIMEText
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    import asyncio

    def _create():
        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)
        message = MIMEText(body)
        message["to"] = to
        message["subject"] = subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        draft_body = {"message": {"raw": raw}}
        if reply_to_id:
            draft_body["message"]["threadId"] = reply_to_id
        result = service.users().drafts().create(userId="me", body=draft_body).execute()
        return result["id"]

    return await asyncio.to_thread(_create)


def _parse_message(msg_data: dict) -> dict:
    """Parse Gmail API message into simplified dict."""
    headers = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
    return {
        "id": msg_data.get("id", ""),
        "thread_id": msg_data.get("threadId", ""),
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "subject": headers.get("Subject", ""),
        "snippet": msg_data.get("snippet", ""),
        "date": headers.get("Date", ""),
        "is_read": "UNREAD" not in msg_data.get("labelIds", []),
        "labels": msg_data.get("labelIds", []),
        "priority": "medium",
        "suggested_action": "review",
    }
