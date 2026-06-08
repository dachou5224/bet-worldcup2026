import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

function resolvePath(filePath, baseDir = "fixtures/snapshots") {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  if (filePath.startsWith("./") || filePath.startsWith("../")) {
    return path.resolve(projectRoot, filePath);
  }

  return path.resolve(projectRoot, baseDir, filePath);
}

function readJson(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function readBacktestRunArtifact(backtestRunFile, baseDir = "fixtures/snapshots") {
  const payload = readJson(resolvePath(backtestRunFile, baseDir));
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.backtestRun)) {
    return payload.backtestRun;
  }

  return null;
}

export function readBacktestRunArtifactMeta(backtestRunFile, baseDir = "fixtures/snapshots") {
  const payload = readJson(resolvePath(backtestRunFile, baseDir));
  if (!payload || Array.isArray(payload)) {
    return null;
  }

  const backtestRun = Array.isArray(payload.backtestRun) ? payload.backtestRun : null;
  if (!backtestRun) {
    return null;
  }

  return {
    capturedAt: payload.capturedAt || null,
    sourceMode: payload.sourceMode || null,
    summary: payload.summary || null,
    backtestRun,
  };
}

export function buildBacktestRunFromSettlements(recommendationSettlements, tomorrowPredictions = [], options = {}) {
  const predictionLookup = new Map(
    (tomorrowPredictions || []).map((prediction) => [String(prediction.id ?? prediction.fixtureId), prediction]),
  );

  const settledEntries = (recommendationSettlements || []).filter(
    (entry) => entry?.settlementStatus === "settled" && entry?.settlement,
  );

  const records = settledEntries.map((entry) => {
    const prediction = predictionLookup.get(String(entry.fixtureId)) || null;
    const primaryRecommendation = entry.preMatchSnapshot?.layerC?.primaryRecommendation || null;
    const settlement = entry.settlement || {};

    return {
      fixtureId: entry.fixtureId ?? null,
      fixture: entry.fixture ?? null,
      kickoffLocal: prediction?.kickoff ?? entry.preMatchSnapshot?.kickoff ?? entry.capturedAt ?? null,
      marketType:
        primaryRecommendation?.playType === "让球胜平负"
          ? "spread"
          : primaryRecommendation?.playType === "总进球数"
            ? "total"
            : "h2h",
      line: primaryRecommendation?.handicap ?? null,
      playType: primaryRecommendation?.playType ?? null,
      selection: primaryRecommendation?.selection ?? null,
      selectionCode: primaryRecommendation?.selectionCode ?? null,
      finalScore: settlement.finalScore ?? null,
      actualOutcome: settlement.actualOutcome ?? null,
      modelBeforeKickoff: prediction
        ? {
            home: Number(prediction.modelHome) / 100,
            draw: Number(prediction.modelDraw) / 100,
            away: Number(prediction.modelAway) / 100,
          }
        : null,
      marketClose: settlement.marketClose ?? null,
      officialOddsAtRecommendation: settlement.officialOddsAtRecommendation ?? null,
      officialOddsAtStopSale: settlement.officialOddsAtStopSale ?? null,
      stakeUnits: settlement.stakeUnits ?? 0,
      observation: entry.reviewText ?? null,
      sourceMode: entry.settlementSourceMode || options.sourceMode || "live_derived",
      officialSettlementComplete: Boolean(entry.officialSettlementComplete),
    };
  });

  return {
    capturedAt: options.capturedAt || new Date().toISOString(),
    sourceMode: options.sourceMode || "live_derived",
    backtestRun: records,
    summary: {
      recordCount: records.length,
      liveDerivedCount: settledEntries.filter((entry) => entry.settlementSourceMode === "live_official").length,
      artifactBackedCount: settledEntries.filter((entry) => entry.settlementSourceMode === "artifact").length,
      officialSettlementCompleteCount: settledEntries.filter((entry) => entry.officialSettlementComplete).length,
    },
  };
}

export function writeBacktestRunArtifact(
  backtestRun,
  backtestRunFile,
  baseDir = "fixtures/snapshots",
  metadata = {},
) {
  const filePath = resolvePath(backtestRunFile, baseDir);
  writeJson(filePath, {
    capturedAt: new Date().toISOString(),
    sourceMode: metadata.sourceMode || null,
    summary: metadata.summary || null,
    backtestRun,
  });
  return filePath;
}
