/**
 * 验收竞彩 webapi live 接入：拉体彩网关、校验 feed、确认 researchSafe 语义。
 *
 * npm run qa:jingcai-webapi
 */
import assert from "node:assert/strict";
import { loadLocalEnv } from "../lib/load-env.js";
import { getProviderConfig } from "../provider-config.js";
import { resolveJingcaiOfficialFeedMode } from "../lib/jingcai-feed-mode.js";
import { loadJingcaiOfficialFeedBundle } from "../lib/jingcai-official-feed-service.js";
import { deriveResearchSafetyState } from "../data-hub.js";
import { validateJingcaiOfficialFeed } from "../schemas/jingcai-official-feed.js";

loadLocalEnv();

async function run() {
  const previousMode = process.env.JINGCAI_OFFICIAL_FEED_MODE;
  process.env.JINGCAI_OFFICIAL_FEED_MODE = "webapi";

  try {
    const config = getProviderConfig();
    assert.equal(resolveJingcaiOfficialFeedMode(config), "webapi");

    const loaded = await loadJingcaiOfficialFeedBundle({
      ...config,
      jingcaiOfficialFeedMode: "webapi",
      providerCacheEnabled: false,
    });

    assert.ok(Array.isArray(loaded.feed));
    assert.ok(loaded.feed.length > 0, "webapi 应返回至少 1 场在售比赛");
    assert.equal(loaded.loadMeta?.effectiveMode, "webapi");
    assert.equal(loaded.loadMeta?.fallbackUsed, false);

    const validation = validateJingcaiOfficialFeed(loaded.feed);
    assert.equal(validation.ok, true, validation.errors?.join("; "));

    const researchState = deriveResearchSafetyState(
      {
        appMode: "research",
        marketDataMode: "real",
        jingcaiOfficialFeedMode: "webapi",
        jingcaiFallbackUsed: false,
      },
      "real",
    );
    assert.equal(researchState.fallbackUsed.jingcai, false);
    assert.ok(!researchState.researchSafeBlockReasons.includes("jingcai_not_real"));

    console.log(
      JSON.stringify(
        {
          ok: true,
          matchCount: loaded.feed.length,
          capturedAt: loaded.envelope?.capturedAt || loaded.loadMeta?.capturedAt,
          source: loaded.envelope?.source,
          sporttery: loaded.envelope?.sporttery || null,
          sample: loaded.feed.slice(0, 3).map((match) => ({
            fixtureId: match.fixtureId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            spf: match.availablePlays?.spf?.odds,
          })),
          researchSafeBlockReasons: researchState.researchSafeBlockReasons,
        },
        null,
        2,
      ),
    );
  } finally {
    if (previousMode == null) {
      delete process.env.JINGCAI_OFFICIAL_FEED_MODE;
    } else {
      process.env.JINGCAI_OFFICIAL_FEED_MODE = previousMode;
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
