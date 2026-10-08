import { describe, it, assert, beforeEach } from "vitest";
import { seal, open, signState, verifyState, SecretBoxError, secretsConfigured } from "./secretBox.js";

beforeEach(() => {
  process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("seal/open", () => {
  it("round-trips and never repeats ciphertext", () => {
    const a = seal("pat-na1-secret");
    const b = seal("pat-na1-secret");
    assert.notEqual(a, b);
    assert.match(a, /^v1:/);
    assert.equal(open(a), "pat-na1-secret");
  });

  it("detects tampering", () => {
    const parts = seal("x").split(":");
    parts[3] = Buffer.from("zz").toString("base64");
    assert.throws(() => open(parts.join(":")), SecretBoxError);
  });

  it("rejects values it did not produce", () => {
    assert.throws(() => open("plain-text"), SecretBoxError);
    assert.throws(() => open("v9:a:b:c"), SecretBoxError);
  });

  it("refuses to work without a valid key", () => {
    process.env.INTEGRATION_SECRET_KEY = "short";
    assert.equal(secretsConfigured(), false);
    assert.throws(() => seal("x"), /INTEGRATION_SECRET_KEY/);
    delete process.env.INTEGRATION_SECRET_KEY;
    assert.equal(secretsConfigured(), false);
  });

  it("cannot open a value sealed with another key", () => {
    const sealed = seal("secret");
    process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 9).toString("base64");
    assert.throws(() => open(sealed), SecretBoxError);
  });
});

describe("signState/verifyState", () => {
  it("accepts a fresh state", () => {
    const t = signState({ org: "o1" }, 60_000);
    assert.equal(verifyState<{ org: string }>(t).org, "o1");
  });

  it("rejects tampered, expired and foreign states", () => {
    const t = signState({ org: "o1" }, 60_000);
    assert.throws(() => verifyState(t.slice(0, -2) + "xx"), SecretBoxError);
    assert.throws(() => verifyState(signState({ org: "o1" }, -1)), /expired/);
    assert.throws(() => verifyState("not-a-state"), SecretBoxError);
    assert.throws(() => verifyState(""), SecretBoxError);
  });

  it("gives each state a unique nonce so a state cannot be guessed from another", () => {
    assert.notEqual(signState({ a: 1 }, 1000), signState({ a: 1 }, 1000));
  });
});
