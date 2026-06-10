export function resolveJingcaiOfficialFeedMode(config = {}) {
  const explicit = config.jingcaiOfficialFeedMode ?? process.env.JINGCAI_OFFICIAL_FEED_MODE;
  if (explicit && explicit !== "auto") {
    return explicit;
  }

  const marketDataMode = config.marketDataMode ?? process.env.MARKET_DATA_MODE ?? "real";
  const liveDataMode = config.liveDataMode ?? process.env.LIVE_DATA_MODE ?? "real";

  if (marketDataMode === "replay" || liveDataMode === "replay") {
    return "file";
  }

  return "webapi";
}

export function isJingcaiRealFeedMode(mode) {
  const normalized = String(mode || "").toLowerCase();
  return normalized === "real" || normalized === "webapi";
}
