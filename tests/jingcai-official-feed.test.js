import test from "node:test";
import assert from "node:assert/strict";
import {
  findJingcaiOfficialMatch,
  getJingcaiOfficialFeed,
  getPlayMarketOdds,
} from "../providers/jingcai/official-feed.js";

test("jingcai official feed is fixture-backed but contract-validated", () => {
  const feed = getJingcaiOfficialFeed();

  assert.ok(Array.isArray(feed));
  assert.ok(feed.length > 0);

  const argentina = findJingcaiOfficialMatch(feed, 10);
  assert.ok(argentina);
  assert.equal(argentina.saleStatus, "on_sale");
  assert.equal(getPlayMarketOdds(argentina, "胜平负").odds["3"], 1.95);
  assert.equal(getPlayMarketOdds(argentina, "让球胜平负").handicap, -1);
});
