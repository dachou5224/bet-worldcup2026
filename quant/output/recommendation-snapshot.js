import { buildLayeredOutput } from "./layered-output.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function summarizeSignalCandidate(signalCandidate) {
  if (!signalCandidate) {
    return null;
  }

  return {
    fixtureId: signalCandidate.fixtureId ?? null,
    marketType: signalCandidate.marketType ?? null,
    line: signalCandidate.line ?? null,
    period: signalCandidate.period ?? null,
    outcome: signalCandidate.outcome ?? null,
    offeredOdds: signalCandidate.offeredOdds ?? null,
    marketProbability: isFiniteNumber(signalCandidate.marketProbability) ? round(signalCandidate.marketProbability) : null,
    modelProbability: isFiniteNumber(signalCandidate.modelProbability) ? round(signalCandidate.modelProbability) : null,
    adjustedProbability: isFiniteNumber(signalCandidate.adjustedProbability)
      ? round(signalCandidate.adjustedProbability)
      : null,
    expectedValue: isFiniteNumber(signalCandidate.expectedValue) ? round(signalCandidate.expectedValue) : null,
    rawKelly: isFiniteNumber(signalCandidate.rawKelly) ? round(signalCandidate.rawKelly) : null,
    fractionalKelly: isFiniteNumber(signalCandidate.fractionalKelly) ? round(signalCandidate.fractionalKelly) : null,
    cappedStakeFraction: isFiniteNumber(signalCandidate.cappedStakeFraction)
      ? round(signalCandidate.cappedStakeFraction)
      : null,
    confidence: signalCandidate.confidence ?? null,
    decisionCode: signalCandidate.decisionCode ?? null,
    recommendationLevel: signalCandidate.recommendationLevel ?? null,
    riskTags: Array.isArray(signalCandidate.riskTags) ? [...signalCandidate.riskTags] : [],
    playMappable: Boolean(signalCandidate.playMappable),
    dataOk: Boolean(signalCandidate.dataOk),
    calibrationMode: signalCandidate.marketBaseline?.calibrationMode ?? null,
    calibrationConfidence: signalCandidate.marketBaseline?.calibrationConfidence ?? null,
  };
}

function summarizePrimaryRecommendation(primaryRecommendation) {
  if (!primaryRecommendation) {
    return null;
  }

  return {
    playType: primaryRecommendation.playType ?? null,
    handicap: primaryRecommendation.handicap ?? null,
    selection: primaryRecommendation.selection ?? null,
    selectionCode: primaryRecommendation.selectionCode ?? null,
    officialOdds: primaryRecommendation.officialOdds ?? null,
    fairOddsFromModel: isFiniteNumber(primaryRecommendation.fairOddsFromModel)
      ? round(primaryRecommendation.fairOddsFromModel)
      : null,
    adjustedProbability: isFiniteNumber(primaryRecommendation.adjustedProbability)
      ? round(primaryRecommendation.adjustedProbability)
      : null,
    officialExpectedValue: isFiniteNumber(primaryRecommendation.officialExpectedValue)
      ? round(primaryRecommendation.officialExpectedValue)
      : null,
    recommendationLevel: primaryRecommendation.recommendationLevel ?? null,
    suggestedStakeUnits: primaryRecommendation.suggestedStakeUnits ?? null,
    suggestedStakeAmountCny: primaryRecommendation.suggestedStakeAmountCny ?? null,
    maxStakeUnitsByRisk: primaryRecommendation.maxStakeUnitsByRisk ?? null,
    saleStatus: primaryRecommendation.saleStatus ?? null,
    stopSaleTime: primaryRecommendation.stopSaleTime ?? null,
    mappingConfidence: primaryRecommendation.mappingConfidence ?? null,
  };
}

