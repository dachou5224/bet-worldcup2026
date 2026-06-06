function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatPercent(value, digits = 1) {
  if (!isFiniteNumber(value)) {
    return "n/a";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function buildOverseasSummarySentence(signalCandidate) {
  if (!signalCandidate) {
    return null;
  }

  return signalCandidate.recommendationText || null;
}

function buildJingcaiSummarySentence(jingcaiRecommendation) {
  const primary = jingcaiRecommendation?.primaryRecommendation;
  if (!primary) {
    return null;
  }

  return `体彩收敛：映射为竞彩足球【${primary.playType}】【${primary.selection}】，官方赔率 ${primary.officialOdds.toFixed(2)}，按 P_adj 重算 EV 为 ${formatPercent(primary.officialExpectedValue, 1)}，建议等级 ${primary.recommendationLevel}。`;
}

export function buildLayeredTextSummary(prediction) {
  const overseas = buildOverseasSummarySentence(prediction?.signalCandidate) || prediction?.summary || "";
  const jingcai = buildJingcaiSummarySentence(prediction?.jingcaiRecommendation);

  return jingcai ? `${overseas} ${jingcai}`.trim() : overseas;
}

export function buildLayeredOutput(prediction) {
  const primaryRecommendation = prediction?.jingcaiRecommendation?.primaryRecommendation || null;

  return {
    fixtureId: prediction?.id ?? prediction?.fixtureId ?? null,
    fixture: prediction?.fixture ?? null,
    kickoff: prediction?.kickoff ?? null,
    confidence: prediction?.confidence ?? null,
    marketSummary: prediction?.summary ?? null,
    layerA: {
      marketSummary: prediction?.summary ?? null,
      signalCandidate: prediction?.signalCandidate || null,
      signalCandidates: prediction?.signalCandidates || [],
    },
    layerB: primaryRecommendation
      ? {
          mappingConfidence: primaryRecommendation.mappingConfidence ?? null,
          officialSaleStatus: primaryRecommendation.saleStatus ?? null,
          officialStopTime: primaryRecommendation.stopSaleTime ?? null,
          officialOdds: primaryRecommendation.officialOdds ?? null,
          officialExpectedValue: primaryRecommendation.officialExpectedValue ?? null,
          recommendationLevel: primaryRecommendation.recommendationLevel ?? null,
          noJingcaiReason: null,
        }
      : {
          mappingConfidence: null,
          officialSaleStatus: null,
          officialStopTime: null,
          officialOdds: null,
          officialExpectedValue: null,
          recommendationLevel: null,
          noJingcaiReason: prediction?.jingcaiRecommendation?.noJingcaiReason || null,
        },
    layerC: prediction?.jingcaiRecommendation || null,
    textSummary: buildLayeredTextSummary(prediction),
    defaultDisplayLayer: primaryRecommendation ? "C" : "A",
    displayLabel: prediction?.fixture ?? null,
  };
}

export function buildLayeredOutputs(predictions) {
  return (predictions || []).map((prediction) => buildLayeredOutput(prediction));
}
