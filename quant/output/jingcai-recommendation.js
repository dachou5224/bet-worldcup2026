import { buildFixtureLabel } from "../../lib/match-key.js";
import { mapSignalCandidateToJingcaiPlay } from "../recommendation/play-mapping.js";
import { evaluateJingcaiGates } from "../recommendation/jingcai-gates.js";
import { pickPrimarySignalCandidate } from "../recommendation/decision-layer.js";

function isStakeSuggestionEnabled() {
  return (process.env.ENABLE_STAKE_SUGGESTION || "false") !== "false";
}

function buildOverseasContext(signalCandidate) {
  if (!signalCandidate) {
    return null;
  }

  return {
    signalMarketType: signalCandidate.marketType,
    overseasLine: signalCandidate.line,
    overseasExpectedValue: signalCandidate.expectedValue,
    recommendationLevel: signalCandidate.recommendationLevel,
    signalCandidate,
  };
}

function buildJingcaiRecommendationText({
  matchLabel,
  officialSelection,
  playType,
  officialOdds,
  officialExpectedValue,
  saleStatus,
  stopSaleTime,
  recommendationLevel,
  suggestedStakeUnits,
  officialFinalStakeFraction,
  overseasSummary,
}) {
  const matchPrefix = matchLabel ? `${matchLabel}，` : "";
  const showStakeSuggestion = isStakeSuggestionEnabled();
  const stakeText = showStakeSuggestion
    ? `，建议等级 ${recommendationLevel}，参考仓位 ${Math.max(1, suggestedStakeUnits)} 注×2 元（约 ${(officialFinalStakeFraction * 100).toFixed(2)}% 风险预算）`
    : `，建议等级 ${recommendationLevel}`;

  return `体彩收敛：${matchPrefix}该海外信号映射为竞彩足球【${playType}】【${officialSelection}】，官方赔率 ${officialOdds.toFixed(2)}，按 P_adj 重算 EV 为 ${(officialExpectedValue * 100).toFixed(1)}%。销售状态【${saleStatus === "on_sale" ? "在售" : saleStatus === "stopped" ? "停售" : "未上架"}】，停售时间 ${stopSaleTime || "n/a"}${stakeText}。海外盘与体彩盘存在差异时，以体彩官方数据为准。${overseasSummary ? ` 海外研究：${overseasSummary}` : ""}`;
}

function buildNoJingcaiRecommendation(signalCandidate, officialMatch, reason) {
  return {
    fixtureId: signalCandidate?.fixtureId ?? officialMatch?.fixtureId ?? null,
    jingcaiMatchId: officialMatch?.jingcaiMatchId ?? null,
    competition: officialMatch?.competition ?? "2026 FIFA World Cup",
    homeTeam: officialMatch?.homeTeam ?? null,
    awayTeam: officialMatch?.awayTeam ?? null,
    kickoffLocal: officialMatch?.kickoffLocal ?? null,
    primaryRecommendation: null,
    alternativeRecommendations: [],
    overseasContext: buildOverseasContext(signalCandidate),
    noJingcaiReason: reason,
    disclaimers: ["研究建议，非代购", "以终端官方赔率和停售时间为准"],
  };
}

