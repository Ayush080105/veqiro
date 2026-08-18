import { describe, it, assert } from "vitest";

import {
  DATE_RANGE_CHOICES,
  WIDGET_CATALOG,
  dateRangeLabel,
  evaluateWidget,
  resolveArgs,
  resolveInputArgs,
  widgetById,
  widgetsForIntegration,
} from "./mcp.widgets.js";

// Payloads copied from real live responses (see the probes used to define these
// widgets), so a provider-shape assumption breaking shows up as a test failure
// rather than a silently empty dashboard tile.
const gmailUnread = {
  data: {
    messages: [
      {
        subject: "Security alert",
        sender: "Google <no-reply@accounts.google.com>",
        messageTimestamp: "2026-08-18T13:02:32Z",
        display_url: "https://mail.google.com/mail/u/0/#inbox/1a01",
      },
    ],
  },
};

const gmailLabel = {
  data: { id: "INBOX", messagesTotal: 348, messagesUnread: 273, name: "INBOX" },
};

const calendar = {
  data: {
    event_data: {
      event_data: [
        {
          summary: "Deal Finalization",
          description: "Deal Finalization",
          start: { dateTime: "2026-08-20T21:00:00+05:30" },
          htmlLink: "https://www.google.com/calendar/event?eid=abc",
        },
      ],
    },
  },
};

const searchConsole = {
  data: {
    rows: [
      { keys: ["veqiro"], clicks: 10, impressions: 14, ctr: 0.714, position: 1 },
      { keys: ["marblism vs sintra ai"], clicks: 1, impressions: 23, ctr: 0.043, position: 11.8 },
    ],
  },
};

