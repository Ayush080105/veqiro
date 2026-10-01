import { describe, it, assert } from "vitest";

import { fetchLinkedSheet, resolveShareLink, sniffFormat, LinkNotShared } from "./rex.links.js";
import {
  filterKey,
  makeAliases,
  precomputedStates,
  validateState,
  type FilterDef,
} from "./rex.dashboards.service.js";

describe("resolveShareLink", () => {
  it("exports a whole Google workbook as xlsx from an edit link", () => {
    const r = resolveShareLink("https://docs.google.com/spreadsheets/d/1AbC-d_9/edit?usp=sharing#gid=0");
    assert.equal(r.provider, "google");
    assert.equal(r.downloadUrl, "https://docs.google.com/spreadsheets/d/1AbC-d_9/export?format=xlsx");
  });

  it("handles a Google 'publish to web' link", () => {
    const r = resolveShareLink("https://docs.google.com/spreadsheets/d/e/2PACX-1vQx/pubhtml");
    assert.equal(r.downloadUrl, "https://docs.google.com/spreadsheets/d/e/2PACX-1vQx/pub?output=xlsx");
  });

  it("uses the OneDrive shares API for 1drv.ms links", () => {
    const r = resolveShareLink("https://1drv.ms/x/s!AbcDef");
    assert.equal(r.provider, "onedrive");
    assert.match(r.downloadUrl, /^https:\/\/api\.onedrive\.com\/v1\.0\/shares\/u![\w-]+\/root\/content$/);
  });

  it("forces a download on SharePoint and Dropbox links", () => {
    assert.match(resolveShareLink("https://acme.sharepoint.com/:x:/g/abc?e=1").downloadUrl, /download=1/);
    const d = resolveShareLink("https://www.dropbox.com/scl/fi/abc/sales.xlsx?rlkey=x&dl=0");
    assert.match(d.downloadUrl, /dl=1/);
    assert.notMatch(d.downloadUrl, /dl=0/);
  });

  it("passes a direct file URL through and refuses anything but https", () => {
    assert.equal(resolveShareLink("https://example.com/a.csv").provider, "direct");
    assert.throws(() => resolveShareLink("http://example.com/a.csv"));
    assert.throws(() => resolveShareLink("file:///etc/passwd"));
    assert.throws(() => resolveShareLink("not a url"));
  });
});

describe("sniffFormat", () => {
  it("tells files from web pages", () => {
    assert.equal(sniffFormat(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2])), "xlsx");
    assert.equal(sniffFormat(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1])), "xls");
    assert.equal(sniffFormat(Buffer.from("Date,Amount\n2026-01-01,5\n")), "csv");
    assert.equal(sniffFormat(Buffer.from("  <!DOCTYPE html><html><head>Sign in")), null);
  });
});

describe("fetchLinkedSheet", () => {
  it("refuses hosts that resolve to private addresses", async () => {
    for (const url of ["https://127.0.0.1/a.csv", "https://10.0.0.5/a.csv", "https://[::1]/a.csv", "https://localhost/a.csv"]) {
      let message = "";
      try {
        await fetchLinkedSheet({ provider: "direct", downloadUrl: url });
      } catch (err) {
        message = (err as Error).message;
      }
      assert.match(message, /private network|Couldn't reach/, url);
    }
  });

  it("is a LinkNotShared error class callers can tell apart", () => {
    assert.instanceOf(new LinkNotShared("x"), Error);
  });
});

const FILTERS: FilterDef[] = [
  { id: "region", label: "Region", table: "sales", column: "Region", type: "category", options: ["North", "South"] },
  { id: "when", label: "Date", table: "sales", column: "Order Date", type: "date_range" },
];

describe("filter states", () => {
  it("canonicalises key order and treats no filters as 'all'", () => {
    assert.equal(filterKey({}), "all");
    assert.equal(filterKey({ when: "ytd", region: "North" }), filterKey({ region: "North", when: "ytd" }));
  });

  it("only accepts values the dashboard offers", () => {
    assert.deepEqual(validateState(FILTERS, { region: "North", when: "last_30d" }), { region: "North", when: "last_30d" });
    assert.throws(() => validateState(FILTERS, { region: "x') OR 1=1 --" }));
    assert.throws(() => validateState(FILTERS, { when: "last_1000y" }));
    assert.throws(() => validateState(FILTERS, { nope: "North" }));
  });

  it("precomputes 'all' plus every single filter value", () => {
    const keys = precomputedStates(FILTERS).map((s) => s.key);
    assert.equal(keys[0], "all");
    assert.equal(keys.length, 1 + 2 + 4);
    assert.include(keys, filterKey({ region: "South" }));
  });
});

describe("makeAliases", () => {
  it("gives each dataset a unique SQL-safe table name", () => {
    const a = makeAliases([
      { id: "1", name: "Sales 2026.xlsx" },
      { id: "2", name: "sales-2026" },
      { id: "3", name: "2025 costs" },
      { id: "4", name: "!!!" },
    ]);
    assert.deepEqual(a, { "1": "sales_2026", "2": "sales_2026_2", "3": "t_2025_costs", "4": "data" });
  });
});
