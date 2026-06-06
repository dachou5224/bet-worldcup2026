import assert from "node:assert/strict";
import { getMarketDataBundle, getStaticPageData } from "../data-sources.js";

function setEnv(overrides) {
  const previous = {};

  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

async function run() {
  const restore = setEnv({
    APP_MODE: "demo",
    MARKET_DATA_MODE: "real",
    LIVE_DATA_MODE: "real",
    ODDS_API_KEY: "",
    POLYMARKET_PUBLIC_ENABLED: "false",
    FOOTBALL_DATA_API_KEY: "",
    SPORTMONKS_API_TOKEN: "",
  });

  try {
    const demoMarket = await getMarketDataBundle();
    assert.equal(demoMarket.mode, "real_fallback_mock");

    const demoLive = await getStaticPageData();
    assert.equal(demoLive.liveMode, "real_unconfigured_fallback_mock");

    process.env.APP_MODE = "research";

    await assert.rejects(
      () => getMarketDataBundle(),
      /真实市场模式未配置任何可用 provider/,
    );

    await assert.rejects(
      () => getStaticPageData(),
      /research 模式下 live provider 未配置|research 模式下 live provider 请求失败/,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: [
            "demo mode falls back to mock when real market providers are unavailable",
            "demo mode falls back to mock when live providers are unavailable",
            "research mode fails fast instead of falling back for market data",
            "research mode fails fast instead of falling back for live data",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    restore();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