describe("widget catalog integrity", () => {
  it("gives every widget the config its kind requires", () => {
    for (const widget of WIDGET_CATALOG) {
      if (widget.kind === "metric") {
        assert.ok(widget.metric, `${widget.id} is a metric widget with no metric config`);
      } else {
        assert.ok(widget.list, `${widget.id} is a list widget with no list config`);
        assert.ok(widget.list!.title, `${widget.id} has no title field`);
      }
    }
  });

  it("uses unique ids", () => {
    const ids = WIDGET_CATALOG.map((w) => w.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("never stores an absolute date, so windows stay rolling", () => {
    // A literal date baked into args would freeze the tile's period forever.
    for (const widget of WIDGET_CATALOG) {
      for (const [key, value] of Object.entries(widget.args ?? {})) {
        if (typeof value !== "string") continue;
        assert.notMatch(value, /^\d{4}-\d{2}-\d{2}/, `${widget.id}.${key} hardcodes a date`);
      }
    }
  });

  it("looks widgets up by id and by integration", () => {
    assert.equal(widgetById("gmail.unread")?.kind, "list");
    assert.ok(widgetsForIntegration("gmail").length >= 2);
    assert.equal(widgetsForIntegration("nonexistent").length, 0);
  });
});

describe("resolveArgs", () => {
  it("expands relative date tokens", () => {
    const out = resolveArgs({ start_date: "@days_ago:28", end_date: "@today", rowLimit: 10 });
    assert.match(String(out.start_date), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(String(out.end_date), /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(String(out.start_date) < String(out.end_date));
    assert.equal(out.rowLimit, 10, "non-token args pass through untouched");
  });

  it("expands @now to a full timestamp", () => {
    const out = resolveArgs({ time_min: "@now" });
    assert.match(String(out.time_min), /^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("date range inputs", () => {
  const clicks = widgetById("google-search-console.clicks")!;

  /** The calendar date N days back, which is what a day-granular API wants. */
  const expectedDate = (daysAgo: number): string =>
    new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

  it("stores a day count and resolves it to a date at call time", () => {
    // Storing a real date would freeze the tile's window at its pin date.
    const args = resolveInputArgs(clicks, { site_url: "https://x.com/", start_date: "7" });
    assert.equal(args.start_date, expectedDate(7));
  });

  it("passes non-range inputs through untouched", () => {
    const args = resolveInputArgs(clicks, { site_url: "https://x.com/", start_date: "28" });
    assert.equal(args.site_url, "https://x.com/");
  });

  it("falls back to 28 days on a nonsense value rather than a broken call", () => {
    const args = resolveInputArgs(clicks, { start_date: "not-a-number" });
    assert.equal(args.start_date, expectedDate(28));
  });

  it("offers every range a readable label", () => {
    for (const choice of DATE_RANGE_CHOICES) {
      assert.equal(dateRangeLabel(choice.value), choice.label);
    }
    assert.equal(dateRangeLabel("45"), "Last 45 days");
  });

  it("keeps the period out of period-scoped widget names", () => {
    // The customer picks the window, so baking "(28 days)" into the name would
    // contradict a tile showing 12 months.
    for (const widget of WIDGET_CATALOG) {
      if (!(widget.inputs ?? []).some((i) => i.kind === "dateRange")) continue;
      assert.notMatch(widget.name, /\d+\s*(day|month)/i, `${widget.id} name hardcodes a period`);
    }
  });
});

describe("evaluateWidget", () => {
  it("maps Gmail unread into displayable rows", () => {
    const result = evaluateWidget(widgetById("gmail.unread")!, gmailUnread);
    assert.equal(result.kind, "list");
    assert.equal(result.rows?.length, 1);
    assert.equal(result.rows![0].title, "Security alert");
    assert.include(result.rows![0].subtitle, "no-reply@accounts.google.com");
    assert.ok(result.rows![0].link);
  });

  it("reads the unread count off the label, not the message list", () => {
    // GMAIL_FETCH_EMAILS's resultSizeEstimate ignores the query (verified
    // live), so this must come from the label's messagesUnread.
    const result = evaluateWidget(widgetById("gmail.unread-count")!, gmailLabel);
    assert.equal(result.display, "273");
  });

  it("unwraps a calendar event's nested start time", () => {
    const result = evaluateWidget(widgetById("google-calendar.upcoming")!, calendar);
    assert.equal(result.rows![0].title, "Deal Finalization");
    assert.equal(result.rows![0].meta, "2026-08-20T21:00:00+05:30");
  });

  it("drops a subtitle that merely repeats the title", () => {
    // Calendar events routinely set description === summary.
    const result = evaluateWidget(widgetById("google-calendar.upcoming")!, calendar);
    assert.equal(result.rows![0].subtitle, undefined);
  });

  it("sums Search Console clicks across query rows", () => {
    const result = evaluateWidget(widgetById("google-search-console.clicks")!, searchConsole);
    assert.equal(result.display, "11");
  });

  it("averages position to one decimal", () => {
    const result = evaluateWidget(widgetById("google-search-console.position")!, searchConsole);
    assert.equal(result.display, "6.4");
  });

  it("flattens single-element dimension arrays into a row title", () => {
    const result = evaluateWidget(widgetById("google-search-console.top-queries")!, searchConsole);
    assert.equal(result.rows![0].title, "veqiro");
    assert.equal(result.rows![0].meta, "10");
  });

  it("returns an empty list rather than failing when there are no rows", () => {
    const result = evaluateWidget(widgetById("google-calendar.upcoming")!, {
      data: { event_data: { event_data: [] } },
    });
    assert.equal(result.kind, "list");
    assert.deepEqual(result.rows, []);
  });

  it("returns no display when a metric's field is absent", () => {
    const result = evaluateWidget(widgetById("gmail.unread-count")!, { data: {} });
    assert.equal(result.display, null);
  });

  it("reaches into Reddit's nested {kind,data} post wrapper", () => {
    // Reddit wraps every post, so row paths are one level deeper than the list.
    const reddit = {
      data: {
        data: {
          children: [
            { kind: "t3", data: { title: "How I bootstrapped", author: "ccasrun", score: 2017 } },
          ],
        },
      },
    };
    const result = evaluateWidget(widgetById("reddit.top-posts")!, reddit);
    assert.equal(result.rows![0].title, "How I bootstrapped");
    assert.equal(result.rows![0].subtitle, "ccasrun");
    assert.equal(result.rows![0].meta, "2,017 pts");
  });

  it("reads Zoom's true total rather than the returned page size", () => {
    const zoom = { data: { meetings: [{ topic: "Standup" }], page_size: 1, total_records: 2 } };
    assert.equal(evaluateWidget(widgetById("zoom.meeting-count")!, zoom).display, "2");
  });

  it("formats Slack member counts with a unit", () => {
    const slack = { data: { channels: [{ name: "all-veqiro", num_members: 2 }] } };
    const result = evaluateWidget(widgetById("slack.channels")!, slack);
    assert.equal(result.rows![0].meta, "2 members");
  });

  it("scales Razorpay paise into rupees on the row and the total", () => {
    const razorpay = {
      data: { items: [{ description: "Pitch", email: "a@b.com", amount: 4900 }] },
    };
    assert.equal(
      evaluateWidget(widgetById("razorpay.recent-payments")!, razorpay).rows![0].meta,
      "₹49",
    );
    assert.equal(evaluateWidget(widgetById("razorpay.revenue")!, razorpay).display, "₹49");
  });

  it("respects each list widget's row limit", () => {
    const many = {
      data: { messages: Array.from({ length: 30 }, (_, i) => ({ subject: `s${i}`, sender: "x" })) },
    };
    const widget = widgetById("gmail.unread")!;
    const result = evaluateWidget(widget, many);
    assert.equal(result.rows?.length, widget.list!.limit);
    assert.equal(result.total, 30, "total reports what was available, not what was shown");
  });
});
