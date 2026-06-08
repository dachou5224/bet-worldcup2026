import test from "node:test";
import assert from "node:assert/strict";
import {
  findJingcaiOfficialMatch,
  getJingcaiOfficialFeed,
  getPlayMarketOdds,
  loadJingcaiOfficialFeed,
} from "../providers/jingcai/official-feed.js";

test("jingcai official feed is fixture-backed but contract-validated", async () => {
  const feed = await getJingcaiOfficialFeed();

  assert.ok(Array.isArray(feed));
  assert.ok(feed.length > 0);

  const argentina = findJingcaiOfficialMatch(feed, 10);
  assert.ok(argentina);
  assert.equal(argentina.saleStatus, "on_sale");
  assert.equal(getPlayMarketOdds(argentina, "胜平负").odds["3"], 1.95);
  assert.equal(getPlayMarketOdds(argentina, "让球胜平负").handicap, -1);
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
