import { assert, describe, test } from "vitest";
import {
  getQuotaForMayaEntitlement,
  CREDITS_PER_IMAGE,
  CREDITS_PER_VIDEO_SECOND,
  imageCreditsFor,
  videoCreditsFor,
  isAllowedTopupDollars,
  ALLOWED_TOPUP_DOLLARS,
} from "../../modules/agents/maya/maya.quotas.js";

describe("getQuotaForMayaEntitlement", () => {
  test("trial → 30", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "TRIAL" }), 30);
  });

  test("individually purchased Maya → 300", () => {
    assert.equal(getQuotaForMayaEntitlement({ source: "AGENT" }), 300);
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

describe("isAllowedTopupDollars", () => {
  test("accepts every preset", () => {
    for (const dollars of ALLOWED_TOPUP_DOLLARS) {
      assert.ok(isAllowedTopupDollars(dollars), `$${dollars} should be allowed`);
    }
  });

  test("rejects a valid multiple of $3 that isn't a preset", () => {
    assert.equal(isAllowedTopupDollars(18), false);
    assert.equal(isAllowedTopupDollars(300), false);
  });

  test("rejects non-multiples and invalid amounts", () => {
    assert.equal(isAllowedTopupDollars(2), false);
    assert.equal(isAllowedTopupDollars(5), false);
    assert.equal(isAllowedTopupDollars(0), false);
    assert.equal(isAllowedTopupDollars(-3), false);
  });
});
