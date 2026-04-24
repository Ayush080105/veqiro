"""Google Calendar API utilities. In mock mode returns realistic mock calendar data."""
from core.config import settings

_MOCK_EVENTS = [
    {
        "id": "event_001",
        "title": "Team Standup",
        "description": "Daily team sync – product updates, blockers, priorities",
        "start": "2025-03-31T09:00:00Z",
        "end": "2025-03-31T09:30:00Z",
        "attendees": ["founder@veqiroai.com", "cto@veqiroai.com", "design@veqiroai.com"],
        "location": "Google Meet",
        "meet_link": "https://meet.google.com/abc-defg-hij",
        "status": "confirmed",
        "recurring": True,
    },
    {
        "id": "event_002",
        "title": "Investor Call – Accel Partners (Sarah Chen)",
        "description": "Seed round deep dive – technical and market diligence",
        "start": "2025-04-03T15:00:00Z",
        "end": "2025-04-03T15:45:00Z",
        "attendees": ["founder@veqiroai.com", "sarah.chen@accelpartners.com"],
        "location": "Zoom",
        "meet_link": "https://zoom.us/j/123456789",
        "status": "confirmed",
        "recurring": False,
    },
]

_MOCK_FREE_SLOTS = [
    {"date": "2025-04-01", "start": "10:00", "end": "12:00", "duration_hours": 2},
    {"date": "2025-04-01", "start": "14:00", "end": "17:00", "duration_hours": 3},
    {"date": "2025-04-02", "start": "09:00", "end": "11:30", "duration_hours": 2.5},
    {"date": "2025-04-02", "start": "13:00", "end": "16:00", "duration_hours": 3},
    {"date": "2025-04-03", "start": "09:00", "end": "14:30", "duration_hours": 5.5},
]


async def list_events(access_token: str, days_ahead: int = 7) -> list[dict]:
    """List calendar events for the next N days. In mock mode returns sample meetings."""
    if settings.MOCK_MODE:
        return _MOCK_EVENTS

    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    from datetime import datetime, timedelta, timezone
    import asyncio

    def _fetch():
        creds = Credentials(token=access_token)
        service = build("calendar", "v3", credentials=creds)
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=days_ahead)
        results = service.events().list(
            calendarId="primary",
            timeMin=now.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        events = []
        for e in results.get("items", []):
            events.append({
                "id": e.get("id", ""),
                "title": e.get("summary", ""),
                "description": e.get("description", ""),
                "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")),
                "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", "")),
                "attendees": [a.get("email", "") for a in e.get("attendees", [])],
                "location": e.get("location", ""),
                "status": e.get("status", ""),
            })
        return events

    return await asyncio.to_thread(_fetch)


async def create_event(access_token: str, event_data: dict) -> dict:
    """Create a calendar event. Returns created event dict."""
    if settings.MOCK_MODE:
        return {
            "id": f"event_{str(id(event_data))[:6]}_mock",
            "title": event_data.get("title", "New Event"),
            "start": event_data.get("start", "2025-04-01T10:00:00Z"),
            "end": event_data.get("end", "2025-04-01T11:00:00Z"),
            "attendees": event_data.get("attendees", []),
            "meet_link": "https://meet.google.com/mock-link",
            "status": "confirmed",
            "created": True,
        }

    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    import asyncio

    def _create():
        creds = Credentials(token=access_token)
        service = build("calendar", "v3", credentials=creds)
        event_body = {
            "summary": event_data.get("title", ""),
            "description": event_data.get("description", ""),
            "start": {"dateTime": event_data.get("start", ""), "timeZone": "UTC"},
            "end": {"dateTime": event_data.get("end", ""), "timeZone": "UTC"},
            "attendees": [{"email": a} for a in event_data.get("attendees", [])],
            "conferenceData": {"createRequest": {"requestId": f"conf_{id(event_data)}"}},
        }
        result = service.events().insert(
            calendarId="primary", body=event_body, conferenceDataVersion=1
        ).execute()
        return {
            "id": result.get("id", ""),
            "title": result.get("summary", ""),
            "start": result.get("start", {}).get("dateTime", ""),
            "end": result.get("end", {}).get("dateTime", ""),
            "meet_link": result.get("conferenceData", {}).get("entryPoints", [{}])[0].get("uri", ""),
            "status": result.get("status", "confirmed"),
            "created": True,
        }

    return await asyncio.to_thread(_create)


async def find_free_slots(access_token: str, date_range: dict) -> list[dict]:
    """Find available time slots in the given date range. In mock mode returns sample free slots."""
    if settings.MOCK_MODE:
        return _MOCK_FREE_SLOTS

    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    from datetime import datetime, timedelta, timezone
    import asyncio

    now = datetime.now(timezone.utc)
    start_dt = datetime.fromisoformat(date_range.get("start", now.isoformat()))
    end_dt = datetime.fromisoformat(date_range.get("end", (now + timedelta(days=7)).isoformat()))

    def _find():
        creds = Credentials(token=access_token)
        service = build("calendar", "v3", credentials=creds)
        body = {
            "timeMin": start_dt.isoformat(),
            "timeMax": end_dt.isoformat(),
            "items": [{"id": "primary"}],
        }
        result = service.freebusy().query(body=body).execute()
        busy = result.get("calendars", {}).get("primary", {}).get("busy", [])

        free_slots = []
        current = start_dt.replace(hour=9, minute=0, second=0, microsecond=0)
        while current.date() < end_dt.date():
            day_start = current
            day_end = current.replace(hour=18, minute=0)
            slot_start = day_start

            day_busy = [b for b in busy if b["start"][:10] == current.strftime("%Y-%m-%d")]
            day_busy.sort(key=lambda x: x["start"])

            for b in day_busy:
                b_start = datetime.fromisoformat(b["start"].replace("Z", "+00:00"))
                b_end = datetime.fromisoformat(b["end"].replace("Z", "+00:00"))
                if slot_start < b_start:
                    duration = (b_start - slot_start).total_seconds() / 3600
                    if duration >= 0.5:
                        free_slots.append({
                            "date": current.strftime("%Y-%m-%d"),
                            "start": slot_start.strftime("%H:%M"),
                            "end": b_start.strftime("%H:%M"),
                            "duration_hours": round(duration, 1),
                        })
                slot_start = max(slot_start, b_end)

            if slot_start < day_end:
                duration = (day_end - slot_start).total_seconds() / 3600
                if duration >= 0.5:
                    free_slots.append({
                        "date": current.strftime("%Y-%m-%d"),
                        "start": slot_start.strftime("%H:%M"),
                        "end": "18:00",
                        "duration_hours": round(duration, 1),
                    })
            current += timedelta(days=1)
        return free_slots

    return await asyncio.to_thread(_find)