function summarizeJingcaiRecommendation(jingcaiRecommendation) {
  if (!jingcaiRecommendation) {
    return null;
  }

  return {
    fixtureId: jingcaiRecommendation.fixtureId ?? null,
    jingcaiMatchId: jingcaiRecommendation.jingcaiMatchId ?? null,
    competition: jingcaiRecommendation.competition ?? null,
    homeTeam: jingcaiRecommendation.homeTeam ?? null,
    awayTeam: jingcaiRecommendation.awayTeam ?? null,
    kickoffLocal: jingcaiRecommendation.kickoffLocal ?? null,
    matchLabel: jingcaiRecommendation.matchLabel ?? null,
    noJingcaiReason: jingcaiRecommendation.noJingcaiReason ?? null,
    disclaimers: Array.isArray(jingcaiRecommendation.disclaimers)
      ? [...jingcaiRecommendation.disclaimers]
      : [],
    overseasContext: jingcaiRecommendation.overseasContext
      ? {
          signalMarketType: jingcaiRecommendation.overseasContext.signalMarketType ?? null,
          overseasLine: jingcaiRecommendation.overseasContext.overseasLine ?? null,
          overseasExpectedValue: isFiniteNumber(jingcaiRecommendation.overseasContext.overseasExpectedValue)
            ? round(jingcaiRecommendation.overseasContext.overseasExpectedValue)
            : null,
          recommendationLevel: jingcaiRecommendation.overseasContext.recommendationLevel ?? null,
        }
      : null,
    primaryRecommendation: summarizePrimaryRecommendation(jingcaiRecommendation.primaryRecommendation),
  };
}

export function buildRecommendationSnapshot(prediction, options = {}) {
  const layeredOutput = buildLayeredOutput(prediction);
  const capturedAt = options.capturedAt || new Date().toISOString();
  const sourceModes = options.sourceModes || {};
  const fixtureId = layeredOutput.fixtureId ?? null;

  return {
    snapshotId: `${fixtureId ?? "unknown"}::${capturedAt}`,
    snapshotVersion: 1,
    capturedAt,
    sourceModes,
    fixtureId,
    fixture: layeredOutput.fixture ?? null,
    kickoff: layeredOutput.kickoff ?? null,
    confidence: layeredOutput.confidence ?? null,
    marketSummary: layeredOutput.marketSummary ?? null,
    defaultDisplayLayer: layeredOutput.defaultDisplayLayer ?? null,
    displayLabel: layeredOutput.displayLabel ?? null,
    textSummary: layeredOutput.textSummary ?? null,
    layerA: {
      marketSummary: layeredOutput.layerA?.marketSummary ?? null,
      signalCandidate: summarizeSignalCandidate(layeredOutput.layerA?.signalCandidate || null),
      signalCandidates: Array.isArray(layeredOutput.layerA?.signalCandidates)
        ? layeredOutput.layerA.signalCandidates.map((candidate) => summarizeSignalCandidate(candidate))
        : [],
    },
    layerB: {
      mappingConfidence: layeredOutput.layerB?.mappingConfidence ?? null,
      officialSaleStatus: layeredOutput.layerB?.officialSaleStatus ?? null,
      officialStopTime: layeredOutput.layerB?.officialStopTime ?? null,
      officialOdds: layeredOutput.layerB?.officialOdds ?? null,
      officialExpectedValue: layeredOutput.layerB?.officialExpectedValue ?? null,
      recommendationLevel: layeredOutput.layerB?.recommendationLevel ?? null,
      noJingcaiReason: layeredOutput.layerB?.noJingcaiReason ?? null,
    },
    layerC: summarizeJingcaiRecommendation(layeredOutput.layerC),
  };
}

export function buildRecommendationSnapshotBundle(predictions, options = {}) {
  const snapshots = (predictions || []).map((prediction) => buildRecommendationSnapshot(prediction, options));
  const layerACount = snapshots.filter((snapshot) => Boolean(snapshot.layerA?.signalCandidate)).length;
  const layerBCount = snapshots.filter((snapshot) => Boolean(snapshot.layerB?.mappingConfidence)).length;
  const layerCCount = snapshots.filter((snapshot) => Boolean(snapshot.layerC?.primaryRecommendation)).length;

  return {
    capturedAt: options.capturedAt || new Date().toISOString(),
    snapshotCount: snapshots.length,
    snapshots,
    summary: {
      snapshotCount: snapshots.length,
      layerAReadyCount: layerACount,
      layerBReadyCount: layerBCount,
      layerCReadyCount: layerCCount,
      hasLayerCRecommendation: layerCCount > 0,
    },
  };
}
