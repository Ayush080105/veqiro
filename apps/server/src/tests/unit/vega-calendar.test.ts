import { assert, describe, test, vi } from "vitest";
import {
  isDisplayableCalendarEvent,
  listCalendarEvents,
  type GoogleCalendarEvent,
} from "../../common/utils/googleApis.js";

describe("Vega calendar event filtering", () => {
  test("hides Google working location status events", () => {
    const event: GoogleCalendarEvent = {
      id: "working-location-1",
      summary: "Home",
      eventType: "workingLocation",
      start: { date: "2026-06-17" },
      end: { date: "2026-06-18" },
    };

    assert.equal(isDisplayableCalendarEvent(event), false);
  });

  test("keeps regular and legacy all-day events", () => {
    assert.equal(
      isDisplayableCalendarEvent({
        id: "all-day-1",
        summary: "Company offsite",
        eventType: "default",
        start: { date: "2026-06-17" },
        end: { date: "2026-06-18" },
      }),
      true
    );
    assert.equal(
      isDisplayableCalendarEvent({
        id: "all-day-2",
        summary: "Birthday",
        start: { date: "2026-06-17" },
        end: { date: "2026-06-18" },
      }),
      true
    );
  });

  test("requests only display-worthy Google Calendar event types", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listCalendarEvents({
      accessToken: "token",
      timeMin: "2026-06-17T00:00:00.000Z",
      timeMax: "2026-06-18T00:00:00.000Z",
      timeZone: "Asia/Calcutta",
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    assert.deepEqual(url.searchParams.getAll("eventTypes"), [
      "default",
      "birthday",
      "fromGmail",
    ]);
    assert.equal(url.searchParams.getAll("eventTypes").includes("workingLocation"), false);

    vi.unstubAllGlobals();
  });
});
