import { assert, describe, test } from "vitest";
import {
  getQuotaForMayaEntitlement,
  CREDITS_PER_IMAGE,
  CREDITS_PER_VIDEO_SECOND,
  imageCreditsFor,
  videoCreditsFor,
} from "../../modules/agents/maya/maya.quotas.js";

describe("getQuotaForMayaEntitlement", () => {
  test("trial → 30", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "TRIAL", plan: null }), 30);
  });

  test("individually purchased Maya (monthly) → 300", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "AGENT", plan: "MONTHLY" }), 300);
  });

  test("crew monthly → 300", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "CREW", plan: "MONTHLY" }), 300);
  });

  test("crew annual → 400 (per month, not per year)", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "CREW", plan: "ANNUAL" }), 400);
  });
});

describe("credit conversion is unchanged", () => {
  test("constants hold", () => {
    assert.equal(CREDITS_PER_IMAGE, 2);
    assert.equal(CREDITS_PER_VIDEO_SECOND, 4);
  });

  test("3 images = 6 credits, 10s video = 40 credits", () => {
    assert.equal(imageCreditsFor(3), 6);
    assert.equal(videoCreditsFor(10), 40);
  });
});
