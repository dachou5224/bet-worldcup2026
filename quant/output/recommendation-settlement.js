import { settleJingcaiRecommendation } from "../backtest/jingcai-settlement.js";
import { computeBrier, computeClosingLineValue, computeLogLoss } from "../backtest/metrics.js";
import { buildFixtureKeys } from "../../app/fixture-match.js";
import { getPlayMarketOdds } from "../../providers/jingcai/official-feed.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildRecommendationFixture(record) {
  if (!record) {
    return null;
  }

  return {
    fixtureId: record.fixtureId ?? null,
    fixture: record.fixture ?? null,
    kickoffLocal: record.kickoffLocal ?? null,
    marketType: record.marketType ?? null,
    line: record.line ?? null,
    playType: record.playType ?? null,
    selection: record.selection ?? null,
    selectionCode: record.selectionCode ?? null,
    officialOddsAtRecommendation: record.officialOddsAtRecommendation ?? null,
    officialOddsAtStopSale: record.officialOddsAtStopSale ?? null,
    stakeUnits: record.stakeUnits ?? 0,
    actualOutcome: record.actualOutcome ?? null,
    finalScore: record.finalScore ?? null,
    marketClose: record.marketClose ?? null,
    reviewText: record.observation ?? null,
  };
}

function buildLiveMatchLookup(liveMatches) {
  const lookup = new Map();

  for (const match of liveMatches || []) {
    if (!match || String(match.status || "").toLowerCase() !== "已结束" && String(match.status || "").toLowerCase() !== "finished" && String(match.status || "").toLowerCase() !== "已完赛") {
      continue;
    }

    for (const key of buildFixtureKeys(match.home, match.away)) {
      lookup.set(key, match);
    }
    lookup.set(String(match.id), match);
  }

  return lookup;
}

function findLiveMatchForSnapshot(snapshot, liveMatchLookup) {
  if (!snapshot) {
    return null;
  }

  const directIdHit = liveMatchLookup.get(String(snapshot.fixtureId)) || null;
  if (directIdHit) {
    return directIdHit;
  }

  const directFixtureHit =
    liveMatchLookup.get(snapshot.fixture) || liveMatchLookup.get(String(snapshot.fixture || "").toLowerCase()) || null;
  if (directFixtureHit) {
    return directFixtureHit;
  }

  const homeTeam = snapshot.layerC?.homeTeam || snapshot.preMatchSnapshot?.layerC?.homeTeam || null;
  const awayTeam = snapshot.layerC?.awayTeam || snapshot.preMatchSnapshot?.layerC?.awayTeam || null;
  if (!homeTeam || !awayTeam) {
    return null;
  }

  for (const key of buildFixtureKeys(homeTeam, awayTeam)) {
    const hit = liveMatchLookup.get(key);
    if (hit) {
      return hit;
    }
  }

  return null;
}

function buildOfficialFeedLookup(officialFeed) {
  const lookup = new Map();

  for (const record of officialFeed || []) {
    if (!record) {
      continue;
    }

    if (record.fixtureId != null) {
      lookup.set(String(record.fixtureId), record);
    }

    if (record.jingcaiMatchId != null) {
      lookup.set(String(record.jingcaiMatchId), record);
    }

    if (record.homeTeam && record.awayTeam) {
      for (const key of buildFixtureKeys(record.homeTeam, record.awayTeam)) {
        lookup.set(key, record);
      }
    }
  }

  return lookup;
}

function findOfficialMatchForSnapshot(snapshot, officialFeedLookup) {
  if (!snapshot) {
    return null;
  }

  const directIdHit = officialFeedLookup.get(String(snapshot.fixtureId)) || null;
  if (directIdHit) {
    return directIdHit;
  }

  const directFixtureHit =
    officialFeedLookup.get(snapshot.fixture) || officialFeedLookup.get(String(snapshot.fixture || "").toLowerCase()) || null;
  if (directFixtureHit) {
    return directFixtureHit;
  }

  const homeTeam = snapshot.layerC?.homeTeam || snapshot.preMatchSnapshot?.layerC?.homeTeam || null;
  const awayTeam = snapshot.layerC?.awayTeam || snapshot.preMatchSnapshot?.layerC?.awayTeam || null;
  if (!homeTeam || !awayTeam) {
    return null;
  }

  for (const key of buildFixtureKeys(homeTeam, awayTeam)) {
    const hit = officialFeedLookup.get(key);
    if (hit) {
      return hit;
    }
  }

  return null;
}

function getActualOutcome(finalScore) {
  const home = Number(finalScore?.home);
  const away = Number(finalScore?.away);

  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return null;
  }

  if (home > away) {
    return "home";
  }

  if (home < away) {
    return "away";
  }

  return "draw";
}