export function buildJingcaiRecommendation(signalCandidate, officialMatch, options = {}) {
  if (!signalCandidate) {
    return buildNoJingcaiRecommendation(null, officialMatch, "no_signal_candidate");
  }

  if (!officialMatch) {
    return buildNoJingcaiRecommendation(signalCandidate, null, "skip_not_in_schedule");
  }

  const mapping = mapSignalCandidateToJingcaiPlay(signalCandidate, officialMatch, options);
  const gate = evaluateJingcaiGates(signalCandidate, mapping, {
    ...options,
    allowWatchEvaluation: options.directEVEligible === true || officialMatch?.directEVEligible === true,
  });

  if (!mapping.ok) {
    return buildNoJingcaiRecommendation(signalCandidate, officialMatch, mapping.reason || "skip_unmapped_play");
  }

  if (!gate.ok) {
    return buildNoJingcaiRecommendation(signalCandidate, officialMatch, gate.noJingcaiReason || gate.decisionCode);
  }

  const overseasSummary = signalCandidate.recommendationText;
  const recommendationMatchLabel = officialMatch.stage
    ? `${officialMatch.stage} (${buildFixtureLabel(officialMatch.homeTeam, officialMatch.awayTeam)})`
    : buildFixtureLabel(officialMatch.homeTeam, officialMatch.awayTeam);
  const primaryRecommendation = {
    playType: gate.playType,
    handicap: gate.handicap,
    selection: gate.officialSelection,
    selectionCode: gate.officialSelectionCode,
    officialOdds: gate.officialOdds,
    fairOddsFromModel: signalCandidate.adjustedProbability ? 1 / signalCandidate.adjustedProbability : null,
    adjustedProbability: signalCandidate.adjustedProbability,
    officialExpectedValue: gate.officialExpectedValue,
    recommendationLevel: gate.recommendationLevel,
    suggestedStakeUnits: gate.suggestedStakeUnits,
    suggestedStakeAmountCny: gate.suggestedStakeAmountCny,
    maxStakeUnitsByRisk: gate.maxStakeUnitsByRisk,
    saleStatus: gate.saleStatus,
    stopSaleTime: gate.stopSaleTime,
    mappingConfidence: gate.mappingConfidence,
    recommendationText: buildJingcaiRecommendationText({
      matchLabel: recommendationMatchLabel,
      officialSelection: gate.officialSelection,
      playType: gate.playType,
      officialOdds: gate.officialOdds,
      officialExpectedValue: gate.officialExpectedValue,
      saleStatus: gate.saleStatus,
      stopSaleTime: gate.stopSaleTime,
      recommendationLevel: gate.recommendationLevel,
      suggestedStakeUnits: gate.suggestedStakeUnits,
      officialFinalStakeFraction: gate.officialFinalStakeFraction,
      overseasSummary,
    }),
  };

  return {
    fixtureId: signalCandidate.fixtureId ?? officialMatch.fixtureId ?? null,
    jingcaiMatchId: officialMatch.jingcaiMatchId ?? null,
    competition: officialMatch.competition ?? "2026 FIFA World Cup",
    homeTeam: officialMatch.homeTeam ?? null,
    awayTeam: officialMatch.awayTeam ?? null,
    kickoffLocal: officialMatch.kickoffLocal ?? null,
    matchLabel: officialMatch.stage || buildFixtureLabel(officialMatch.homeTeam, officialMatch.awayTeam),
    primaryRecommendation,
    alternativeRecommendations: [],
    overseasContext: buildOverseasContext(signalCandidate),
    noJingcaiReason: null,
    disclaimers: ["研究建议，非代购", "以终端官方赔率和停售时间为准"],
  };
}

export function buildJingcaiRecommendationsByFixture(signalCandidatesByFixture, officialFeed, options = {}) {
  const feedByFixtureId = new Map(
    (officialFeed || []).map((record) => [String(record.fixtureId ?? ""), record]),
  );

  return (signalCandidatesByFixture || []).map((entry) => {
    const officialMatch = feedByFixtureId.get(String(entry.fixtureId ?? "")) || null;
    const eligibleCandidates = (entry.signalCandidates || []).filter(
      (candidate) => candidate.recommendationLevel !== "NO_ACTION",
    );
    const primaryCandidate = pickPrimarySignalCandidate(eligibleCandidates.length ? eligibleCandidates : entry.signalCandidates || []);

    if (!primaryCandidate) {
      return buildNoJingcaiRecommendation(null, officialMatch, "no_signal_candidate");
    }

    return buildJingcaiRecommendation(primaryCandidate, officialMatch, options);
  });
}
