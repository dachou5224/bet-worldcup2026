function normalizeMode(mode) {
  return String(mode || "").toLowerCase();
}

function isRealMarketMode(mode) {
  const normalized = normalizeMode(mode);
  return normalized === "real" || normalized === "real_snapshot_replay";
}

function isRealLiveMode(mode) {
  const normalized = normalizeMode(mode);
  return normalized === "real" || normalized === "real_snapshot_replay";
}

function isRealJingcaiMode(mode) {
  const normalized = normalizeMode(mode);
  return normalized === "real" || normalized === "webapi";
}

function makeTask({
  id,
  owner,
  priority,
  title,
  status = "pending",
  evidence = [],
  acceptance = [],
}) {
  return {
    id,
    owner,
    priority,
    title,
    status,
    evidence,
    acceptance,
  };
}

function buildAgentATasks(report) {
  const tasks = [];
  const sourceMode = report.sourceMode || {};

  tasks.push(
    makeTask({
      id: "A-CONSUME-QUALITY-REPORT",
      owner: "A",
      priority: "P0",
      title: "继续以 quality-report 作为研究启动入口，先检查 researchSafeStatus 和 blockReasons",
      status: "done",
      evidence: ["quality-report 已暴露 researchSafeStatus / researchSafeBlockReasons"],
      acceptance: [
        "A 侧启动前先读取 /api/data/quality-report",
        "researchSafeStatus=full 才允许进入完整 research pipeline",
      ],
    }),
  );

  tasks.push(
    makeTask({
      id: "A-KEEP-LAYER-A-SEMANTICS",
      owner: "A",
      priority: "P0",
      title: "保持 Layer A-lite / Layer A-full 语义不变，不把 fallback 误判成 full research",
      status: report.researchSafeStatus === "full" ? "done" : "active",
      evidence: [`layerAProfileCounts=${JSON.stringify(report.layerAProfileCounts || {})}`],
      acceptance: [
        "blocked / lite / full 三态必须保留",
        "partial_verified_file 只算 partial，不算 full research safe",
      ],
    }),
  );

  tasks.push(
    makeTask({
      id: "A-HIDE-STAKES-BY-DEFAULT",
      owner: "A",
      priority: "P1",
      title: "默认隐藏金额化建议，仅在显式开启 ENABLE_STAKE_SUGGESTION=true 时展示",
      status: "done",
      evidence: ["quant/output/recommendation-snapshot.js 已支持 displaySuggestedStakeUnits"],
      acceptance: [
        "默认输出不显示 'X 注×2 元'",
        "内部 stake 值仍保留给 settlement / backtest",
      ],
    }),
  );

  tasks.push(
    makeTask({
      id: "A-READ-SNAPSHOT-CONTRACT",
      owner: "A",
      priority: "P0",
      title: "A 侧运行时优先消费 B 侧 snapshot 契约，不直接依赖未验证 live provider",
      status: isRealLiveMode(sourceMode.live) ? "active" : "blocked",
      evidence: [
        `sourceMode.live=${sourceMode.live || "unknown"}`,
        `sourceMode.market=${sourceMode.market || "unknown"}`,
      ],
      acceptance: [
        "A 侧 runtime 能识别 latest/live-data.json / provider-status.json / jingcai-official-feed.json",
        "live snapshot replay 与 provider fallback 分层清晰",
      ],
    }),
  );

  return tasks;
}

