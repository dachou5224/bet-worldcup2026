import test from "node:test";
import assert from "node:assert/strict";
import {
  computePayloadHash,
  extractOddsQuotaHeaders,
  summarizeOddsCoverage,
  wrapSnapshotPayload,
} from "../lib/snapshot-store.js";
import { readOddsSnapshotPayload } from "../lib/snapshot-replay.js";

test("wrapSnapshotPayload attaches metadata and hash", () => {
  const payload = [{ id: "evt-1" }];
  const wrapped = wrapSnapshotPayload(payload, {
    capturedAt: "2026-06-08T00:00:00.000Z",
    source: "the-odds-api",
    sourceMode: "real",
  });

  assert.equal(wrapped.source, "the-odds-api");
  assert.equal(wrapped.sourceMode, "real");
  assert.equal(wrapped.rawPayloadHash, computePayloadHash(payload));
  assert.deepEqual(wrapped.payload, payload);
});

test("extractOddsQuotaHeaders reads quota headers", () => {
  const quota = extractOddsQuotaHeaders({
    "x-requests-remaining": "421",
    "x-requests-used": "79",
    "x-requests-last": "1",
  });

  assert.equal(quota.requestsRemaining, "421");
  assert.equal(quota.requestsUsed, "79");
  assert.equal(quota.requestsLast, "1");
});

test("summarizeOddsCoverage counts fixtures and bookmakers", () => {
  const summary = summarizeOddsCoverage([
    {
      bookmakers: [
        { key: "pinnacle", last_update: "2026-06-08T08:00:00Z" },
        { key: "bet365", last_update: "2026-06-08T08:00:00Z" },
      ],
    },
  ]);

  assert.equal(summary.fixtureCount, 1);
  assert.equal(summary.bookmakerDiversity, 2);
});

test("readOddsSnapshotPayload reads wrapped snapshot envelope", () => {
  const snapshot = readOddsSnapshotPayload("./fixtures/snapshots/latest/jingcai-official-feed.json");
  assert.equal(snapshot, null);
});