function buildRecommendationSettlementEntry(snapshot, backtestRecord, context = {}) {
  const primaryRecommendation = snapshot?.layerC?.primaryRecommendation || null;
  const hasRecommendation = Boolean(primaryRecommendation);
  const fixtureMeta = buildRecommendationFixture(backtestRecord);
  const liveMatch = findLiveMatchForSnapshot(snapshot, context.liveMatchLookup || new Map());
  const officialMatch = findOfficialMatchForSnapshot(snapshot, context.officialFeedLookup || new Map());
  const officialPlay = primaryRecommendation && officialMatch
    ? getPlayMarketOdds(officialMatch, primaryRecommendation.playType)
    : null;
  const liveFinalScore =
    liveMatch && Number.isFinite(Number(liveMatch.homeScore)) && Number.isFinite(Number(liveMatch.awayScore))
      ? { home: Number(liveMatch.homeScore), away: Number(liveMatch.awayScore) }
      : null;
  const liveActualOutcome = getActualOutcome(liveFinalScore);
  const officialStopSaleOdds =
    officialPlay && primaryRecommendation?.selectionCode != null
      ? officialPlay.odds?.[primaryRecommendation.selectionCode] ?? null
      : null;
  const officialStopSaleAvailable = Number.isFinite(Number(officialStopSaleOdds)) && Number(officialStopSaleOdds) > 1;
  const officialOddsAtRecommendation = primaryRecommendation?.officialOdds ?? null;
  const sourceMode =
    liveFinalScore && hasRecommendation
      ? officialStopSaleAvailable
        ? "live_official"
        : "live_partial"
      : backtestRecord
        ? "artifact"
        : "pending";

  if (!hasRecommendation) {
    return {
      snapshotId: snapshot?.snapshotId ?? null,
      fixtureId: snapshot?.fixtureId ?? fixtureMeta?.fixtureId ?? null,
      fixture: snapshot?.fixture ?? fixtureMeta?.fixture ?? null,
      capturedAt: snapshot?.capturedAt ?? null,
      settlementStatus: "no_recommendation",
      preMatchSnapshot: snapshot,
      settlement: null,
      metrics: null,
      reviewText: fixtureMeta?.reviewText ?? null,
      settlementSourceMode: sourceMode,
      officialSettlementComplete: false,
    };
  }

  if (!liveFinalScore && !backtestRecord) {
    return {
      snapshotId: snapshot?.snapshotId ?? null,
      fixtureId: snapshot?.fixtureId ?? fixtureMeta?.fixtureId ?? null,
      fixture: snapshot?.fixture ?? fixtureMeta?.fixture ?? null,
      capturedAt: snapshot?.capturedAt ?? null,
      settlementStatus: "pending",
      preMatchSnapshot: snapshot,
      settlement: null,
      metrics: null,
      reviewText: null,
      settlementSourceMode: sourceMode,
      officialSettlementComplete: false,
    };
  }

  const recommendation = {
    fixtureId: snapshot.fixtureId,
    homeTeam: snapshot.layerC?.homeTeam ?? snapshot.fixture?.split(" vs ")?.[0] ?? null,
    awayTeam: snapshot.layerC?.awayTeam ?? snapshot.fixture?.split(" vs ")?.[1] ?? null,
    primaryRecommendation: {
      playType: primaryRecommendation.playType,
      selection: primaryRecommendation.selection,
      selectionCode: primaryRecommendation.selectionCode,
      handicap: primaryRecommendation.handicap,
      officialOdds: officialOddsAtRecommendation,
      suggestedStakeUnits: primaryRecommendation.suggestedStakeUnits,
    },
  };

  const resultSource = liveFinalScore || backtestRecord.finalScore || null;
  const resultOutcome = liveActualOutcome || backtestRecord.actualOutcome || null;
  const recommendedOddsAtStopSale =
    officialStopSaleAvailable ? Number(officialStopSaleOdds) : backtestRecord?.officialOddsAtStopSale ?? null;
  const settlement = settleJingcaiRecommendation(recommendation, {
    finalScore: resultSource,
    officialOddsAtRecommendation:
      officialOddsAtRecommendation ?? backtestRecord?.officialOddsAtRecommendation ?? null,
    officialOddsAtStopSale: recommendedOddsAtStopSale,
    stakeUnits: backtestRecord?.stakeUnits ?? primaryRecommendation.suggestedStakeUnits ?? 0,
  });

  const brier = computeBrier(backtestRecord?.modelBeforeKickoff, resultOutcome);
  const logLoss = computeLogLoss(backtestRecord?.modelBeforeKickoff, resultOutcome);
  const closingLineValue = computeClosingLineValue(
    officialOddsAtRecommendation ?? backtestRecord?.officialOddsAtRecommendation ?? null,
    recommendedOddsAtStopSale,
  );

  return {
    snapshotId: snapshot?.snapshotId ?? null,
    fixtureId: snapshot?.fixtureId ?? fixtureMeta?.fixtureId ?? null,
    fixture: snapshot?.fixture ?? fixtureMeta?.fixture ?? null,
    capturedAt: snapshot?.capturedAt ?? null,
    settlementStatus: "settled",
    preMatchSnapshot: snapshot,
    settlementSourceMode: sourceMode,
    officialSettlementComplete: Boolean(liveFinalScore && officialStopSaleAvailable),
    settlement: {
      playType: settlement.playType,
      selection: settlement.selection,
      handicap: settlement.handicap,
      officialOddsAtRecommendation: settlement.officialOddsAtRecommendation,
      officialOddsAtStopSale: settlement.officialOddsAtStopSale,
      resultCode: settlement.resultCode,
      stakeUnits: settlement.stakeUnits,
      payoutMultiple: settlement.payoutMultiple,
      realizedReturnOfficial: settlement.realizedReturnOfficial,
      settlement: settlement.settlement,
      finalScore: resultSource ?? null,
      actualOutcome: resultOutcome ?? null,
      marketClose: backtestRecord?.marketClose ?? null,
    },
    metrics: {
      brier: isFiniteNumber(brier) ? round(brier) : brier,
      logLoss: isFiniteNumber(logLoss) ? round(logLoss) : logLoss,
      closingLineValue: isFiniteNumber(closingLineValue) ? round(closingLineValue) : closingLineValue,
    },
    reviewText: liveMatch?.note ?? backtestRecord?.observation ?? null,
    liveMatchAligned: Boolean(liveMatch),
    officialMatchAligned: Boolean(officialMatch),
  };
}