function buildAgentBTasks(report) {
  const tasks = [];
  const sourceMode = report.sourceMode || {};
  const marketMode = normalizeMode(sourceMode.market);
  const liveMode = normalizeMode(sourceMode.live);
  const jingcaiMode = normalizeMode(sourceMode.jingcai);

  if (!isRealLiveMode(liveMode)) {
    tasks.push(
      makeTask({
        id: "B-LIVE-REAL",
        owner: "B",
        priority: "P0",
        title: "补齐 live-data.json：提供真实 liveMatches 与 sourceMode=real",
        status: "blocked",
        evidence: [`sourceMode.live=${sourceMode.live || "unknown"}`],
        acceptance: [
          "fixtures/snapshots/latest/live-data.json 存在",
          "liveData.liveMatches[] 可被 A 侧直接消费",
          "provider-status.sourceMode.live = real",
        ],
      }),
    );
  }

  if (!isRealMarketMode(marketMode)) {
    tasks.push(
      makeTask({
        id: "B-MARKET-REAL",
        owner: "B",
        priority: "P0",
        title: "补齐海外市场快照：提供 real 或 real_snapshot_replay 的 raw/the-odds-api-h2h.json",
        status: "blocked",
        evidence: [`sourceMode.market=${sourceMode.market || "unknown"}`],
        acceptance: [
          "fixtures/snapshots/latest/raw/the-odds-api-h2h.json 可回放",
          "provider-status.sourceMode.market = real 或 real_snapshot_replay",
          "quality-report.fallbackUsed.market = false",
        ],
      }),
    );
  }

  if (!isRealJingcaiMode(jingcaiMode)) {
    tasks.push(
      makeTask({
        id: "B-JINGCAI-REAL",
        owner: "B",
        priority: "P0",
        title: "补齐竞彩足球官方盘：发布 real 或 verified file 的 jingcai-official-feed.json",
        status: jingcaiMode === "file" ? "done" : "blocked",
        evidence: [`sourceMode.jingcai=${sourceMode.jingcai || "unknown"}`],
        acceptance: [
          "fixtures/snapshots/latest/jingcai-official-feed.json 存在",
          "matches[].fixtureId 可与 odds event.id 对齐",
          "provider-status.sourceMode.jingcai 进入 real 或 file",
        ],
      }),
    );
  }

  tasks.push(
    makeTask({
      id: "B-PROVIDER-STATUS",
      owner: "B",
      priority: "P1",
      title: "保证 provider-status.json 持续输出 sourceMode / fallbackUsed / 兼容字段",
      status: "done",
      evidence: ["lib/snapshot-ab-contract.js 已定义 provider-status 接口"],
      acceptance: [
        "sourceMode.market/live/jingcai 完整",
        "fallbackUsed.market/live/jingcai/any 完整",
        "A 侧无需读取 provider 私有实现细节",
      ],
    }),
  );

  return tasks;
}

function buildInterfaceContract() {
  return {
    requiredSnapshots: [
      {
        file: "fixtures/snapshots/latest/live-data.json",
        requiredFields: ["capturedAt", "sourceMode", "liveData.liveMatches[]"],
      },
      {
        file: "fixtures/snapshots/latest/provider-status.json",
        requiredFields: ["sourceMode.market", "sourceMode.live", "sourceMode.jingcai", "fallbackUsed.any"],
      },
      {
        file: "fixtures/snapshots/latest/jingcai-official-feed.json",
        requiredFields: ["matches[].fixtureId", "sourceMode", "capturedAt"],
      },
      {
        file: "fixtures/snapshots/latest/raw/the-odds-api-h2h.json",
        requiredFields: ["body[]", "request.markets[]", "quota"],
      },
    ],
    aConsumedFields: [
      "quality-report.researchSafeStatus",
      "quality-report.researchSafeBlockReasons",
      "quality-report.marketSourceMode",
      "quality-report.liveSourceMode",
      "quality-report.jingcaiSourceMode",
      "quality-report.layerAReadiness.canEnterLayerA",
      "quality-report.layerAReadiness.canEnterLayerAFull",
      "quality-report.layerAReadiness.layerAProfile",
      "quality-report.layerAReadiness.blockReasons",
      "quality-report.layerAReadiness.fullBlockReasons",
    ],
    bAcceptanceCriteria: [
      "live snapshot 与 provider-status snapshot 语义一致",
      "jingcai-official-feed 具备 fixtureId 对齐能力",
      "odds snapshot 可以被 A 侧回放，不再依赖实时请求",
      "file/fixture 只作为 partial_verified_file，不冒充 full research safe",
    ],
  };
}

export function buildResearchExecutionPlan(report = {}) {
  const sourceMode = report.sourceMode || {
    market: report.marketSourceMode || null,
    live: report.liveSourceMode || null,
    jingcai: report.jingcaiSourceMode || null,
  };

  const layerAProfileCounts = report.layerAProfileCounts || { full: 0, lite: 0, blocked: 0 };
  const summary = {
    researchSafe: Boolean(report.researchSafe),
    researchSafeStatus: report.researchSafeStatus || "blocked",
    sourceMode,
    layerAProfileCounts,
    layerAReadyCount: report.layerAReadyCount || 0,
    recommendationSnapshotCount: report.recommendationSnapshotCount || 0,
    recommendationSettlementCount: report.recommendationSettlementCount || 0,
    postMatchReviewCount: report.postMatchReviewCount || 0,
    backtestSourceMode: report.backtestRunSourceMode || report.backtestSourceMode || null,
    backtestReviewWarning: report.backtestReviewWarning || null,
  };

  const agentA = {
    owner: "A",
    status: report.researchSafe ? "ready" : "hold",
    nextActions: buildAgentATasks(report),
  };

  const agentB = {
    owner: "B",
    status: isRealLiveMode(sourceMode.live) && isRealMarketMode(sourceMode.market) && isRealJingcaiMode(sourceMode.jingcai)
      ? "ready"
      : "needs_input",
    tasks: buildAgentBTasks(report),
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    agentA,
    agentB,
    interfaceContract: buildInterfaceContract(),
  };
}
