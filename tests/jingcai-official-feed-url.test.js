import test from "node:test";
import assert from "node:assert/strict";
import { loadJingcaiOfficialFeed } from "../providers/jingcai/official-feed.js";

test("jingcai official feed can load from a real-mode URL mirror", async () => {
  const payload = [
    {
      jingcaiMatchId: "JC-TEST-001",
      fixtureId: 99,
      competition: "2026 FIFA World Cup",
      stage: "小组赛第1轮",
      homeTeam: "测试主队",
      awayTeam: "测试客队",
      kickoffLocal: "2026-06-11T20:00:00-05:00",
      saleStatus: "on_sale",
      stopSaleTime: "2026-06-11T19:55:00-05:00",
      availablePlays: {
        spf: { onSale: true, odds: { "3": 2.1, "1": 3.2, "0": 3.6 } },
        rqspf: { onSale: true, handicap: -1, odds: { "3": 4.2, "1": 3.6, "0": 1.72 } },
        zjq: { onSale: false, odds: {} },
        bf: { onSale: false, odds: {} },
        bqc: { onSale: false, odds: {} },
      },
      ruleVersion: "2026-jczq-football",
      fetchedAt: "2026-06-06T12:00:00+08:00",
    },
  ];

  const feedUrl = `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`;

  const loaded = await loadJingcaiOfficialFeed({
    mode: "real",
    feedUrl,
  });

  assert.equal(loaded.mode, "real");
  assert.equal(loaded.sourceType, "url");
  assert.equal(loaded.feedUrl, feedUrl);
  assert.equal(loaded.feed.length, 1);
  assert.equal(loaded.feed[0].fixtureId, 99);
  assert.equal(loaded.feed[0].saleStatus, "on_sale");
});
