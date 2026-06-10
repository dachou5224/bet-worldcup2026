import test from "node:test";
import assert from "node:assert/strict";
import {
  findJingcaiOfficialMatch,
  getJingcaiOfficialFeed,
  getPlayMarketOdds,
  loadJingcaiOfficialFeed,
} from "../providers/jingcai/official-feed.js";

test("jingcai official feed is contract-validated", async () => {
  const feed = await getJingcaiOfficialFeed();

  assert.ok(Array.isArray(feed));
  assert.ok(feed.length > 0);

  const first = feed[0];
  assert.ok(first);
  assert.equal(typeof first.fixtureId, "number");
  assert.equal(first.saleStatus, "on_sale");
  assert.ok(getPlayMarketOdds(first, "胜平负"));
  assert.ok(getPlayMarketOdds(first, "让球胜平负"));
});

test("jingcai official feed supports wrapped snapshot envelope", async () => {
  const loaded = await loadJingcaiOfficialFeed({
    mode: "file",
    feedFile: "./fixtures/snapshots/latest/jingcai-official-feed.json",
  });

  assert.equal(loaded.sourceType, "file");
  assert.ok(Array.isArray(loaded.feed));
  assert.ok(loaded.feed.length > 0);
  assert.equal(loaded.envelope?.manualReviewed, true);
  assert.equal(typeof loaded.envelope?.source, "string");
});

test("jingcai official feed supports real-mode file mirrors", async () => {
  const loaded = await loadJingcaiOfficialFeed({
    mode: "real",
    feedFile: "./fixtures/jingcai-official-feed.json",
  });

  assert.equal(loaded.mode, "real");
  assert.equal(loaded.sourceType, "file");
  assert.ok(Array.isArray(loaded.feed));
  assert.ok(loaded.feed.length > 0);
});
