/**
 * Agent A/B 快照契约（Issue #5）。
 * 在现有 wrapSnapshotPayload 结构之上添加 Agent A 消费的别名字段，保持向后兼容。
 */

function normalizeLiveMatches(payload = {}) {
  if (Array.isArray(payload.liveMatches)) {
    return payload.liveMatches;
  }

  if (payload.liveData?.liveMatches) {
    return payload.liveData.liveMatches;
  }

  return [];
}

export function withAbLiveDataEnvelope(snapshot = {}) {
  const liveMatches = normalizeLiveMatches(snapshot.payload || snapshot);
  return {
    ...snapshot,
    liveData: {
      liveMatches,
    },
  };
}

export function withAbOddsRawEnvelope(snapshot = {}, requestMeta = {}) {
  const body = snapshot.body ?? snapshot.payload ?? [];
  return {
    ...snapshot,
    provider: snapshot.provider || "the-odds-api",
    body,
    request: snapshot.request || {
      sportKey: requestMeta.sportKey || null,
      regions: requestMeta.regions || null,
      markets: requestMeta.markets || snapshot.requestedMarkets || ["h2h"],
      commenceTimeFrom: requestMeta.commenceTimeFrom || null,
      commenceTimeTo: requestMeta.commenceTimeTo || null,
    },
    quota: snapshot.quota ?? requestMeta.quota ?? null,
    payload: snapshot.payload ?? body,
  };
}

export function withAbPolymarketRawEnvelope(snapshot = {}) {
  const body = snapshot.body ?? snapshot.payload ?? [];
  return {
    ...snapshot,
    body,
    sentimentOnly: snapshot.sentimentOnly ?? true,
    directEVEligible: snapshot.directEVEligible ?? false,
    payload: snapshot.payload ?? body,
  };
}

export function buildAbProviderStatusEnvelope({
  capturedAt,
  providerStatus = {},
  providerConfig = {},
  liveMode = "error",
  rawProviderMeta = null,
  rawProviderErrors = null,
  pipelineError = null,
  oddsBootstrap = null,
  oddsCoverage = null,
}) {
  const marketMode = providerStatus.marketDataMode || "error";
  const jingcaiMode = providerConfig.jingcaiOfficialFeedMode || providerStatus.jingcaiOfficialFeedMode || "fixture";
  const fallbackUsed = {
    market: String(marketMode).includes("fallback"),
    live: String(liveMode).includes("fallback"),
    jingcai: false,
  };
  fallbackUsed.any = fallbackUsed.market || fallbackUsed.live || fallbackUsed.jingcai;

  return {
    capturedAt,
    sourceMode: {
      market: marketMode,
      live: liveMode,
      jingcai: jingcaiMode,
    },
    fallbackUsed,
    appMode: providerConfig.appMode || providerStatus.appMode || "demo",
    pipelineError,
    providerStatus,
    rawProviderMeta,
    rawProviderErrors,
    oddsBootstrap,
    oddsCoverage,
  };
}

export function validateAbSnapshotContract(snapshotPaths = {}) {
  const issues = [];

  if (snapshotPaths["live-data.json"] === "present") {
    // structural validation happens in qa after read
  } else {
    issues.push("live-data.json 缺失");
  }

  if (snapshotPaths["provider-status.json"] !== "present") {
    issues.push("provider-status.json 缺失");
  }

  if (snapshotPaths["jingcai-official-feed.json"] !== "present") {
    issues.push("jingcai-official-feed.json 缺失");
  }

  if (snapshotPaths["raw/the-odds-api-h2h.json"] !== "present") {
    issues.push("raw/the-odds-api-h2h.json 缺失");
  }

  return issues;
}

export function validateAbLiveDataSnapshot(snapshot) {
  const issues = [];
  if (!snapshot?.capturedAt) {
    issues.push("live-data.capturedAt 缺失");
  }
  if (!snapshot?.sourceMode) {
    issues.push("live-data.sourceMode 缺失");
  }
  if (!Array.isArray(snapshot?.liveData?.liveMatches) && !Array.isArray(snapshot?.payload?.liveMatches)) {
    issues.push("live-data.liveData.liveMatches 或 payload.liveMatches 缺失");
  }
  return issues;
}

export function validateAbProviderStatusSnapshot(snapshot) {
  const issues = [];
  if (!snapshot?.sourceMode?.market) {
    issues.push("provider-status.sourceMode.market 缺失");
  }
  if (!snapshot?.sourceMode?.live) {
    issues.push("provider-status.sourceMode.live 缺失");
  }
  if (!snapshot?.sourceMode?.jingcai) {
    issues.push("provider-status.sourceMode.jingcai 缺失");
  }
  if (!snapshot?.fallbackUsed || typeof snapshot.fallbackUsed.market !== "boolean") {
    issues.push("provider-status.fallbackUsed 缺失或不完整");
  }
  if (typeof snapshot?.fallbackUsed?.any !== "boolean") {
    issues.push("provider-status.fallbackUsed.any 缺失或不是布尔值");
  }
  return issues;
}

export function validateAbOddsRawSnapshot(snapshot) {
  const issues = [];
  if (!Array.isArray(snapshot?.body) && !Array.isArray(snapshot?.payload)) {
    issues.push("raw/the-odds-api-h2h.body 或 payload 缺失");
  }
  if (!snapshot?.request?.markets?.length && !snapshot?.requestedMarkets?.length) {
    issues.push("raw/the-odds-api-h2h.request.markets 缺失");
  }
  return issues;
}
