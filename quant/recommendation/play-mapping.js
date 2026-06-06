import { priceJingcaiRqspf } from "../pricing/jingcai-rqspf.js";

const H2H_OUTCOME_MAP = {
  home: { playType: "胜平负", selection: "胜", selectionCode: "3" },
  draw: { playType: "胜平负", selection: "平", selectionCode: "1" },
  away: { playType: "胜平负", selection: "负", selectionCode: "0" },
};

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function buildUnsupportedResult(reason, extra = {}) {
  return {
    ok: false,
    reason,
    mappingConfidence: "low",
    playType: null,
    selection: null,
    selectionCode: null,
    handicap: null,
    officialOdds: null,
    officialSaleStatus: null,
    officialStopTime: null,
    officialPlayKey: null,
    officialPlayOdds: null,
    officialProbability: null,
    settlementRuleVersion: null,
    ...extra,
  };
}

function getOfficialPlay(record, playKey) {
  return record?.availablePlays?.[playKey] || null;
}

function getOutcomeProbability(outcomes, code) {
  return (outcomes || []).find((outcome) => outcome.code === code)?.probability ?? null;
}

export function mapSignalCandidateToJingcaiPlay(signalCandidate, officialMatch, options = {}) {
  if (!signalCandidate) {
    return buildUnsupportedResult("no_signal_candidate");
  }

  if (!officialMatch) {
    return buildUnsupportedResult("skip_not_in_schedule", {
      officialSaleStatus: "not_listed",
    });
  }

  const playKey = signalCandidate.marketType === "h2h" ? "spf" : signalCandidate.marketType === "spread" ? "rqspf" : null;
  if (!playKey) {
    return buildUnsupportedResult("skip_unmapped_play", {
      officialSaleStatus: officialMatch.saleStatus || "not_listed",
    });
  }

  const officialPlay = getOfficialPlay(officialMatch, playKey);
  if (!officialPlay?.onSale) {
    return buildUnsupportedResult("skip_play_not_on_sale", {
      officialSaleStatus: officialMatch.saleStatus || "not_listed",
      officialStopTime: officialMatch.stopSaleTime || null,
    });
  }

  const candidateOutcome = signalCandidate.outcome;
  let selectionCode = null;
  let selection = null;

  if (signalCandidate.marketType === "h2h") {
    const mapped = H2H_OUTCOME_MAP[candidateOutcome];
    if (!mapped) {
      return buildUnsupportedResult("skip_unmapped_play", {
        officialSaleStatus: officialMatch.saleStatus || "not_listed",
        officialStopTime: officialMatch.stopSaleTime || null,
      });
    }
    selectionCode = mapped.selectionCode;
    selection = mapped.selection;
  } else if (signalCandidate.marketType === "spread") {
    if (signalCandidate.marketBaseline?.scoreMatrix == null) {
      return buildUnsupportedResult("skip_bad_data", {
        officialSaleStatus: officialMatch.saleStatus || "not_listed",
      });
    }

    const homeTeam = officialMatch.homeTeam;
    const awayTeam = officialMatch.awayTeam;
    if (candidateOutcome === homeTeam || candidateOutcome === "home") {
      selectionCode = "3";
      selection = "胜";
    } else if (candidateOutcome === awayTeam || candidateOutcome === "away") {
      selectionCode = "0";
      selection = "负";
    } else if (candidateOutcome === "draw") {
      selectionCode = "1";
      selection = "平";
    } else {
      return buildUnsupportedResult("skip_unmapped_play", {
        officialSaleStatus: officialMatch.saleStatus || "not_listed",
      });
    }

    const officialHandicap = officialPlay.handicap;
    const baselineLine = signalCandidate.line;
    if (!isFiniteNumber(officialHandicap) || !isFiniteNumber(baselineLine)) {
      return buildUnsupportedResult("skip_mapping_low_confidence", {
        officialSaleStatus: officialMatch.saleStatus || "not_listed",
      });
    }

    const diff = Math.abs(officialHandicap - baselineLine);
    if (diff >= 1) {
      return buildUnsupportedResult("skip_mapping_low_confidence", {
        officialSaleStatus: officialMatch.saleStatus || "not_listed",
      });
    }
  }

  const officialOdds = officialPlay.odds?.[selectionCode];
  if (!isFiniteNumber(officialOdds) || officialOdds <= 1) {
    return buildUnsupportedResult("skip_no_official_odds", {
      officialSaleStatus: officialMatch.saleStatus || "not_listed",
      officialStopTime: officialMatch.stopSaleTime || null,
      selection,
      selectionCode,
      playType: playKey === "spf" ? "胜平负" : "让球胜平负",
      handicap: playKey === "rqspf" ? officialPlay.handicap ?? null : null,
      officialPlayKey: playKey,
      officialPlayOdds: officialPlay.odds || null,
    });
  }

  let officialProbability = null;
  if (playKey === "spf") {
    officialProbability = signalCandidate.adjustedProbability;
  } else if (playKey === "rqspf") {
    const rqspfPricing = priceJingcaiRqspf(signalCandidate.marketBaseline.scoreMatrix, officialPlay.handicap);
    officialProbability = getOutcomeProbability(rqspfPricing.outcomes, selectionCode);
  }

  const mappingConfidence =
    playKey === "spf"
      ? "high"
      : signalCandidate.line === officialPlay.handicap
        ? "high"
        : "medium";

  return {
    ok: true,
    reason: null,
    mappingConfidence,
    playType: playKey === "spf" ? "胜平负" : "让球胜平负",
    selection,
    selectionCode,
    handicap: playKey === "rqspf" ? officialPlay.handicap ?? null : null,
    officialOdds,
    officialSaleStatus: officialMatch.saleStatus || "not_listed",
    officialStopTime: officialMatch.stopSaleTime || null,
    officialPlayKey: playKey,
    officialPlayOdds: officialPlay.odds || null,
    officialProbability,
    settlementRuleVersion: officialMatch.ruleVersion || null,
    officialMatch,
  };
}
