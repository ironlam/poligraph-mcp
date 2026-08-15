import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { ApiError, fetchAPI } from "../api.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchAPI parses a bounded JSON response", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const result = await fetchAPI<{ ok: boolean }>("/api/test");
  assert.deepEqual(result, { ok: true });
});

test("fetchAPI never reflects an arbitrary upstream HTML error body", async () => {
  globalThis.fetch = async () =>
    new Response("<html>private proxy diagnostics</html>", { status: 502 });

  await assert.rejects(
    () => fetchAPI("/api/test"),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 502);
      assert.doesNotMatch(error.message, /private proxy diagnostics/);
      assert.match(error.message, /API publique Poligraph/);
      return true;
    },
  );
});

test("fetchAPI rejects invalid JSON instead of returning partial data", async () => {
  globalThis.fetch = async () => new Response("not-json", { status: 200 });

  await assert.rejects(
    () => fetchAPI("/api/test"),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 502);
      assert.match(error.message, /JSON invalide/);
      return true;
    },
  );
});

test("fetchAPI rejects oversized upstream responses", async () => {
  globalThis.fetch = async () =>
    new Response("x".repeat(2_000_001), { status: 200 });

  await assert.rejects(
    () => fetchAPI("/api/test"),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 502);
      assert.match(error.message, /trop volumineuse/);
      return true;
    },
  );
});