export function buildRecommendationSettlementBundle(recommendationSnapshots, context = []) {
  const isLegacyArrayCall = Array.isArray(context);
  const backtestRun = isLegacyArrayCall ? context : context.backtestRun || [];
  const liveMatches = isLegacyArrayCall ? [] : context.liveMatches || [];
  const officialFeed = isLegacyArrayCall ? [] : context.officialFeed || [];
  const backtestByFixtureId = new Map((backtestRun || []).map((record) => [String(record.fixtureId), record]));
  const liveMatchLookup = buildLiveMatchLookup(liveMatches);
  const officialFeedLookup = buildOfficialFeedLookup(officialFeed);
  const entries = (recommendationSnapshots || []).map((snapshot) => {
    const backtestRecord = backtestByFixtureId.get(String(snapshot.fixtureId)) || null;
    return buildRecommendationSettlementEntry(snapshot, backtestRecord, {
      liveMatchLookup,
      officialFeedLookup,
    });
  });

  const settledEntries = entries.filter((entry) => entry.settlementStatus === "settled");
  const liveDerivedEntries = entries.filter((entry) => entry.settlementSourceMode === "live_official");
  const artifactBackedEntries = entries.filter((entry) => entry.settlementSourceMode === "artifact");
  const liveMatchAlignedEntries = entries.filter((entry) => entry.liveMatchAligned);
  const officialMatchAlignedEntries = entries.filter((entry) => entry.officialMatchAligned);
  const liveCoverageRate = entries.length > 0 ? round(liveDerivedEntries.length / entries.length, 4) : 0;
  const liveMatchCoverageRate = entries.length > 0 ? round(liveMatchAlignedEntries.length / entries.length, 4) : 0;
  const officialMatchCoverageRate = entries.length > 0 ? round(officialMatchAlignedEntries.length / entries.length, 4) : 0;
  const officialSettlementCoverageRate =
    entries.length > 0 ? round(entries.filter((entry) => entry.officialSettlementComplete).length / entries.length, 4) : 0;
  const totalRealizedReturnOfficial = settledEntries.reduce(
    (sum, entry) => sum + (isFiniteNumber(entry.settlement?.realizedReturnOfficial) ? entry.settlement.realizedReturnOfficial : 0),
    0,
  );
  const meanBrier =
    settledEntries.length > 0
      ? round(
          settledEntries.reduce((sum, entry) => sum + (isFiniteNumber(entry.metrics?.brier) ? entry.metrics.brier : 0), 0) /
            settledEntries.length,
        )
      : null;
  const meanLogLoss =
    settledEntries.length > 0
      ? round(
          settledEntries.reduce((sum, entry) => sum + (isFiniteNumber(entry.metrics?.logLoss) ? entry.metrics.logLoss : 0), 0) /
            settledEntries.length,
        )
      : null;
  const meanClv =
    settledEntries.length > 0
      ? round(
          settledEntries.reduce(
            (sum, entry) => sum + (isFiniteNumber(entry.metrics?.closingLineValue) ? entry.metrics.closingLineValue : 0),
            0,
          ) / settledEntries.length,
        )
      : null;

  return {
    generatedAt: new Date().toISOString(),
    snapshotCount: entries.length,
    entries,
    summary: {
      snapshotCount: entries.length,
      settledCount: settledEntries.length,
      pendingCount: entries.filter((entry) => entry.settlementStatus === "pending").length,
      noRecommendationCount: entries.filter((entry) => entry.settlementStatus === "no_recommendation").length,
      liveDerivedCount: liveDerivedEntries.length,
      artifactBackedCount: artifactBackedEntries.length,
      liveMatchAlignedCount: liveMatchAlignedEntries.length,
      officialMatchAlignedCount: officialMatchAlignedEntries.length,
      officialSettlementCompleteCount: entries.filter((entry) => entry.officialSettlementComplete).length,
      liveCoverageRate,
      liveMatchCoverageRate,
      officialMatchCoverageRate,
      officialSettlementCoverageRate,
      totalRealizedReturnOfficial: round(totalRealizedReturnOfficial),
      meanBrier,
      meanLogLoss,
      meanClv,
    },
  };
}
