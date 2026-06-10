import { expectedValue } from "../edge/ev.js";
import { capStake, fractionalKelly, fullKelly } from "../portfolio/kelly.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCaps(input = {}) {
  return {
    singleCap: isFiniteNumber(input.singleCap) ? input.singleCap : 0.05,
    fixtureCapRemain: isFiniteNumber(input.fixtureCapRemain) ? input.fixtureCapRemain : 0.05,
    dayCapRemain: isFiniteNumber(input.dayCapRemain) ? input.dayCapRemain : 0.05,
    factorCapRemain: isFiniteNumber(input.factorCapRemain) ? input.factorCapRemain : 0.05,
  };
}

function buildNoJingcaiResult(reason, extra = {}) {
  return {
    ok: false,
    decisionCode: reason,
    recommendationLevel: "WATCH",
    noJingcaiReason: reason,
    officialExpectedValue: null,
    officialKelly: null,
    officialFractionalKelly: null,
    officialFinalStakeFraction: 0,
    suggestedStakeUnits: 0,
    suggestedStakeAmountCny: 0,
    maxStakeUnitsByRisk: 0,
    ...extra,
  };
}

export function evaluateJingcaiGates(signalCandidate, mapping, options = {}) {
  if (!signalCandidate) {
    return buildNoJingcaiResult("no_signal_candidate");
  }

  if (!mapping?.ok) {
    return buildNoJingcaiResult(mapping?.reason || "skip_unmapped_play", {
      mappingConfidence: mapping?.mappingConfidence || "low",
    });
  }

  const now = options.now ? new Date(options.now) : new Date();
  const caps = normalizeCaps(options.caps);
  const evThresholdOff = isFiniteNumber(options.evThresholdOff) ? options.evThresholdOff : 0.03;
  const minStakeFraction = isFiniteNumber(options.minStakeFraction) ? options.minStakeFraction : 0.01;
  const minActionStake = isFiniteNumber(options.minActionStake) ? options.minActionStake : 0.01;
  const kellyFraction = isFiniteNumber(options.kellyFraction) ? options.kellyFraction : 0.25;
  const stakeUnitFraction = isFiniteNumber(options.stakeUnitFraction) ? options.stakeUnitFraction : 0.01;

  if (signalCandidate.recommendationLevel === "NO_ACTION") {
    return buildNoJingcaiResult("skip_overseas_signal_not_strong_enough", {
      mappingConfidence: mapping.mappingConfidence,
    });
  }

  if (
    signalCandidate.recommendationLevel === "WATCH" &&
    signalCandidate.decisionCode !== "candidate_positive_ev" &&
    options.allowWatchEvaluation !== true
  ) {
    return buildNoJingcaiResult("watch_overseas_signal_only", {
      mappingConfidence: mapping.mappingConfidence,
    });
  }

  if (mapping.officialSaleStatus === "not_listed") {
    return buildNoJingcaiResult("skip_not_in_schedule", {
      mappingConfidence: mapping.mappingConfidence,
    });
  }

  if (mapping.officialSaleStatus !== "on_sale") {
    return buildNoJingcaiResult("skip_play_not_on_sale", {
      mappingConfidence: mapping.mappingConfidence,
    });
  }

  if (!mapping.officialStopTime) {
    return buildNoJingcaiResult("skip_no_stop_time", {
      mappingConfidence: mapping.mappingConfidence,
    });
  }

  const stopSaleTime = new Date(mapping.officialStopTime);
  if (Number.isNaN(stopSaleTime.getTime())) {
    return buildNoJingcaiResult("skip_no_stop_time", {
      mappingConfidence: mapping.mappingConfidence,
    });
  }

  if (now >= stopSaleTime) {
    return buildNoJingcaiResult("skip_past_stop_sale", {
      mappingConfidence: mapping.mappingConfidence,
      stopSaleTime: mapping.officialStopTime,
    });
  }

  if (mapping.mappingConfidence !== "high") {
    return buildNoJingcaiResult("skip_mapping_low_confidence", {
      mappingConfidence: mapping.mappingConfidence,
      stopSaleTime: mapping.officialStopTime,
    });
  }

  if (!isFiniteNumber(mapping.officialOdds) || mapping.officialOdds <= 1) {
    return buildNoJingcaiResult("skip_no_official_odds", {
      mappingConfidence: mapping.mappingConfidence,
      stopSaleTime: mapping.officialStopTime,
    });
  }

  if (!isFiniteNumber(mapping.officialProbability)) {
    return buildNoJingcaiResult("skip_bad_data", {
      mappingConfidence: mapping.mappingConfidence,
      stopSaleTime: mapping.officialStopTime,
    });
  }

  const officialExpectedValue = expectedValue(mapping.officialOdds, mapping.officialProbability);
  const officialKelly = fullKelly(mapping.officialOdds, mapping.officialProbability);
  const officialFractionalKelly = fractionalKelly(mapping.officialOdds, mapping.officialProbability, kellyFraction);
  const officialCappedStakeFraction = capStake(officialFractionalKelly, {
    singleBetCap: caps.singleCap,
    matchCap: caps.fixtureCapRemain,
    dayCap: caps.dayCapRemain,
  });
  const officialFinalStakeFraction = Math.min(officialCappedStakeFraction, caps.factorCapRemain);

  let decisionCode;
  if (officialExpectedValue <= evThresholdOff) {
    decisionCode = "watch_official_ev_low";
  } else if (officialKelly <= 0) {
    decisionCode = "skip_official_negative_kelly";
  } else if (officialFractionalKelly < minStakeFraction) {
    decisionCode = "watch_official_stake_too_small";
  } else if (officialFinalStakeFraction <= 0) {
    decisionCode = "skip_risk_cap";
  } else {
    decisionCode = "jingcai_candidate_ok";
  }

  const recommendationLevel =
    decisionCode.startsWith("skip")
      ? "NO_ACTION"
      : decisionCode.startsWith("watch")
        ? "WATCH"
        : officialFinalStakeFraction <= 0
          ? "NO_ACTION"
          : officialFinalStakeFraction < minActionStake
            ? "CANDIDATE"
            : "SMALL_POSITION";

  const suggestedStakeUnits =
    recommendationLevel === "NO_ACTION" ? 0 : Math.max(1, Math.floor(officialFinalStakeFraction / stakeUnitFraction));
  const suggestedStakeAmountCny = suggestedStakeUnits * 2;
  const maxStakeUnitsByRisk = Math.max(0, Math.floor(caps.dayCapRemain / stakeUnitFraction));

  return {
    ok: !decisionCode.startsWith("skip_"),
    decisionCode,
    recommendationLevel,
    noJingcaiReason: decisionCode.startsWith("skip_") ? decisionCode : null,
    officialExpectedValue,
    officialKelly,
    officialFractionalKelly,
    officialFinalStakeFraction,
    suggestedStakeUnits,
    suggestedStakeAmountCny,
    maxStakeUnitsByRisk,
    stopSaleTime: mapping.officialStopTime,
    saleStatus: mapping.officialSaleStatus,
    mappingConfidence: mapping.mappingConfidence,
    officialOdds: mapping.officialOdds,
    officialProbability: mapping.officialProbability,
    officialSelection: mapping.selection,
    officialSelectionCode: mapping.selectionCode,
    playType: mapping.playType,
    handicap: mapping.handicap,
    settlementRuleVersion: mapping.settlementRuleVersion,
  };
}
